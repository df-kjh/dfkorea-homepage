import {
  awardCoverageThrough,
  planIncrementalAwardWindows,
  monthlyAwardWindows,
} from "../domain/tender-award-window";
export { monthlyAwardWindows } from "../domain/tender-award-window";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, EntityManager } from "typeorm";
import { G2bAwardAdapter, AwardWindow } from "../adapters/g2b-award.adapter";
import { classifyAwardFailure } from "../domain/tender-award-failure";
import { TenderAwardSyncRun } from "../entities/tender-award-sync-run.entity";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
import { TenderAwardSyncStatus } from "../domain/tender-analysis.enums";
const ORDINARY_COLLECTION_LOCK = 824001;
const AWARD_CLAIM_LOCK = 824006;
@Injectable()
export class TenderAwardCollectorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adapter: G2bAwardAdapter,
  ) {}
  async startBackfill(now: Date) {
    const windows = monthlyAwardWindows(now);
    await this.seed(windows);
    return this.getStatus();
  }
  async collectIncremental(
    now: Date,
  ): Promise<{ processed: boolean; reason?: string }> {
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      // Share the ordinary collector's actual session lock. A busy ordinary
      // collector always wins; this bounded tick never starts concurrent traffic.
      const [permit] = await runner.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [ORDINARY_COLLECTION_LOCK],
      );
      locked = permit?.locked === true;
      if (!locked)
        return { processed: false, reason: "ORDINARY_COLLECTION_BUSY" };
      let run = await this.claim();
      if (!run) {
        const runs = await this.dataSource
          .getRepository(TenderAwardSyncRun)
          .find({ where: { source: "G2B" } });
        if (runs.some((run) => run.errorCode?.startsWith("TERMINAL_")))
          return { processed: false, reason: "TERMINAL_FAILURE" };
        if (runs.some((run) => run.status !== TenderAwardSyncStatus.SUCCEEDED))
          return { processed: false, reason: "LEASE_OR_COOLDOWN" };
        // Durable contiguous completion, not a moving now-minus-seven-days
        // cutoff, determines catch-up after downtime or a long-running backfill.
        await this.seed(planIncrementalAwardWindows(now, runs));
        run = await this.claim();
      }
      if (!run) return { processed: false, reason: "UP_TO_DATE" };
      try {
        const page = await this.adapter.fetchWindow(
          { start: run.periodStart, end: run.periodEnd },
          run.cursor,
        );
        const committed = await this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(TenderAwardSyncRun);
          const owned = await repo
            .createQueryBuilder("run")
            .setLock("pessimistic_write")
            .where(
              "run.id = :id AND run.leaseToken = :token AND run.leaseExpiresAt > CURRENT_TIMESTAMP",
              { id: run.id, token: run.leaseToken },
            )
            .getOne();
          if (!owned) return false;
          // Fenced row lock and result upserts share a transaction with the cursor.
          // A crash cannot acknowledge data that rolled back; expired workers cannot
          // overwrite a successor's results, even after completing their HTTP call.
          let reconciliationReview =
            page.diagnostics?.includes("AMBIGUOUS_CLASS_IDENTITY") ?? false;
          for (const invalidation of page.invalidations ?? []) {
            const update = manager
              .getRepository(TenderAwardResult)
              .createQueryBuilder()
              .update()
              .set({ isFinalAward: false })
              .where(
                'source = :source AND "sourceNoticeId" = :notice AND revision = :revision',
                {
                  source: invalidation.source,
                  notice: invalidation.sourceNoticeId,
                  revision: invalidation.revision,
                },
              );
            if (invalidation.kind === "SINGLE_ITEM_RECONCILED") {
              const activeIdentities = await manager
                .getRepository(TenderAwardResult)
                .createQueryBuilder("award")
                .select("award.id")
                .setLock("pessimistic_write")
                .where(
                  "award.source = :source AND award.sourceNoticeId = :notice AND award.revision = :revision AND award.openedAt = :openedAt AND award.isFinalAward = true",
                  {
                    source: invalidation.source,
                    notice: invalidation.sourceNoticeId,
                    revision: invalidation.revision,
                    openedAt: invalidation.openedAt,
                  },
                )
                .limit(2)
                .getMany();
              // Historical rows have no bidClsfcNo. Even a now-single-item
              // response cannot assign an old class if multiple active product
              // identities remain. Do not invalidate unrelated historical lots.
              if (activeIdentities.length > 1) {
                reconciliationReview = true;
                continue;
              }
              update.andWhere('"openedAt" = :openedAt', {
                openedAt: invalidation.openedAt,
              });
              if (invalidation.retainedProductClassification !== null)
                update.andWhere('"productClassification" != :retained', {
                  retained: invalidation.retainedProductClassification,
                });
            }
            await update.execute();
          }
          if (page.items.length)
            await manager.getRepository(TenderAwardResult).upsert(page.items, {
              conflictPaths: [
                "source",
                "sourceNoticeId",
                "revision",
                "productClassification",
                "openedAt",
              ],
            });
          await repo.update(owned.id, {
            cursor: page.nextCursor,
            fetchedCount: owned.fetchedCount + page.fetchedCount,
            storedCount: owned.storedCount + page.items.length,
            excludedCount: owned.excludedCount + page.excludedCount,
            status: page.nextCursor
              ? TenderAwardSyncStatus.PARTIAL
              : TenderAwardSyncStatus.SUCCEEDED,
            leaseToken: null,
            leaseExpiresAt: null,
            errorCode: reconciliationReview ? "AMBIGUOUS_CLASS_IDENTITY" : null,
            finishedAt: page.nextCursor ? null : new Date(),
          });
          return true;
        });
        return committed
          ? { processed: true }
          : { processed: false, reason: "LEASE_LOST" };
      } catch (error) {
        const failure = classifyAwardFailure(error);
        // Only a bounded code is persisted. Raw DB/provider failures can contain
        // personal data and credentials, so do not serialize messages or causes.
        await this.dataSource
          .getRepository(TenderAwardSyncRun)
          .createQueryBuilder()
          .update()
          .set({
            status: TenderAwardSyncStatus.FAILED,
            errorCode: failure.code,
            leaseToken: null,
            leaseExpiresAt: failure.terminal
              ? null
              : () => "CURRENT_TIMESTAMP + INTERVAL '5 minutes'",
          })
          .where(
            'id = :id AND "leaseToken" = :token AND "leaseExpiresAt" > CURRENT_TIMESTAMP',
            {
              id: run.id,
              token: run.leaseToken,
            },
          )
          .execute();
        return { processed: false, reason: "COLLECTION_FAILED" };
      }
    } finally {
      try {
        if (locked)
          await runner.query("SELECT pg_advisory_unlock($1)", [
            ORDINARY_COLLECTION_LOCK,
          ]);
      } finally {
        await runner.release();
      }
    }
  }
  /** Explicit operator/service resume after correcting a provider subscription
   * or configuration. Preserves cursor, counters, completed windows and data. */
  async resumeTerminalFailures(): Promise<{ resumedCount: number }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock($1)", [
        AWARD_CLAIM_LOCK,
      ]);
      const result = await manager
        .getRepository(TenderAwardSyncRun)
        .createQueryBuilder()
        .update()
        .set({
          status: TenderAwardSyncStatus.PARTIAL,
          errorCode: null,
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(
          'source = :source AND status = :status AND "leaseToken" IS NULL AND LEFT("errorCode",9) = :prefix',
          {
            source: "G2B",
            status: TenderAwardSyncStatus.FAILED,
            prefix: "TERMINAL_",
          },
        )
        .execute();
      return { resumedCount: result.affected ?? 0 };
    });
  }
  async getStatus() {
    const runs = await this.dataSource
      .getRepository(TenderAwardSyncRun)
      .find({ where: { source: "G2B" }, order: { periodStart: "ASC" } });
    const validSampleCount = await this.dataSource
      .getRepository(TenderAwardResult)
      .createQueryBuilder("award")
      .where(
        "award.isFinalAward = true AND award.isFailedBid = false AND award.basisAmount > 0 AND award.expectedPrice > 0 AND award.winningAmount > 0",
      )
      .getCount();
    return {
      totalWindows: runs.length,
      coverageThrough: awardCoverageThrough(runs),
      terminalFailureCount: runs.filter((run) =>
        run.errorCode?.startsWith("TERMINAL_"),
      ).length,
      completedWindows: runs.filter(
        (run) => run.status === TenderAwardSyncStatus.SUCCEEDED,
      ).length,
      validSampleCount,
      runs: runs.map((run) => ({
        id: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        cursor: run.cursor,
        fetchedCount: run.fetchedCount,
        storedCount: run.storedCount,
        excludedCount: run.excludedCount,
        errorCode: run.errorCode,
        finishedAt: run.finishedAt,
      })),
    };
  }
  private async seed(windows: AwardWindow[]) {
    if (!windows.length) return;
    await this.dataSource
      .getRepository(TenderAwardSyncRun)
      .createQueryBuilder()
      .insert()
      .values(
        windows.map((window) => ({
          source: "G2B",
          periodStart: window.start,
          periodEnd: window.end,
          status: TenderAwardSyncStatus.PARTIAL,
        })),
      )
      .orIgnore()
      .execute();
  }
  private claim(): Promise<TenderAwardSyncRun | null> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const [lock] = await manager.query(
        "SELECT pg_try_advisory_xact_lock($1) AS locked",
        [AWARD_CLAIM_LOCK],
      );
      if (!lock?.locked) return null;
      const repo = manager.getRepository(TenderAwardSyncRun);
      // One terminal service failure pauses its sibling windows too, otherwise
      // replicas would repeat the same rejected key once per historical month.
      if (
        await repo
          .createQueryBuilder("run")
          .where("run.source = :source AND LEFT(run.errorCode,9) = :prefix", {
            source: "G2B",
            prefix: "TERMINAL_",
          })
          .getCount()
      )
        return null;
      const live = await repo
        .createQueryBuilder("run")
        .where(
          "run.source = 'G2B' AND run.leaseToken IS NOT NULL AND run.leaseExpiresAt > CURRENT_TIMESTAMP",
        )
        .getCount();
      if (live) return null;
      const run = await repo
        .createQueryBuilder("run")
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .where(
          "run.source = 'G2B' AND run.status != :status AND (run.errorCode IS NULL OR LEFT(run.errorCode,9) != 'TERMINAL_') AND (run.leaseExpiresAt IS NULL OR run.leaseExpiresAt <= CURRENT_TIMESTAMP)",
          { status: TenderAwardSyncStatus.SUCCEEDED },
        )
        .orderBy("run.periodStart", "ASC")
        .addOrderBy("run.createdAt", "ASC")
        .getOne();
      if (!run) return null;
      const leaseToken = randomUUID();
      await repo.update(run.id, {
        leaseToken,
        leaseExpiresAt: () => "CURRENT_TIMESTAMP + INTERVAL '5 minutes'",
        status: TenderAwardSyncStatus.RUNNING,
        errorCode: null,
      });
      return { ...run, leaseToken };
    });
  }
}
