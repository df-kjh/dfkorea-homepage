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
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  Object.values(builder).forEach((method) => {
    if (typeof method === "function") {
      (method as jest.Mock).mockReturnValue(builder);
    }
  });
  builder.getRawMany.mockResolvedValue([]);
  return builder;
};

describe("TenderQueryService broad tender rollback", () => {
  it("does not restrict the monthly calendar to supply opportunities", async () => {
    const builder = createQueryBuilder();
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    const service = new TenderQueryService(repository as never);

    await service.getCalendar("2026-09");

    expect(builder.andWhere).not.toHaveBeenCalledWith(
      "tender.opportunityType IN (:...eligibleOpportunityTypes)",
      expect.anything(),
    );
  });
});
