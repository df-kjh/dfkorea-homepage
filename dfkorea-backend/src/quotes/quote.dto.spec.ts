import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { QuoteSubmissionDto } from "./quote.dto";
const valid = {
  idempotencyKey: "1234567890123456",
  verificationToken: "a".repeat(64),
  company: {
    companyName: "회사",
    businessNumber: "1234567890",
    representativeName: "대표",
    openingDate: "2020-01-01",
    contactName: "담당",
    email: " person@example.com ",
  },
  consentVersion: "version",
  items: [
    {
      clientId: "a",
      kind: "custom",
      name: "제품",
      description: "원하는 사양",
      quantity: 1,
      options: [],
      certifications: [],
      attachmentIds: [],
    },
  ],
};
const errors = (value: any) =>
  validate(plainToInstance(QuoteSubmissionDto, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
describe("nested quote DTO trust boundary", () => {
  it("accepts valid nested data and trims email", async () => {
    const parsed = plainToInstance(QuoteSubmissionDto, valid);
    expect(await validate(parsed)).toHaveLength(0);
    expect(parsed.company.email).toBe("person@example.com");
  });
  it("rejects missing company, 21 items, invalid quantities and injected fields", async () => {
    expect(
      (await errors({ ...valid, company: undefined })).length,
    ).toBeGreaterThan(0);
    expect(
      (await errors({ ...valid, items: Array(21).fill(valid.items[0]) }))
        .length,
    ).toBeGreaterThan(0);
    for (const quantity of [0, 1.5, 1000000, "1"])
      expect(
        (await errors({ ...valid, items: [{ ...valid.items[0], quantity }] }))
          .length,
      ).toBeGreaterThan(0);
    expect(
      (
        await errors({
          ...valid,
          company: { ...valid.company, verified: true },
        })
      ).length,
    ).toBeGreaterThan(0);
  });
  it("accepts positive fractional catalog/custom specs but rejects nonfinite or nonpositive values", async () => {
    for (const field of ["power", "colorTemp"]) {
      for (const value of [0.5, 7.5, 5700.5])
        expect(
          await errors({
            ...valid,
            items: [{ ...valid.items[0], [field]: value }],
          }),
        ).toHaveLength(0);
      for (const value of [0, -0.5, NaN, Infinity, "7.5", 1000001])
        expect(
          (
            await errors({
              ...valid,
              items: [{ ...valid.items[0], [field]: value }],
            })
          ).length,
        ).toBeGreaterThan(0);
    }
  });
});
