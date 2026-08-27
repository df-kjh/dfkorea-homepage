import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { TenderSourceError } from "../adapters/public-api-client";
import { NormalizedTender } from "../domain/normalized-tender";
import { TenderClassifier } from "../domain/tender-classifier";
import {
  TenderFetchWindow,
  TenderSourceAdapter,
  TENDER_SOURCE_ADAPTERS,
} from "../domain/tender-source.adapter";
import { SyncRunStatus, TenderSource } from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderSyncRun } from "../entities/tender-sync-run.entity";

const COLLECTION_LOCK_ID = 824001;
const INITIAL_COLLECTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const COLLECTION_OVERLAP_MS = 60 * 60 * 1000;

export interface SourceCollectionSummary {
  source: TenderSource;
  status: SyncRunStatus.SUCCEEDED | SyncRunStatus.FAILED;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  excludedCount: number;
  errorCode: string | null;
}

export interface CollectionSummary {
  lockAcquired: boolean;
  collectedAt: Date;
  sources: SourceCollectionSummary[];
  failedSources: TenderSource[];
}

type TenderUpsert = Omit<Tender, "id" | "firstCollectedAt" | "lastUpdatedAt">;

@Injectable()
export class TenderIngestionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TenderSyncRun)
    private readonly syncRunRepository: Repository<TenderSyncRun>,
    private readonly classifier: TenderClassifier,
    @Inject(TENDER_SOURCE_ADAPTERS)
    private readonly adapters: readonly TenderSourceAdapter[],
  ) {}

  async collectAll(now: Date): Promise<CollectionSummary> {
    // PostgreSQL advisory locks belong to a connection session. Keep this
    // runner connected for the entire collection so acquire and release cannot
    // accidentally run on different pool connections.
    const lockRunner = this.dataSource.createQueryRunner();
    let lockAcquired = false;
    try {
      await lockRunner.connect();
      const [lockResult] = await lockRunner.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [COLLECTION_LOCK_ID],
      );
      lockAcquired = lockResult?.locked === true;
      if (!lockAcquired) {
        return {
          lockAcquired: false,
          collectedAt: now,
          sources: [],
          failedSources: [],
        };
      }

      const sources = await Promise.all(
        this.adapters.map((adapter) => this.collectSource(adapter, now)),
      );
      return {
        lockAcquired: true,
        collectedAt: now,
        sources,
        failedSources: sources
          .filter((source) => source.status === SyncRunStatus.FAILED)
          .map((source) => source.source),
      };
    } finally {
      try {
        if (lockAcquired) {
          await lockRunner.query("SELECT pg_advisory_unlock($1) AS unlocked", [
            COLLECTION_LOCK_ID,
          ]);
        }
      } finally {
        // Release is mandatory even when connection, acquisition, collection,
        // or unlock fails. Unlock errors intentionally remain observable after
        // the runner is released because they can leave a pooled session held.
        await lockRunner.release();
      }
    }
  }

  private async collectSource(
    adapter: TenderSourceAdapter,
    now: Date,
  ): Promise<SourceCollectionSummary> {
    let run: TenderSyncRun | undefined;

    try {
      const window = await this.resolveWindow(adapter.source, now);
      run = await this.syncRunRepository.save({
        source: adapter.source,
        scheduledAt: now,
        startedAt: now,
        finishedAt: null,
        status: SyncRunStatus.RUNNING,
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        excludedCount: 0,
        errorCode: null,
        errorMessage: null,
      });
      const notices = await adapter.fetchNotices(window);
      const { relevant, excludedCount } = this.classifyNotices(notices);
      const { createdCount, updatedCount } = await this.upsertRelevantTenders(
        relevant,
      );
      await this.syncRunRepository.save({
        ...run,
        finishedAt: new Date(),
        status: SyncRunStatus.SUCCEEDED,
        fetchedCount: notices.length,
        createdCount,
        updatedCount,
        excludedCount,
        errorCode: null,
        errorMessage: null,
      });
      return {
        source: adapter.source,
        status: SyncRunStatus.SUCCEEDED,
        fetchedCount: notices.length,
        createdCount,
        updatedCount,
        excludedCount,
        errorCode: null,
      };
    } catch (error) {
      const { errorCode, errorMessage } = this.sanitizeError(error);
      // A provider error is isolated from the other two official sources. The
      // nested guard keeps an unavailable database write from turning one
      // source's failed run into a failed whole-collection job.
      try {
        await this.syncRunRepository.save({
          ...run,
          source: adapter.source,
          scheduledAt: run?.scheduledAt ?? now,
          startedAt: run?.startedAt ?? now,
          finishedAt: new Date(),
          status: SyncRunStatus.FAILED,
          fetchedCount: 0,
          createdCount: 0,
          updatedCount: 0,
          excludedCount: 0,
          errorCode,
          errorMessage,
        });
      } catch {
        // There is no safe secondary persistence path. Continue the remaining
        // sources; the scheduler's process logs still expose the failed job.
      }
      return {
        source: adapter.source,
        status: SyncRunStatus.FAILED,
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        excludedCount: 0,
        errorCode,
      };
    }
  }

  private async resolveWindow(
    source: TenderSource,
    now: Date,
  ): Promise<TenderFetchWindow> {
    const previousRun = await this.syncRunRepository.findOne({
      where: { source, status: SyncRunStatus.SUCCEEDED },
      order: { finishedAt: "DESC" },
    });
    const previousFinishedAt = previousRun?.finishedAt;
    return {
      from: previousFinishedAt
        ? new Date(previousFinishedAt.getTime() - COLLECTION_OVERLAP_MS)
        : new Date(now.getTime() - INITIAL_COLLECTION_WINDOW_MS),
      to: now,
    };
  }

  private classifyNotices(notices: NormalizedTender[]): {
    relevant: TenderUpsert[];
    excludedCount: number;
  } {
    let excludedCount = 0;
    const byIdentity = new Map<string, TenderUpsert>();

    for (const notice of notices) {
      const classification = this.classifier.classify(notice);
      if (!classification) {
        excludedCount += 1;
        continue;
      }
      const tender = this.toTenderUpsert(notice, classification);
      byIdentity.set(this.identityOf(tender), tender);
    }

    return { relevant: [...byIdentity.values()], excludedCount };
  }

  private async upsertRelevantTenders(
    tenders: TenderUpsert[],
  ): Promise<{ createdCount: number; updatedCount: number }> {
    if (tenders.length === 0) {
      return { createdCount: 0, updatedCount: 0 };
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Tender);
      const existing = await repository.find({
        select: ["source", "sourceNoticeId", "revision"],
        where: {
          source: tenders[0].source,
          sourceNoticeId: In(tenders.map((tender) => tender.sourceNoticeId)),
        },
      });
      const existingIdentities = new Set(
        existing.map((tender) => this.identityOf(tender)),
      );
      const updatedCount = tenders.filter((tender) =>
        existingIdentities.has(this.identityOf(tender)),
      ).length;

      await repository.upsert(tenders, {
        conflictPaths: ["source", "sourceNoticeId", "revision"],
      });

      return { createdCount: tenders.length - updatedCount, updatedCount };
    });
  }

  private toTenderUpsert(
    notice: NormalizedTender,
    classification: NonNullable<ReturnType<TenderClassifier["classify"]>>,
  ): TenderUpsert {
    return {
      source: notice.source,
      sourceNoticeId: notice.sourceNoticeId,
      revision: notice.revision,
      title: notice.title,
      orderingOrganization: notice.orderingOrganization,
      demandOrganization: notice.demandOrganization,
      registeredAt: notice.registeredAt,
      bidStartedAt: notice.bidStartedAt,
      bidEndedAt: notice.bidEndedAt,
      openedAt: notice.openedAt,
      region: notice.region,
      procurementType: notice.procurementType,
      contractMethod: notice.contractMethod,
      estimatedAmount: notice.estimatedAmount,
      sourceUrl: notice.sourceUrl,
      relevance: classification.relevance,
      relevanceScore: classification.score,
      relevanceReasons: classification.reasons,
      // Adapters keep only provider response fields in rawData; request URLs
      // and configuration never cross this boundary, preventing key storage.
      rawData: notice.rawData,
    };
  }

  private identityOf(
    tender: Pick<Tender, "source" | "sourceNoticeId" | "revision">,
  ): string {
    return `${tender.source}:${tender.sourceNoticeId}:${tender.revision}`;
  }

  private sanitizeError(error: unknown): {
    errorCode: string;
    errorMessage: string;
  } {
    if (error instanceof TenderSourceError) {
      return { errorCode: error.code, errorMessage: error.message };
    }

    return {
      errorCode: "COLLECTION_ERROR",
      errorMessage: "Tender source collection failed",
    };
  }
}
