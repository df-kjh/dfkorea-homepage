import {
  kstDay,
  splitWindows,
  monthlyAwardWindows,
} from "../domain/tender-award-window";
export { monthlyAwardWindows } from "../domain/tender-award-window";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { DataSource, EntityManager } from "typeorm";
import { G2bAwardAdapter, AwardWindow } from "../adapters/g2b-award.adapter";
import { TenderSourceError } from "../adapters/public-api-client";
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
        const pending = await this.dataSource
          .getRepository(TenderAwardSyncRun)
          .createQueryBuilder("run")
          .where("run.status != :status", {
            status: TenderAwardSyncStatus.SUCCEEDED,
          })
          .getCount();
        if (pending) return { processed: false, reason: "LEASE_OR_COOLDOWN" };
        const end = new Date(kstDay(now));
        const start = new Date(end.getTime() - 6 * 86400000);
        await this.seed(splitWindows(start, end));
        run = await this.claim();
      }
      if (!run) return { processed: false, reason: "UP_TO_DATE" };
      try {
        const page = await this.adapter.fetchWindow(
          { start: run.periodStart, end: run.periodEnd },
          run.cursor,
        );
        await this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(TenderAwardSyncRun);
          const owned = await repo
            .createQueryBuilder("run")
            .setLock("pessimistic_write")
            .where(
              "run.id = :id AND run.leaseToken = :token AND run.leaseExpiresAt > CURRENT_TIMESTAMP",
              { id: run.id, token: run.leaseToken },
            )
            .getOne();
          if (!owned) return;
          // Fenced row lock and result upserts share a transaction with the cursor.
          // A crash cannot acknowledge data that rolled back; expired workers cannot
          // overwrite a successor's results, even after completing their HTTP call.
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
            errorCode: null,
            finishedAt: page.nextCursor ? null : new Date(),
          });
        });
        return { processed: true };
      } catch (error) {
        // Only a bounded code is persisted. Raw DB/provider failures can contain
        // personal data and credentials, so do not serialize messages or causes.
        await this.dataSource
          .getRepository(TenderAwardSyncRun)
          .createQueryBuilder()
          .update()
          .set({
            status: TenderAwardSyncStatus.FAILED,
            errorCode:
              error instanceof TenderSourceError
                ? error.code
                : "AWARD_COLLECTION_FAILED",
            leaseToken: null,
            leaseExpiresAt: () => "CURRENT_TIMESTAMP + INTERVAL '5 minutes'",
          })
          .where('id = :id AND "leaseToken" = :token', {
            id: run.id,
            token: run.leaseToken,
          })
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
  async getStatus() {
    const runs = await this.dataSource
      .getRepository(TenderAwardSyncRun)
      .find({ order: { periodStart: "ASC" } });
    const validSampleCount = await this.dataSource
      .getRepository(TenderAwardResult)
      .createQueryBuilder("award")
      .where(
        "award.isFinalAward = true AND award.isFailedBid = false AND award.basisAmount > 0 AND award.expectedPrice > 0 AND award.winningAmount > 0",
      )
      .getCount();
    return {
      totalWindows: runs.length,
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
      const live = await repo
        .createQueryBuilder("run")
        .where(
          "run.leaseToken IS NOT NULL AND run.leaseExpiresAt > CURRENT_TIMESTAMP",
        )
        .getCount();
      if (live) return null;
      const run = await repo
        .createQueryBuilder("run")
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .where(
          "run.status != :status AND (run.leaseExpiresAt IS NULL OR run.leaseExpiresAt <= CURRENT_TIMESTAMP)",
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
