import { DataSource } from "typeorm";
import {
  TenderAwardCollectorService,
  monthlyAwardWindows,
} from "./tender-award-collector.service";
import { TenderAwardSyncRun } from "../entities/tender-award-sync-run.entity";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
import {
  G2bAwardAdapter,
  AwardPage,
  NormalizedAward,
} from "../adapters/g2b-award.adapter";
import { TenderAwardSyncStatus } from "../domain/tender-analysis.enums";
import { randomUUID } from "crypto";

const now = new Date("2026-09-07T03:00:00Z");
it("covers exactly two calendar years in contiguous KST monthly date windows, including leap days", () => {
  const windows = monthlyAwardWindows(now);
  expect(windows[0]).toEqual({ start: "2024-09-07", end: "2024-09-30" });
  expect(windows.at(-1)).toEqual({ start: "2026-09-01", end: "2026-09-07" });
  expect(windows).toHaveLength(25);
  for (let i = 1; i < windows.length; i++)
    expect(
      new Date(windows[i].start).getTime() -
        new Date(windows[i - 1].end).getTime(),
    ).toBe(86400000);
  expect(monthlyAwardWindows(new Date("2024-02-29T01:00:00Z"))[0].start).toBe(
    "2022-02-28",
  );
});

const databaseUrl = process.env.TASK6_TEST_DATABASE_URL;
// Opt-in PostgreSQL exercises real transactions and replica locking; never uses
// the application database URL or changes any existing application tables.
const postgres = databaseUrl ? describe : describe.skip;
postgres("award collector PostgreSQL repository boundary", () => {
  let db: DataSource;
  const schema = `award_test_${randomUUID().replace(/-/g, "")}`;
  let service: TenderAwardCollectorService;
  let fetchWindow: jest.Mock<Promise<AwardPage>, [unknown, unknown]>;
  const award: NormalizedAward = {
    source: "G2B",
    sourceNoticeId: "fixture",
    revision: "000",
    productClassification: "3911210201",
    productGroup: "LED",
    awardMethod: "적격심사",
    region: null,
    openedAt: new Date("2026-09-01T01:00:00Z"),
    basisAmount: "100000000",
    expectedPrice: "99820000",
    winningAmount: "88700052",
    adjustmentRate: "0.998200",
    winningRate: "0.888600",
    isFinalAward: true,
    isFailedBid: false,
  };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.endsWith("_test")
    )
      throw new Error("Use a dedicated local *_test database");
    db = await new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [TenderAwardSyncRun, TenderAwardResult],
      synchronize: false,
    }).initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.synchronize();
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });
  beforeEach(async () => {
    await db.getRepository(TenderAwardSyncRun).clear();
    await db.getRepository(TenderAwardResult).clear();
    fetchWindow = jest.fn().mockResolvedValue({
      items: [award],
      nextCursor: "1:1",
      fetchedCount: 1,
      excludedCount: 0,
    });
    service = new TenderAwardCollectorService(db, {
      fetchWindow,
    } as unknown as G2bAwardAdapter);
  });
  it("persists windows idempotently without starting provider work", async () => {
    await service.startBackfill(now);
    await service.startBackfill(now);
    expect(await db.getRepository(TenderAwardSyncRun).count()).toBe(25);
    expect(fetchWindow).not.toHaveBeenCalled();
  });
  it("upserts duplicate identities, resumes cursor after restart, and publishes safe status", async () => {
    await service.startBackfill(now);
    await service.collectIncremental(now);
    const run = await db
      .getRepository(TenderAwardSyncRun)
      .findOneByOrFail({ periodStart: "2024-09-07" });
    expect(run.cursor).toBe("1:1");
    expect(await db.getRepository(TenderAwardResult).count()).toBe(1);
    fetchWindow.mockResolvedValueOnce({
      items: [{ ...award, winningAmount: "88700053" }],
      nextCursor: null,
      fetchedCount: 1,
      excludedCount: 0,
    });
    await new TenderAwardCollectorService(db, {
      fetchWindow,
    } as unknown as G2bAwardAdapter).collectIncremental(now);
    expect(fetchWindow.mock.calls[1][1]).toBe("1:1");
    expect(await db.getRepository(TenderAwardResult).count()).toBe(1);
    expect(
      (
        await db
          .getRepository(TenderAwardResult)
          .findOneByOrFail({ sourceNoticeId: "fixture" })
      ).winningAmount,
    ).toBe("88700053.00");
    const status = await service.getStatus();
    expect(status.validSampleCount).toBe(1);
    expect(JSON.stringify(status)).not.toMatch(/leaseToken|fixture-key/);
  });
  it("does not advance a cursor if the result transaction fails", async () => {
    await service.startBackfill(now);
    fetchWindow.mockResolvedValueOnce({
      items: [{ ...award, winningAmount: "invalid numeric" }],
      nextCursor: "2:0",
      fetchedCount: 1,
      excludedCount: 0,
    });
    await service.collectIncremental(now);
    expect(
      (
        await db
          .getRepository(TenderAwardSyncRun)
          .findOneByOrFail({ periodStart: "2024-09-07" })
      ).cursor,
    ).toBeNull();
    expect(await db.getRepository(TenderAwardResult).count()).toBe(0);
  });
  it("a second replica cannot claim or fetch while a live collector lease exists", async () => {
    await service.startBackfill(now);
    let release: (page: AwardPage) => void;
    let started: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchWindow.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = service.collectIncremental(now);
    await providerStarted;
    const second = await new TenderAwardCollectorService(db, {
      fetchWindow,
    } as unknown as G2bAwardAdapter).collectIncremental(now);
    expect(second).toMatchObject({ processed: false });
    expect(fetchWindow).toHaveBeenCalledTimes(1);
    release!({
      items: [award],
      nextCursor: null,
      fetchedCount: 1,
      excludedCount: 0,
    });
    await first;
  });
  it("resumes an expired lease but rejects stale worker writes", async () => {
    await service.startBackfill(now);
    const repo = db.getRepository(TenderAwardSyncRun);
    const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
    await repo.update(run.id, {
      leaseToken: randomUUID(),
      leaseExpiresAt: new Date(0),
      cursor: "3:0",
    });
    await service.collectIncremental(now);
    expect(fetchWindow.mock.calls[0][1]).toBe("3:0");
    expect((await repo.findOneByOrFail({ id: run.id })).leaseToken).toBeNull();
  });
  it("skips the ordinary hourly collection capacity and only performs one page budget", async () => {
    await service.startBackfill(now);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.query("SELECT pg_advisory_lock($1)", [824001]);
    try {
      expect(await service.collectIncremental(now)).toMatchObject({
        processed: false,
      });
      expect(fetchWindow).not.toHaveBeenCalled();
    } finally {
      await runner.query("SELECT pg_advisory_unlock($1)", [824001]);
      await runner.release();
    }
  });
  it("keeps terminal provider errors safe and resumable after cooldown", async () => {
    await service.startBackfill(now);
    fetchWindow.mockRejectedValueOnce(new Error("fixture-key payload"));
    await service.collectIncremental(now);
    const run = await db
      .getRepository(TenderAwardSyncRun)
      .findOneByOrFail({ periodStart: "2024-09-07" });
    expect(run.status).toBe(TenderAwardSyncStatus.FAILED);
    expect(run.errorCode).toBe("AWARD_COLLECTION_FAILED");
    expect(run.cursor).toBeNull();
  });
});
