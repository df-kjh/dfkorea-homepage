import { TenderSource } from "../domain/tender.enums";
import { createG2bRelayFetcher } from "./g2b-relay.fetcher";

const relayUrl = "https://dfkorealed.com/api/internal/g2b-relay";
const sharedSecret = "relay-test-secret-with-at-least-32-bytes";
const timestamp = 1_788_222_791_000;
const providerUrl =
  "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThng" +
  "?serviceKey=production-key&type=json&inqryDiv=1&inqryBgnDt=202608311500" +
  "&inqryEndDt=202609010633&pageNo=1&numOfRows=100";
const expectedBody =
  '{"operation":"getBidPblancListInfoThng","query":{"type":"json","inqryDiv":"1","inqryBgnDt":"202608311500","inqryEndDt":"202609010633","pageNo":"1","numOfRows":"100"}}';
const expectedSignature =
  "202ff3d368ae46212d2a184fbc7d35d8355b0d6f41f6ec6c633c3ada8e9c0ada";

describe("createG2bRelayFetcher", () => {
  it("posts only the approved provider fields with the exact deterministic signature", async () => {
    const providerResponse = new Response(
      JSON.stringify({ response: { body: { items: [], totalCount: 0 } } }),
    );
    const fetcher = jest.fn().mockResolvedValue(providerResponse);
    const controller = new AbortController();
    const relayFetcher = createG2bRelayFetcher(
      { relayUrl, sharedSecret, now: () => timestamp },
      fetcher as typeof fetch,
    );

    const response = await relayFetcher(providerUrl, {
      signal: controller.signal,
    });

    expect(response).toBe(providerResponse);
    expect(fetcher).toHaveBeenCalledWith(relayUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfkorea-timestamp": String(timestamp),
        "x-dfkorea-signature": expectedSignature,
      },
      body: expectedBody,
      signal: controller.signal,
    });
    expect(expectedBody).not.toContain("production-key");
    expect(expectedBody).not.toContain("serviceKey");
  });

  it.each([
    ["a malformed provider URL", "not a provider URL"],
    [
      "a disallowed operation",
      providerUrl.replace(
        "getBidPblancListInfoThng",
        "getBidPblancListInfoEverything",
      ),
    ],
    [
      "a duplicate required query field",
      `${providerUrl}&pageNo=2`,
    ],
    [
      "a missing required query field",
      providerUrl.replace("&numOfRows=100", ""),
    ],
  ])("rejects %s without serializing sensitive input", async (_label, input) => {
    const fetcher = jest.fn();
    const relayFetcher = createG2bRelayFetcher(
      { relayUrl, sharedSecret, now: () => timestamp },
      fetcher as typeof fetch,
    );

    const pending = relayFetcher(input);

    await expect(pending).rejects.toMatchObject({
      source: TenderSource.G2B,
      code: "CONFIGURATION_ERROR",
    });
    const error = await pending.catch((reason) => reason);
    const serialized = JSON.stringify(error);
    expect(Object.keys(error)).not.toContain("cause");
    expect(serialized).not.toContain("production-key");
    expect(serialized).not.toContain(sharedSecret);
    expect(serialized).not.toContain(relayUrl);
    expect(serialized).not.toContain(input);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["an invalid relay URL", "not a relay URL", sharedSecret],
    ["a short shared secret", relayUrl, "too-short"],
  ])(
    "reports CONFIGURATION_ERROR for %s only when the fetcher is invoked",
    async (_label, invalidRelayUrl, invalidSecret) => {
      const fetcher = jest.fn();
      const relayFetcher = createG2bRelayFetcher(
        {
          relayUrl: invalidRelayUrl,
          sharedSecret: invalidSecret,
          now: () => timestamp,
        },
        fetcher as typeof fetch,
      );

      await expect(relayFetcher(providerUrl)).rejects.toMatchObject({
        source: TenderSource.G2B,
        code: "CONFIGURATION_ERROR",
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
