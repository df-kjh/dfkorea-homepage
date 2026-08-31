import { NormalizedTender } from "../domain/normalized-tender";
import { TenderClassifier } from "../domain/tender-classifier";
import {
  TenderSourceAdapter,
  TenderSourceFetchResult,
} from "../domain/tender-source.adapter";
import {
  ProcurementType,
  SyncRunStatus,
  TenderOpportunityType,
  TenderRelevance,
  TenderSource,
} from "../domain/tender.enums";
import { TenderSourceError } from "../adapters/public-api-client";
import { TenderIngestionService } from "./tender-ingestion.service";
import { TenderOpportunityClassifier } from "../domain/tender-opportunity-classifier";

const NOW = new Date("2026-08-27T03:00:00.000Z");

const directNotice: NormalizedTender = {
  source: TenderSource.G2B,
  sourceNoticeId: "G2B-1",
  revision: "0",
  title: "LED 가로등 교체공사",
  orderingOrganization: "서울시",
  demandOrganization: null,
  registeredAt: new Date("2026-08-26T03:00:00.000Z"),
  bidStartedAt: null,
  bidEndedAt: null,
  openedAt: null,
  region: "서울",
  procurementType: ProcurementType.CONSTRUCTION,
  contractMethod: null,
  estimatedAmount: "1000000",
  sourceUrl: "https://example.invalid/g2b/1",
  itemName: "LED 등기구",
  description: "공용부 조명 교체",
  attachmentNames: ["spec.pdf"],
  licenseLimits: [],
  licenseLimitsVerified: true,
  rawData: { bidNtceNo: "G2B-1" },
};

const potentialNotice: NormalizedTender = {
  ...directNotice,
  source: TenderSource.KAPT,
  sourceNoticeId: "KAPT-1",
  title: "전기시설 개선공사",
  itemName: "",
  description: "",
  rawData: { bidNum: "KAPT-1" },
};

const irrelevantNotice: NormalizedTender = {
  ...directNotice,
  sourceNoticeId: "G2B-irrelevant",
  title: "구내식당 식자재 구매",
  itemName: "",
  description: "",
};

const createAdapter = (source: TenderSource): jest.Mocked<TenderSourceAdapter> =>
  ({ source, fetchNotices: jest.fn() });

const successfulFetch = (
  notices: NormalizedTender[] = [],
): TenderSourceFetchResult => ({
  notices,
  status: SyncRunStatus.SUCCEEDED,
  errorCode: null,
});

const createBodyThrowingAdapters = (thrown: unknown): TenderSourceAdapter[] =>
  new Proxy([] as TenderSourceAdapter[], {
    get(target, property, receiver) {
      if (property === "map") {
        throw thrown;
      }
      return Reflect.get(target, property, receiver);
    },
  });

describe("TenderIngestionService", () => {
  let g2b: jest.Mocked<TenderSourceAdapter>;
  let kapt: jest.Mocked<TenderSourceAdapter>;
  let kepco: jest.Mocked<TenderSourceAdapter>;
  let syncRunRepository: { findOne: jest.Mock; save: jest.Mock };
  let tenderRepository: { find: jest.Mock; upsert: jest.Mock };
  let lockRunner: { query: jest.Mock; connect: jest.Mock; release: jest.Mock };
  let dataSource: {
    createQueryRunner: jest.Mock;
    transaction: jest.Mock;
  };
  let service: TenderIngestionService;

  beforeEach(() => {
    g2b = createAdapter(TenderSource.G2B);
    kapt = createAdapter(TenderSource.KAPT);
    kepco = createAdapter(TenderSource.KEPCO);
    syncRunRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (value) => ({ id: "run-id", ...value })),
    };
    tenderRepository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    lockRunner = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([{ unlocked: true }]),
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(lockRunner),
      transaction: jest.fn().mockImplementation(async (work) =>
        work({ getRepository: () => tenderRepository }),
      ),
    };
    service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      [g2b, kapt, kepco],
    );
  });

  it("fetches each provider across the initial preceding 24 hours", async () => {
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(g2b.fetchNotices).toHaveBeenCalledWith({
      from: new Date("2026-08-26T03:00:00.000Z"),
      to: NOW,
    });
  });

  it("overlaps the previous successful source run by one hour", async () => {
    syncRunRepository.findOne.mockResolvedValue({
      finishedAt: new Date("2026-08-27T01:30:00.000Z"),
    });
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(g2b.fetchNotices).toHaveBeenCalledWith({
      from: new Date("2026-08-27T00:30:00.000Z"),
      to: NOW,
    });
  });

  it("excludes irrelevant notices and persists classifier evidence for relevant notices", async () => {
    g2b.fetchNotices.mockResolvedValue(
      successfulFetch([directNotice, irrelevantNotice]),
    );
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(tenderRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source: TenderSource.G2B,
          sourceNoticeId: "G2B-1",
          relevance: TenderRelevance.DIRECT,
          relevanceReasons: expect.arrayContaining([
            expect.objectContaining({ keyword: "LED" }),
          ]),
          opportunityType: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
          opportunityReasons: ["공사 업무구분"],
          rawData: { bidNtceNo: "G2B-1" },
        }),
      ],
      expect.objectContaining({
        conflictPaths: ["source", "sourceNoticeId", "revision"],
      }),
    );
    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.G2B,
        status: SyncRunStatus.SUCCEEDED,
        fetchedCount: 2,
        excludedCount: 1,
      }),
    );
  });

  it("uses the source identity and revision to distinguish inserts from mutable updates", async () => {
    tenderRepository.find.mockResolvedValue([
      {
        source: TenderSource.G2B,
        sourceNoticeId: "G2B-1",
        revision: "0",
      },
    ]);
    g2b.fetchNotices.mockResolvedValue(
      successfulFetch([
        {
          ...directNotice,
          title: "MAS LED 조명",
          procurementType: ProcurementType.GOODS,
        },
      ]),
    );
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.G2B,
        createdCount: 0,
        updatedCount: 1,
      }),
    );
    expect(tenderRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          title: "MAS LED 조명",
          opportunityType: TenderOpportunityType.MAS,
          opportunityReasons: ["MAS 표현: 제목"],
        }),
      ],
      expect.objectContaining({
        conflictPaths: ["source", "sourceNoticeId", "revision"],
      }),
    );
  });

  it("continues after one provider fails and records each source outcome", async () => {
    g2b.fetchNotices.mockRejectedValue(
      new TenderSourceError(TenderSource.G2B, "HTTP_ERROR", 503),
    );
    kapt.fetchNotices.mockResolvedValue(successfulFetch([potentialNotice]));
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    const summary = await service.collectAll(NOW);

    expect(summary.failedSources).toEqual([TenderSource.G2B]);
    expect(tenderRepository.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ source: TenderSource.KAPT })],
      expect.anything(),
    );
    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.G2B,
        status: SyncRunStatus.FAILED,
        errorCode: "HTTP_ERROR",
      }),
    );
    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.KAPT,
        status: SyncRunStatus.SUCCEEDED,
      }),
    );
  });

  it("persists notices and reports PARTIAL when only G2B license enrichment is unavailable", async () => {
    const partialNotices: NormalizedTender[] = [
      { ...directNotice, licenseLimitsVerified: false } as NormalizedTender,
      {
        ...directNotice,
        sourceNoticeId: "G2B-GOODS",
        title: "LED 조명기구 구매",
        procurementType: ProcurementType.GOODS,
        licenseLimitsVerified: false,
      } as NormalizedTender,
      {
        ...directNotice,
        sourceNoticeId: "G2B-SERVICE",
        title: "LED 조명 유지관리 용역",
        procurementType: ProcurementType.SERVICE,
        licenseLimitsVerified: false,
      } as NormalizedTender,
    ];
    g2b.fetchNotices.mockResolvedValue({
      notices: partialNotices,
      status: "PARTIAL",
      errorCode: "LICENSE_LIMIT_UNAVAILABLE",
    } as never);
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    const summary = await service.collectAll(NOW);

    expect(summary.failedSources).toEqual([]);
    expect(summary.sources).toContainEqual(
      expect.objectContaining({
        source: TenderSource.G2B,
        status: "PARTIAL",
        fetchedCount: 3,
        errorCode: "LICENSE_LIMIT_UNAVAILABLE",
      }),
    );
    expect(tenderRepository.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNoticeId: "G2B-1",
          opportunityType: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
        }),
        expect.objectContaining({
          sourceNoticeId: "G2B-GOODS",
          opportunityType: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
          opportunityReasons: ["면허제한 정보 확인 불가"],
        }),
        expect.objectContaining({
          sourceNoticeId: "G2B-SERVICE",
          opportunityType: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
        }),
      ]),
      expect.objectContaining({
        conflictPaths: ["source", "sourceNoticeId", "revision"],
      }),
    );
    expect(syncRunRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TenderSource.G2B,
        status: "PARTIAL",
        fetchedCount: 3,
        errorCode: "LICENSE_LIMIT_UNAVAILABLE",
        errorMessage: null,
      }),
    );
    expect(JSON.stringify(summary)).not.toContain("serviceKey");
  });

  it("does not collect when another process owns the advisory lock", async () => {
    lockRunner.query.mockReset();
    lockRunner.query.mockResolvedValue([{ locked: false }]);

    const summary = await service.collectAll(NOW);

    expect(summary.lockAcquired).toBe(false);
    expect(g2b.fetchNotices).not.toHaveBeenCalled();
    expect(lockRunner.query).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [824001],
    );
    expect(lockRunner.release).toHaveBeenCalledTimes(1);
  });

  it("uses one session-pinned runner to acquire and release the advisory lock", async () => {
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(lockRunner.connect).toHaveBeenCalledTimes(1);
    expect(lockRunner.query).toHaveBeenNthCalledWith(
      1,
      "SELECT pg_try_advisory_lock($1) AS locked",
      [824001],
    );
    expect(lockRunner.query).toHaveBeenNthCalledWith(
      2,
      "SELECT pg_advisory_unlock($1) AS unlocked",
      [824001],
    );
  });

  it("unlocks before releasing the session when source collection fails", async () => {
    g2b.fetchNotices.mockRejectedValue(new Error("upstream failed"));
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await service.collectAll(NOW);

    expect(lockRunner.query).toHaveBeenLastCalledWith(
      "SELECT pg_advisory_unlock($1) AS unlocked",
      [824001],
    );
    expect(lockRunner.release.mock.invocationCallOrder[0]).toBeGreaterThan(
      lockRunner.query.mock.invocationCallOrder[1],
    );
  });

  it("unlocks and releases the runner when the collection body throws", async () => {
    const throwingAdapters = new Proxy([] as TenderSourceAdapter[], {
      get(target, property, receiver) {
        if (property === "map") {
          throw new Error("collection body failed");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      throwingAdapters,
    );

    await expect(service.collectAll(NOW)).rejects.toThrow("collection body failed");

    expect(lockRunner.query).toHaveBeenLastCalledWith(
      "SELECT pg_advisory_unlock($1) AS unlocked",
      [824001],
    );
    expect(lockRunner.release).toHaveBeenCalledTimes(1);
  });

  it("keeps a collection failure primary when advisory-lock cleanup also fails", async () => {
    const collectionError = new Error("collection body failed");
    const unlockError = new Error("unlock failed");
    const releaseError = new Error("release failed");
    lockRunner.query.mockReset();
    lockRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockRejectedValueOnce(unlockError);
    lockRunner.release.mockRejectedValue(releaseError);
    service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      new Proxy([] as TenderSourceAdapter[], {
        get(target, property, receiver) {
          if (property === "map") {
            throw collectionError;
          }
          return Reflect.get(target, property, receiver);
        },
      }),
    );

    await expect(service.collectAll(NOW)).rejects.toMatchObject({
      name: "AggregateError",
      errors: [collectionError, unlockError, releaseError],
    });
    expect(lockRunner.release.mock.invocationCallOrder[0]).toBeGreaterThan(
      lockRunner.query.mock.invocationCallOrder[1],
    );
  });

  it("propagates an unlock failure after a successful collection", async () => {
    const unlockError = new Error("unlock failed");
    lockRunner.query.mockReset();
    lockRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockRejectedValueOnce(unlockError);
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await expect(service.collectAll(NOW)).rejects.toBe(unlockError);
    expect(lockRunner.release).toHaveBeenCalledTimes(1);
  });

  it("propagates a release failure after a successful collection", async () => {
    const releaseError = new Error("release failed");
    lockRunner.release.mockRejectedValue(releaseError);
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await expect(service.collectAll(NOW)).rejects.toBe(releaseError);
  });

  it("preserves both cleanup failures after a successful collection", async () => {
    const unlockError = new Error("unlock failed");
    const releaseError = new Error("release failed");
    lockRunner.query.mockReset();
    lockRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockRejectedValueOnce(unlockError);
    lockRunner.release.mockRejectedValue(releaseError);
    g2b.fetchNotices.mockResolvedValue(successfulFetch());
    kapt.fetchNotices.mockResolvedValue(successfulFetch());
    kepco.fetchNotices.mockResolvedValue(successfulFetch());

    await expect(service.collectAll(NOW)).rejects.toMatchObject({
      name: "AggregateError",
      errors: [unlockError, releaseError],
    });
  });

  it("propagates an undefined collection throw instead of returning a summary", async () => {
    service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      createBodyThrowingAdapters(undefined),
    );

    await expect(service.collectAll(NOW)).rejects.toBeUndefined();
    expect(lockRunner.release).toHaveBeenCalledTimes(1);
  });

  it("preserves a null collection throw before cleanup errors", async () => {
    const unlockError = new Error("unlock failed");
    lockRunner.query.mockReset();
    lockRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockRejectedValueOnce(unlockError);
    service = new TenderIngestionService(
      dataSource as never,
      syncRunRepository as never,
      new TenderClassifier(),
      new TenderOpportunityClassifier(),
      createBodyThrowingAdapters(null),
    );

    await expect(service.collectAll(NOW)).rejects.toMatchObject({
      name: "AggregateError",
      errors: [null, unlockError],
    });
  });
});
