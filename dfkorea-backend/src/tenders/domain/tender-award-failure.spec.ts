import { TenderSourceError } from "../adapters/public-api-client";
import { TenderSource } from "./tender.enums";
import { classifyAwardFailure } from "./tender-award-failure";
describe("award retry classification", () => {
  it.each([400, 401, 403, 404])(
    "makes HTTP %i terminal until explicit resume",
    (status) =>
      expect(
        classifyAwardFailure(
          new TenderSourceError(TenderSource.G2B, "HTTP_ERROR", status),
        ),
      ).toEqual({ terminal: true, code: `TERMINAL_HTTP_${status}` }),
  );
  it.each([429, 500, 503])("keeps HTTP %i retryable", (status) =>
    expect(
      classifyAwardFailure(
        new TenderSourceError(TenderSource.G2B, "HTTP_ERROR", status),
      ),
    ).toEqual({ terminal: false, code: "HTTP_ERROR" }),
  );
  it.each(["20", "30", "31"])("makes provider auth %s terminal", (code) =>
    expect(
      classifyAwardFailure(
        new TenderSourceError(
          TenderSource.G2B,
          "PROVIDER_RESULT_ERROR",
          200,
          undefined,
          null,
          null,
          code,
        ),
      ),
    ).toEqual({ terminal: true, code: `TERMINAL_PROVIDER_${code}` }),
  );
  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"] as const)(
    "keeps %s retryable",
    (code) =>
      expect(
        classifyAwardFailure(new TenderSourceError(TenderSource.G2B, code)),
      ).toEqual({ terminal: false, code }),
  );
  it("keeps unknown failures value-free", () =>
    expect(
      classifyAwardFailure(new Error("private bidder body fixture-key")),
    ).toEqual({ terminal: false, code: "AWARD_COLLECTION_FAILED" }));
});
