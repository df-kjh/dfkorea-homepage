import { TenderCompanyProfile } from "../entities/tender-company-profile.entity";
import { TenderCompanyProfileService } from "./tender-company-profile.service";

const createInsertBuilder = () => {
  const builder = {
    insert: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn(),
  };
  Object.values(builder).forEach((method) => {
    (method as jest.Mock).mockReturnValue(builder);
  });
  return builder;
};

const profile = (overrides: Record<string, unknown> = {}) => ({
  companyName: "디에프코리아",
  businessNumber: "123-45-67890",
  headquarters: { sido: "경기도", sigungu: "화성시" },
  g2bRegistered: true,
  supplyProducts: [{ code: "39112102", name: "LED보안등기구", expiresAt: null }],
  licenses: [],
  companyTypes: [],
  directProduction: [],
  certifications: [],
  performanceRecords: [],
  ...overrides,
});

describe("TenderCompanyProfileService", () => {
  let repository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let service: TenderCompanyProfileService;

  beforeEach(() => {
    repository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const manager = { getRepository: jest.fn(() => repository) };
    dataSource = {
      getRepository: jest.fn(() => repository),
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new TenderCompanyProfileService(dataSource as never);
  });

  it("normalizes codes and increments the singleton profile version", async () => {
    const insertBuilder = createInsertBuilder();
    repository.createQueryBuilder.mockReturnValue(insertBuilder);
    repository.findOne.mockResolvedValue({
      id: "profile-id",
      singletonKey: "company",
      version: 0,
    });
    repository.save.mockImplementation(async (value) => value);

    const saved = await service.replace(profile());

    expect(saved.version).toBe(1);
    expect(saved.businessNumber).toBe("1234567890");
    expect(saved.supplyProducts).toEqual([
      { code: "39112102", name: "LED보안등기구", expiresAt: null },
    ]);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { singletonKey: "company" },
      lock: { mode: "pessimistic_write" },
    });
  });

  it("replaces the current row without retaining a profile history", async () => {
    const insertBuilder = createInsertBuilder();
    repository.createQueryBuilder.mockReturnValue(insertBuilder);
    repository.findOne.mockResolvedValue({
      id: "profile-id",
      singletonKey: "company",
      version: 4,
      companyName: "이전 회사명",
    });
    repository.save.mockImplementation(async (value) => value);

    const saved = await service.replace(profile({ companyName: "새 회사명" }));

    expect(saved).toEqual(expect.objectContaining({
      companyName: "새 회사명",
      version: 5,
    }));
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "profile-id", singletonKey: "company" }),
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(1);
  });

  it("returns null until an administrator saves a profile", async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.get()).resolves.toBeNull();
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(dataSource.getRepository).toHaveBeenCalledWith(TenderCompanyProfile);
  });
});
