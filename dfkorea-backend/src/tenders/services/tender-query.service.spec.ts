import {
  TenderRelevance,
  TenderSource,
  ProcurementType,
} from "../domain/tender.enums";
import { TenderQueryService } from "./tender-query.service";

const createQueryBuilder = () => {
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    setParameters: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getRawMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };
  Object.values(builder).forEach((method) => {
    if (typeof method === "function") {
      (method as jest.Mock).mockReturnValue(builder);
    }
  });
  return builder;
};

describe("TenderQueryService", () => {
  let repository: { createQueryBuilder: jest.Mock };
  let service: TenderQueryService;

  beforeEach(() => {
    repository = { createQueryBuilder: jest.fn() };
    service = new TenderQueryService(repository as never);
  });

  it("hides persisted non-goods G2B notices from calendar, list, and detail queries", async () => {
    const visibilityCondition =
      "(tender.source <> :visibleG2bSource OR tender.procurementType = :visibleG2bProcurementType)";
    const visibilityParameters = {
      visibleG2bSource: TenderSource.G2B,
      visibleG2bProcurementType: ProcurementType.GOODS,
    };

    const calendarBuilder = createQueryBuilder();
    calendarBuilder.getRawMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValueOnce(calendarBuilder);
    await service.getCalendar("2026-08");

    const listBuilder = createQueryBuilder();
    listBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    repository.createQueryBuilder.mockReturnValueOnce(listBuilder);
    await service.getTenders({ page: 1, pageSize: 20 });

    const detailBuilder = createQueryBuilder();
    detailBuilder.getOne.mockResolvedValue(null);
    repository.createQueryBuilder.mockReturnValueOnce(detailBuilder);
    await service.getTender("00000000-0000-4000-8000-000000000001");

    for (const builder of [calendarBuilder, listBuilder, detailBuilder]) {
      expect(builder.andWhere).toHaveBeenCalledWith(
        visibilityCondition,
        visibilityParameters,
      );
    }
  });

  it("groups registrations by Korea Standard Time calendar date", async () => {
    const builder = createQueryBuilder();
    builder.getRawMany.mockResolvedValue([
      { date: "2026-08-01", relevance: TenderRelevance.DIRECT, count: "2" },
      { date: "2026-08-01", relevance: TenderRelevance.POTENTIAL, count: "3" },
    ]);
    repository.createQueryBuilder.mockReturnValue(builder);

    await expect(service.getCalendar("2026-08")).resolves.toEqual([
      { date: "2026-08-01", total: 5, direct: 2, potential: 3 },
    ]);
    expect(builder.where).toHaveBeenCalledWith(
      "tender.registeredAt >= :start AND tender.registeredAt < :end",
      {
        start: new Date("2026-07-31T15:00:00.000Z"),
        end: new Date("2026-08-31T15:00:00.000Z"),
      },
    );
    expect(builder.groupBy).toHaveBeenCalledWith(
      "(tender.registeredAt AT TIME ZONE 'Asia/Seoul')::date",
    );
  });

  it("uses an exclusive next-month bound for December", async () => {
    const builder = createQueryBuilder();
    builder.getRawMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(builder);

    await service.getCalendar("2026-12");

    expect(builder.where).toHaveBeenCalledWith(
      "tender.registeredAt >= :start AND tender.registeredAt < :end",
      {
        start: new Date("2026-11-30T15:00:00.000Z"),
        end: new Date("2026-12-31T15:00:00.000Z"),
      },
    );
  });

  it("applies the shared list filters before grouping calendar counts", async () => {
    const builder = createQueryBuilder();
    builder.getRawMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(builder);

    await service.getCalendar("2026-08", {
      keyword: "LED%_!",
      source: TenderSource.G2B,
      region: "서울",
      procurementType: ProcurementType.GOODS,
      relevance: TenderRelevance.DIRECT,
    });

    expect(builder.andWhere).toHaveBeenCalledWith(
      "(tender.title ILIKE :keyword ESCAPE '!' OR tender.orderingOrganization ILIKE :keyword ESCAPE '!' OR tender.demandOrganization ILIKE :keyword ESCAPE '!')",
      { keyword: "%LED!%!_!!%" },
    );
    expect(builder.andWhere).toHaveBeenCalledWith("tender.source = :source", {
      source: TenderSource.G2B,
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      "tender.region ILIKE :region ESCAPE '!'",
      { region: "%서울%" },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      "tender.procurementType = :procurementType",
      { procurementType: ProcurementType.GOODS },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      "tender.relevance = :relevance",
      { relevance: TenderRelevance.DIRECT },
    );
  });

  it("partially matches regions while escaping PostgreSQL LIKE metacharacters", async () => {
    const builder = createQueryBuilder();
    builder.getRawMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(builder);

    await service.getCalendar("2026-08", { region: "서울!%_" });

    expect(builder.andWhere).toHaveBeenCalledWith(
      "tender.region ILIKE :region ESCAPE '!'",
      { region: "%서울!!!%!_%" },
    );
  });

  it("combines independent list filters, escapes wildcard keyword input, and paginates newest first", async () => {
    const builder = createQueryBuilder();
    const tender = {
      id: "00000000-0000-4000-8000-000000000001",
      source: TenderSource.G2B,
      sourceNoticeId: "A-1",
      revision: "000",
      title: "LED 조명 교체",
      orderingOrganization: "서울시",
      demandOrganization: "교육청",
      registeredAt: new Date("2026-08-10T04:00:00.000Z"),
      bidStartedAt: null,
      bidEndedAt: null,
      openedAt: null,
      region: "서울",
      procurementType: ProcurementType.CONSTRUCTION,
      contractMethod: null,
      estimatedAmount: "1000",
      sourceUrl: "https://example.invalid/tender",
      relevance: TenderRelevance.DIRECT,
      relevanceScore: 100,
      relevanceReasons: [],
      rawData: { secret: "must-not-leak" },
      firstCollectedAt: new Date("2026-08-10T04:00:00.000Z"),
      lastUpdatedAt: new Date("2026-08-10T04:00:00.000Z"),
    };
    builder.getManyAndCount.mockResolvedValue([[tender], 11]);
    repository.createQueryBuilder.mockReturnValue(builder);

    const result = await service.getTenders({
      registeredDate: "2026-08-10",
      keyword: "100%_LED!\\",
      source: TenderSource.G2B,
      region: "서울",
      procurementType: ProcurementType.CONSTRUCTION,
      relevance: TenderRelevance.DIRECT,
      page: 2,
      pageSize: 5,
    });

    expect(result).toEqual({
      data: [expect.not.objectContaining({ rawData: expect.anything() })],
      total: 11,
      page: 2,
      pageSize: 5,
      totalPages: 3,
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      "(tender.title ILIKE :keyword ESCAPE '!' OR tender.orderingOrganization ILIKE :keyword ESCAPE '!' OR tender.demandOrganization ILIKE :keyword ESCAPE '!')",
      { keyword: "%100!%!_LED!!\\%" },
    );
    expect(builder.orderBy).toHaveBeenCalledWith("tender.registeredAt", "DESC");
    expect(builder.addOrderBy).toHaveBeenCalledWith("tender.id", "ASC");
    expect(builder.skip).toHaveBeenCalledWith(5);
    expect(builder.take).toHaveBeenCalledWith(5);
  });

  it("returns a safe detail response without provider raw data", async () => {
    const builder = createQueryBuilder();
    builder.getOne.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      source: TenderSource.KAPT,
      sourceNoticeId: "K-1",
      revision: "0",
      title: "전기시설 개선",
      orderingOrganization: "아파트",
      demandOrganization: null,
      registeredAt: new Date("2026-08-01T00:00:00.000Z"),
      bidStartedAt: null,
      bidEndedAt: null,
      openedAt: null,
      region: null,
      procurementType: ProcurementType.CONSTRUCTION,
      contractMethod: null,
      estimatedAmount: null,
      sourceUrl: "https://example.invalid/tender",
      relevance: TenderRelevance.POTENTIAL,
      relevanceScore: 40,
      relevanceReasons: [{ field: "title", keyword: "전기시설", score: 40 }],
      rawData: { apiKey: "must-not-leak" },
      firstCollectedAt: new Date("2026-08-01T00:00:00.000Z"),
      lastUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    repository.createQueryBuilder.mockReturnValue(builder);

    const detail = await service.getTender(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(detail).toEqual(
      expect.objectContaining({
        title: "전기시설 개선",
        relevanceReasons: [{ field: "title", keyword: "전기시설", score: 40 }],
      }),
    );
    expect(detail).not.toHaveProperty("rawData");
  });

  it("returns null when a tender ID does not exist", async () => {
    const builder = createQueryBuilder();
    builder.getOne.mockResolvedValue(null);
    repository.createQueryBuilder.mockReturnValue(builder);

    await expect(
      service.getTender("00000000-0000-4000-8000-000000000001"),
    ).resolves.toBeNull();
  });
});
