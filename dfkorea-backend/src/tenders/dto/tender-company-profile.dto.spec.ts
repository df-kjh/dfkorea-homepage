import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ReplaceTenderCompanyProfileDto } from "./tender-company-profile.dto";

const profile = (overrides: Record<string, unknown> = {}) => ({
  companyName: " 디에프코리아 ",
  businessNumber: "123-45-67890",
  headquarters: { sido: " 경기도 ", sigungu: " 화성시 " },
  g2bRegistered: true,
  supplyProducts: [
    { code: " 39112102 ", name: " LED보안등기구 ", expiresAt: null },
  ],
  licenses: [],
  companyTypes: [],
  directProduction: [],
  certifications: [],
  performanceRecords: [],
  ...overrides,
});

describe("ReplaceTenderCompanyProfileDto", () => {
  it("normalizes business identifiers, qualification codes, and names", async () => {
    const dto = plainToInstance(ReplaceTenderCompanyProfileDto, profile());

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.businessNumber).toBe("1234567890");
    expect(dto.companyName).toBe("디에프코리아");
    expect(dto.headquarters).toEqual({ sido: "경기도", sigungu: "화성시" });
    expect(dto.supplyProducts).toEqual([
      { code: "39112102", name: "LED보안등기구", expiresAt: null },
    ]);
  });

  it("rejects duplicate qualification codes after normalization", async () => {
    const dto = plainToInstance(
      ReplaceTenderCompanyProfileDto,
      profile({
        licenses: [
          { code: " 0036 ", name: "전기공사업", expiresAt: "2099-12-31" },
          { code: "0036", name: "전기공사업 재등록", expiresAt: "2099-12-31" },
        ],
      }),
    );

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "licenses" }),
      ]),
    );
  });

  it("requires every qualification to explicitly declare its expiry state", async () => {
    const dto = plainToInstance(
      ReplaceTenderCompanyProfileDto,
      profile({
        certifications: [{ code: "KS", name: "KS 인증" }],
      }),
    );

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "certifications" }),
      ]),
    );
  });

  it("rejects malformed business numbers, expired documents, and invalid performance records", async () => {
    const dto = plainToInstance(
      ReplaceTenderCompanyProfileDto,
      profile({
        businessNumber: "123-45-6789",
        certifications: [
          { code: "KS", name: "KS 인증", expiresAt: "2000-01-01" },
        ],
        performanceRecords: [
          {
            itemName: "LED 등기구 납품",
            from: "2026-06-01",
            to: "2026-01-01",
            amount: "100,000",
          },
        ],
      }),
    );

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "businessNumber" }),
        expect.objectContaining({ property: "certifications" }),
        expect.objectContaining({ property: "performanceRecords" }),
      ]),
    );
  });
});
