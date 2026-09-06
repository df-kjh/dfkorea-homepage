import {
  TenderSourceError,
  PublicApiClient,
} from "../adapters/public-api-client";
import { TenderSource } from "../domain/tender.enums";
import { readFileSync } from "fs";
import { join } from "path";
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
  let award: NormalizedAward;
  const awardTemplate: NormalizedAward = {
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
    award = structuredClone(awardTemplate);
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
  it("keeps unknown provider errors safe and resumable after cooldown", async () => {
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
  it.each(["2026-09-28T03:00:00Z", "2026-11-10T03:00:00Z"])(
    "fills every day after delayed backfill or downtime ending %s",
    async (resumedAt) => {
      await service.startBackfill(now);
      const repo = db.getRepository(TenderAwardSyncRun);
      await repo
        .createQueryBuilder()
        .update()
        .set({ status: TenderAwardSyncStatus.SUCCEEDED })
        .execute();
      await new TenderAwardCollectorService(db, {
        fetchWindow,
      } as unknown as G2bAwardAdapter).collectIncremental(new Date(resumedAt));
      const windows = await repo.find({ order: { periodStart: "ASC" } });
      const end = resumedAt.slice(0, 10);
      for (
        let cursor = new Date("2026-09-08");
        cursor <= new Date(end);
        cursor = new Date(cursor.getTime() + 86400000)
      ) {
        const date = cursor.toISOString().slice(0, 10);
        expect(
          windows.some(
            (window) => window.periodStart <= date && window.periodEnd >= date,
          ),
        ).toBe(true);
      }
      expect(fetchWindow).toHaveBeenCalledTimes(1);
    },
  );
  it("catches an internal completed-window gap and stops reseeding after successful catch-up", async () => {
    const repo = db.getRepository(TenderAwardSyncRun);
    await repo.save([
      {
        source: "G2B",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        status: TenderAwardSyncStatus.SUCCEEDED,
      },
      {
        source: "G2B",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        status: TenderAwardSyncStatus.SUCCEEDED,
      },
    ]);
    const resumedAt = new Date("2026-04-15T03:00:00Z");
    await service.collectIncremental(resumedAt);
    expect(
      await repo.findOneBy({
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28",
      }),
    ).not.toBeNull();
    await repo
      .createQueryBuilder()
      .update()
      .set({
        status: TenderAwardSyncStatus.SUCCEEDED,
        leaseToken: null,
        leaseExpiresAt: null,
      })
      .execute();
    const count = await repo.count();
    fetchWindow.mockClear();
    await service.collectIncremental(resumedAt);
    await service.collectIncremental(resumedAt);
    expect(await repo.count()).toBe(count);
    expect(fetchWindow).not.toHaveBeenCalled();
  });
  it("atomically invalidates cancelled stored history while preserving other revisions", async () => {
    await service.startBackfill(now);
    const awards = db.getRepository(TenderAwardResult);
    await awards.save([{ ...award }, { ...award, revision: "001" }]);
    fetchWindow.mockResolvedValueOnce({
      items: [],
      invalidations: [
        {
          kind: "NOTICE_EXCLUDED",
          source: "G2B",
          sourceNoticeId: "fixture",
          revision: "000",
        },
      ],
      nextCursor: "2:0",
      fetchedCount: 1,
      excludedCount: 1,
    });
    await service.collectIncremental(now);
    expect(
      (await awards.findOneByOrFail({ revision: "000" })).isFinalAward,
    ).toBe(false);
    expect(
      (await awards.findOneByOrFail({ revision: "001" })).isFinalAward,
    ).toBe(true);
    expect(
      (
        await db
          .getRepository(TenderAwardSyncRun)
          .findOneByOrFail({ periodStart: "2024-09-07" })
      ).cursor,
    ).toBe("2:0");
    expect((await service.getStatus()).validSampleCount).toBe(1);
  });
  it("reclassification excludes the old product and upserts its replacement in one transaction", async () => {
    await service.startBackfill(now);
    await db.getRepository(TenderAwardResult).save({ ...award });
    fetchWindow.mockResolvedValueOnce({
      items: [{ ...award, productClassification: "3911210202" }],
      invalidations: [
        {
          kind: "SINGLE_ITEM_RECONCILED",
          source: "G2B",
          sourceNoticeId: "fixture",
          revision: "000",
          openedAt: award.openedAt,
          retainedProductClassification: "3911210202",
        },
      ],
      nextCursor: null,
      fetchedCount: 1,
      excludedCount: 0,
    });
    await service.collectIncremental(now);
    const rows = await db.getRepository(TenderAwardResult).find();
    expect(
      rows.find((row) => row.productClassification === "3911210201")
        .isFinalAward,
    ).toBe(false);
    expect(
      rows.find((row) => row.productClassification === "3911210202")
        .isFinalAward,
    ).toBe(true);
  });
  it("rolls back invalidations with a failed result upsert and leaves old cursor/counts intact", async () => {
    await service.startBackfill(now);
    await db.getRepository(TenderAwardResult).save({ ...award });
    fetchWindow.mockResolvedValueOnce({
      items: [{ ...award, winningAmount: "invalid" }],
      invalidations: [
        {
          kind: "NOTICE_EXCLUDED",
          source: "G2B",
          sourceNoticeId: "fixture",
          revision: "000",
        },
      ],
      nextCursor: "2:0",
      fetchedCount: 1,
      excludedCount: 1,
    });
    await service.collectIncremental(now);
    expect(
      (
        await db
          .getRepository(TenderAwardResult)
          .findOneByOrFail({ sourceNoticeId: "fixture" })
      ).isFinalAward,
    ).toBe(true);
    expect(
      await db
        .getRepository(TenderAwardSyncRun)
        .findOneByOrFail({ periodStart: "2024-09-07" }),
    ).toMatchObject({
      cursor: null,
      fetchedCount: 0,
      storedCount: 0,
      excludedCount: 0,
    });
  });
  it.each([403, 401, 400])(
    "never reclaims terminal HTTP %s after cooldown and resumes explicitly",
    async (status) => {
      await service.startBackfill(now);
      fetchWindow.mockRejectedValueOnce(
        new TenderSourceError(
          TenderSource.G2B,
          "HTTP_ERROR",
          status,
          new Error("private provider body"),
        ),
      );
      await service.collectIncremental(now);
      const repo = db.getRepository(TenderAwardSyncRun);
      const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
      await repo.update(run.id, { leaseExpiresAt: new Date(0) });
      fetchWindow.mockClear();
      await service.collectIncremental(new Date("2026-12-01"));
      expect(fetchWindow).not.toHaveBeenCalled();
      expect((await repo.findOneByOrFail({ id: run.id })).errorCode).toBe(
        `TERMINAL_HTTP_${status}`,
      );
      await service["resumeTerminalFailures"]();
      await service.collectIncremental(now);
      expect(fetchWindow).toHaveBeenCalledTimes(1);
      expect((await repo.findOneByOrFail({ id: run.id })).errorCode).toBeNull();
    },
  );
  it.each([429, 500, 503])(
    "reclaims retryable HTTP %s after cooldown",
    async (status) => {
      await service.startBackfill(now);
      fetchWindow.mockRejectedValueOnce(
        new TenderSourceError(TenderSource.G2B, "HTTP_ERROR", status),
      );
      await service.collectIncremental(now);
      const repo = db.getRepository(TenderAwardSyncRun);
      const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
      await repo.update(run.id, { leaseExpiresAt: new Date(0) });
      fetchWindow.mockClear();
      await service.collectIncremental(now);
      expect(fetchWindow).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["20", "30", "31"])(
    "holds terminal provider authentication code %s for explicit resume",
    async (providerCode) => {
      await service.startBackfill(now);
      fetchWindow.mockRejectedValueOnce(
        new TenderSourceError(
          TenderSource.G2B,
          "PROVIDER_RESULT_ERROR",
          200,
          undefined,
          null,
          null,
          providerCode,
        ),
      );
      await service.collectIncremental(now);
      const repo = db.getRepository(TenderAwardSyncRun);
      const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
      await repo.update(run.id, { leaseExpiresAt: new Date(0) });
      fetchWindow.mockClear();
      await service.collectIncremental(now);
      expect(fetchWindow).not.toHaveBeenCalled();
      expect((await repo.findOneByOrFail({ id: run.id })).errorCode).toBe(
        `TERMINAL_PROVIDER_${providerCode}`,
      );
    },
  );
  it.each(["replaced", "expired"])(
    "fences a suspended worker whose lease is %s before its provider returns",
    async (change) => {
      await service.startBackfill(now);
      await db.getRepository(TenderAwardResult).save({ ...award });
      let resolvePage: (page: AwardPage) => void;
      let started: () => void;
      const providerStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      fetchWindow.mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          resolvePage = resolve;
        });
      });
      const pending = service.collectIncremental(now);
      await providerStarted;
      const repo = db.getRepository(TenderAwardSyncRun);
      const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
      const successorToken = randomUUID();
      await repo.update(
        run.id,
        change === "replaced"
          ? { leaseToken: successorToken }
          : { leaseExpiresAt: new Date(0) },
      );
      resolvePage!({
        items: [{ ...award, winningAmount: "1" }],
        invalidations: [
          {
            kind: "NOTICE_EXCLUDED",
            source: "G2B",
            sourceNoticeId: "fixture",
            revision: "000",
          },
        ],
        nextCursor: "99:0",
        fetchedCount: 100,
        excludedCount: 99,
      });
      expect(await pending).toEqual({ processed: false, reason: "LEASE_LOST" });
      expect(await repo.findOneByOrFail({ id: run.id })).toMatchObject({
        cursor: null,
        fetchedCount: 0,
        storedCount: 0,
        excludedCount: 0,
      });
      expect(
        await db
          .getRepository(TenderAwardResult)
          .findOneByOrFail({ sourceNoticeId: "fixture" }),
      ).toMatchObject({ isFinalAward: true, winningAmount: "88700052.00" });
    },
  );

  const actualAdapter = (mutate: (fixture: any) => void) => {
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "../adapters/fixtures/g2b-awards.json"),
        "utf8",
      ),
    );
    mutate(fixture);
    return new G2bAwardAdapter(
      new PublicApiClient(
        async (input) =>
          new Response(
            JSON.stringify(fixture[new URL(input).pathname.split("/").at(-1)!]),
          ),
      ),
      { serviceKey: "fixture-key" },
      undefined,
      (identities) =>
        db.getRepository(TenderAwardResult).find({
          where: identities,
          select: { source: true, sourceNoticeId: true, revision: true },
        }),
    );
  };
  it("reconciles a tracked non-LED title through the real adapter and database", async () => {
    await service.startBackfill(now);
    await db
      .getRepository(TenderAwardResult)
      .save({ ...award, sourceNoticeId: "R26BK01000001" });
    const adapter = actualAdapter((f) => {
      f.getScsbidListSttusThng.response.body.items[0].bidNtceNm = "컴퓨터 총액";
      Object.assign(f.getBidPblancListInfoThng.response.body.items[0], {
        bidNtceNm: "컴퓨터 총액",
        dtilPrdctClsfcNo: "4321150801",
        dtilPrdctClsfcNoNm: "컴퓨터",
      });
      Object.assign(
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0],
        { dtilPrdctClsfcNo: "4321150801", dtilPrdctClsfcNoNm: "컴퓨터" },
      );
    });
    await new TenderAwardCollectorService(db, adapter).collectIncremental(now);
    expect(
      (
        await db
          .getRepository(TenderAwardResult)
          .findOneByOrFail({ sourceNoticeId: "R26BK01000001" })
      ).isFinalAward,
    ).toBe(false);
  });
  it("keeps unrelated persisted lot classifications valid during ambiguous multi-class reconciliation", async () => {
    await service.startBackfill(now);
    await db.getRepository(TenderAwardResult).save([
      { ...award, sourceNoticeId: "R26BK01000001" },
      {
        ...award,
        sourceNoticeId: "R26BK01000001",
        productClassification: "3911210202",
      },
    ]);
    const adapter = actualAdapter((f) => {
      const body = f.getBidPblancListInfoThngPurchsObjPrdct.response.body;
      body.items.push({
        ...body.items[0],
        bidClsfcNo: "2",
        dtilPrdctClsfcNo: "3911210202",
      });
      body.totalCount = "2";
    });
    await new TenderAwardCollectorService(db, adapter).collectIncremental(now);
    expect(
      await db.getRepository(TenderAwardResult).countBy({ isFinalAward: true }),
    ).toBe(2);
    expect(
      (
        await db
          .getRepository(TenderAwardSyncRun)
          .findOneByOrFail({ periodStart: "2024-09-07" })
      ).errorCode,
    ).toBe("AMBIGUOUS_CLASS_IDENTITY");
  });
  it.each(["", "2"])(
    "does not overwrite existing awards from missing/mismatched lot evidence %s",
    async (bidClass) => {
      await service.startBackfill(now);
      await db.getRepository(TenderAwardResult).save({
        ...award,
        sourceNoticeId: "R26BK01000001",
        winningAmount: "123",
      });
      const adapter = actualAdapter((f) => {
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0].bidClsfcNo =
          bidClass;
      });
      await new TenderAwardCollectorService(db, adapter).collectIncremental(
        now,
      );
      expect(
        await db
          .getRepository(TenderAwardResult)
          .findOneByOrFail({ sourceNoticeId: "R26BK01000001" }),
      ).toMatchObject({ winningAmount: "123.00", isFinalAward: true });
    },
  );

  it("does not infer an old lot from multiple active persisted classifications even if the current list has one item", async () => {
    await service.startBackfill(now);
    const repo = db.getRepository(TenderAwardResult);
    await repo.save([
      { ...award, sourceNoticeId: "R26BK01000001" },
      {
        ...award,
        sourceNoticeId: "R26BK01000001",
        productClassification: "3911210202",
      },
    ]);
    const adapter = actualAdapter((f) => {
      f.getBidPblancListInfoThng.response.body.items[0].dtilPrdctClsfcNo =
        "3911210203";
      f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0].dtilPrdctClsfcNo =
        "3911210203";
    });
    await new TenderAwardCollectorService(db, adapter).collectIncremental(now);
    expect(
      (await repo.findOneByOrFail({ productClassification: "3911210201" }))
        .isFinalAward,
    ).toBe(true);
    expect(
      (await repo.findOneByOrFail({ productClassification: "3911210202" }))
        .isFinalAward,
    ).toBe(true);
    expect(
      (
        await db
          .getRepository(TenderAwardSyncRun)
          .findOneByOrFail({ periodStart: "2024-09-07" })
      ).errorCode,
    ).toBe("AMBIGUOUS_CLASS_IDENTITY");
  });
  it.each(["offset", "page"])(
    "never overwrites an existing persisted identity as colliding classes advance %s cursors",
    async (mode) => {
      await service.startBackfill(now);
      const awards = db.getRepository(TenderAwardResult);
      await awards.save({
        ...award,
        sourceNoticeId: "R26BK01000001",
        winningAmount: "123.45",
      });
      let finalBody: any;
      const adapter = actualAdapter((f) => {
        finalBody = f.getScsbidListSttusThng.response.body;
        for (const op of [
          "getBidPblancListInfoThngPurchsObjPrdct",
          "getOpengResultListInfoThngPreparPcDetail",
          "getScsbidListSttusThng",
        ]) {
          const body = f[op].response.body;
          body.items.push({
            ...body.items[0],
            bidClsfcNo: "2",
            sucsfbidAmt: "999.99",
          });
          body.totalCount = "2";
        }
        if (mode === "page") {
          finalBody.items = [finalBody.items[0]];
          finalBody.totalCount = "101";
        }
      });
      const collector = new TenderAwardCollectorService(db, adapter);
      for (let tick = 0; tick < 2; tick++) {
        if (mode === "page" && tick === 1) finalBody.items[0].bidClsfcNo = "2";
        expect(await collector.collectIncremental(now)).toEqual({
          processed: true,
        });
        expect(
          await awards.findOneByOrFail({ sourceNoticeId: "R26BK01000001" }),
        ).toMatchObject({ winningAmount: "123.45", isFinalAward: true });
      }
      const run = await db
        .getRepository(TenderAwardSyncRun)
        .findOneByOrFail({ periodStart: "2024-09-07" });
      expect(run).toMatchObject({
        cursor: null,
        fetchedCount: 2,
        storedCount: 0,
        excludedCount: 2,
        errorCode: "AMBIGUOUS_CLASS_IDENTITY",
      });
    },
  );
  it.each(["취소공고", "등록공고"])(
    "preserves persisted data on incomplete %s details",
    async (status) => {
      await service.startBackfill(now);
      const awards = db.getRepository(TenderAwardResult);
      await awards.save({
        ...award,
        sourceNoticeId: "R26BK01000001",
        winningAmount: "123.45",
      });
      const adapter = actualAdapter((f) => {
        const body = f.getBidPblancListInfoThng.response.body;
        body.totalCount = "2";
        body.items[0].ntceKindNm = status;
      });
      await new TenderAwardCollectorService(db, adapter).collectIncremental(
        now,
      );
      expect(
        await awards.findOneByOrFail({ sourceNoticeId: "R26BK01000001" }),
      ).toMatchObject({ winningAmount: "123.45", isFinalAward: true });
      expect((await service.getStatus()).runs[0].errorCode).toBe(
        "INCOMPLETE_AWARD_EVIDENCE",
      );
    },
  );
  it("retains review diagnostics across clean pages, failed claims and completion", async () => {
    await service.startBackfill(now);
    fetchWindow.mockResolvedValueOnce({
      items: [],
      invalidations: [],
      diagnostics: ["AMBIGUOUS_CLASS_IDENTITY"],
      nextCursor: "1:1",
      fetchedCount: 1,
      excludedCount: 1,
    });
    await service.collectIncremental(now);
    await service.collectIncremental(now);
    expect((await service.getStatus()).runs[0].errorCode).toBe(
      "AMBIGUOUS_CLASS_IDENTITY",
    );
    fetchWindow.mockRejectedValueOnce(
      new TenderSourceError(TenderSource.G2B, "HTTP_ERROR", 403),
    );
    await service.collectIncremental(now);
    expect((await service.getStatus()).runs[0].errorCode).toBe(
      "TERMINAL_HTTP_403|AMBIGUOUS_CLASS_IDENTITY",
    );
    expect(await service.collectIncremental(now)).toEqual({
      processed: false,
      reason: "TERMINAL_FAILURE",
    });
  });
  it("retains an earlier review through a later clean final page after restart", async () => {
    await service.startBackfill(now);
    fetchWindow.mockResolvedValueOnce({
      items: [],
      diagnostics: ["AMBIGUOUS_CLASS_IDENTITY"],
      nextCursor: "1:1",
      fetchedCount: 1,
      excludedCount: 1,
    });
    await service.collectIncremental(now);
    fetchWindow.mockResolvedValueOnce({
      items: [award],
      nextCursor: null,
      fetchedCount: 1,
      excludedCount: 0,
    });
    const restarted = new TenderAwardCollectorService(db, {
      fetchWindow,
    } as unknown as G2bAwardAdapter);
    await restarted.collectIncremental(now);
    expect((await restarted.getStatus()).runs[0]).toMatchObject({
      status: TenderAwardSyncStatus.SUCCEEDED,
      errorCode: "AMBIGUOUS_CLASS_IDENTITY",
      fetchedCount: 2,
    });
  });

  it("explicitly acknowledges reviews without clearing a terminal failure or counters", async () => {
    await service.startBackfill(now);
    const repo = db.getRepository(TenderAwardSyncRun);
    const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
    await repo.update(run.id, {
      errorCode:
        "TERMINAL_HTTP_403|AMBIGUOUS_CLASS_IDENTITY|INCOMPLETE_AWARD_EVIDENCE",
      status: TenderAwardSyncStatus.FAILED,
      cursor: "3:7",
      fetchedCount: 207,
    });
    expect(await service.resetReconciliationDiagnostics(run.id)).toEqual({
      cleared: true,
    });
    expect(await repo.findOneByOrFail({ id: run.id })).toMatchObject({
      errorCode: "TERMINAL_HTTP_403",
      status: TenderAwardSyncStatus.FAILED,
      cursor: "3:7",
      fetchedCount: 207,
    });
    expect(await service.collectIncremental(now)).toEqual({
      processed: false,
      reason: "TERMINAL_FAILURE",
    });
    expect(await service.resetReconciliationDiagnostics(run.id)).toEqual({
      cleared: false,
    });
  });
  it("retains review during an active claim and refuses operator reset until worker completion", async () => {
    await service.startBackfill(now);
    const repo = db.getRepository(TenderAwardSyncRun);
    const run = await repo.findOneByOrFail({ periodStart: "2024-09-07" });
    await repo.update(run.id, { errorCode: "AMBIGUOUS_CLASS_IDENTITY" });
    let finish!: (page: AwardPage) => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchWindow.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = service.collectIncremental(now);
    await waiting;
    try {
      expect((await service.getStatus()).runs[0].errorCode).toBe(
        "AMBIGUOUS_CLASS_IDENTITY",
      );
      expect(await service.resetReconciliationDiagnostics(run.id)).toEqual({
        cleared: false,
      });
    } finally {
      finish({
        items: [],
        nextCursor: null,
        fetchedCount: 0,
        excludedCount: 0,
      });
      await pending;
    }
    expect(await service.resetReconciliationDiagnostics(run.id)).toEqual({
      cleared: true,
    });
    expect((await service.getStatus()).runs[0]).toMatchObject({
      errorCode: null,
      status: TenderAwardSyncStatus.SUCCEEDED,
    });
  });
});
