import { ConfigService } from "@nestjs/config";
import { NtsVerifier } from "./nts-verifier";
const company = {
  companyName: "테스트상호",
  businessNumber: "1234567890",
  representativeName: "대표",
  openingDate: "2020-01-01",
};
describe("NTS company validation", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  const service = () =>
    new NtsVerifier(
      new ConfigService({
        NTS_SERVICE_KEY: "test-only-key",
      }),
    );
  const response = (valid = "01", status = "01") => ({
    status_code: "OK",
    data: [
      {
        b_no: company.businessNumber,
        valid,
        status: { b_no: company.businessNumber, b_stt_cd: status },
      },
    ],
  });
  it("sends company name in b_nm with mandatory identity fields", async () => {
    let captured: any;
    global.fetch = jest.fn(async (_url, init) => {
      captured = JSON.parse(String(init.body));
      return new Response(JSON.stringify(response()));
    });
    await expect(service().verify(company)).resolves.toEqual({
      verified: true,
    });
    expect(captured).toEqual({
      businesses: [
        {
          b_no: "1234567890",
          b_nm: "테스트상호",
          p_nm: "대표",
          start_dt: "20200101",
        },
      ],
    });
  });
  it.each([
    ["02", "01"],
    ["01", "02"],
    ["01", "03"],
    ["01", ""],
  ])("rejects mismatch/inactive registration %s %s", async (valid, status) => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify(response(valid, status))),
    );
    await expect(
      service().verify({ ...company, companyName: "틀린 상호" }),
    ).rejects.toThrow();
  });
  it("rejects missing/unknown responses, outages and missing configuration", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ status_code: "OK", data: [] })),
    );
    await expect(service().verify(company)).rejects.toThrow();
    global.fetch = jest.fn(async () => {
      throw new Error("offline");
    });
    await expect(service().verify(company)).rejects.toThrow();
    await expect(
      new NtsVerifier(new ConfigService({})).verify(company),
    ).rejects.toThrow();
  });
  it("bounds provider JSON response size", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ ...response(), extra: "x".repeat(70 * 1024) }),
        ),
    );
    await expect(service().verify(company)).rejects.toMatchObject({
      status: 503,
    });
  });
});
