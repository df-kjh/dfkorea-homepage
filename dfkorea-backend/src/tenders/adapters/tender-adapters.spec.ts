const g2bFixture = require("./fixtures/g2b-notices.json");
const kaptFixture = require("./fixtures/kapt-notices.json");
const kepcoFixture = require("./fixtures/kepco-notices.json");
import { G2bTenderAdapter } from "./g2b-tender.adapter";
import { KaptTenderAdapter } from "./kapt-tender.adapter";
import { KepcoTenderAdapter } from "./kepco-tender.adapter";
import {
  parseKstDate,
  PublicApiClient,
  PublicApiRequest,
  TenderApiClient,
  TenderSourceError,
} from "./public-api-client";
import { TenderFetchWindow } from "../domain/tender-source.adapter";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import { TenderClassifier } from "../domain/tender-classifier";

const window: TenderFetchWindow = {
  from: new Date("2026-08-26T00:00:00.000Z"),
  to: new Date("2026-08-27T00:00:00.000Z"),
};

const createClient = (): jest.Mocked<TenderApiClient> => ({
  getAllPages: jest.fn(),
});

const providerResponse = (
  resultCode: string,
  items: Record<string, unknown>[] = [],
  totalCount = items.length,
  status = 200,
) =>
  new Response(
    JSON.stringify({
      response: { header: { resultCode }, body: { totalCount, items } },
    }),
    { status },
  );

const gatewayResponse = (returnReasonCode: string) =>
  new Response(
    JSON.stringify({
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: {
          returnReasonCode,
          returnAuthMsg: "provider message serviceKey=secret-key",
          errMsg: "raw provider response body",
        },
      },
    }),
    { status: 200 },
  );

const requestFor = (operation: string): PublicApiRequest => ({
  source: TenderSource.G2B,
  baseUrl: "https://api.example.test/bids",
  operation,
  query: { serviceKey: "secret-key" },
});

describe("official tender adapters", () => {
  it("normalizes G2B notice identity and KST dates", async () => {
    const client = createClient();
    client.getAllPages.mockResolvedValue(g2bFixture.response.body.items);
    const adapter = new G2bTenderAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    });

    const [notice] = await adapter.fetchNotices(window);

    expect(notice).toEqual(
      expect.objectContaining({
        source: TenderSource.G2B,
        sourceNoticeId: "R26BK00000001",
        revision: "000",
        title: "LED 가로등 교체공사",
        orderingOrganization: "서울특별시 강남구",
        registeredAt: new Date("2026-08-26T06:30:00.000Z"),
        bidEndedAt: new Date("2026-09-02T01:00:00.000Z"),
        procurementType: ProcurementType.CONSTRUCTION,
        region: "서울특별시",
        estimatedAmount: "125000000",
        sourceUrl:
          "https://www.g2b.go.kr/ep/tbid/tbidFwd.do?bidno=R26BK00000001&bidseq=000",
        rawData: g2bFixture.response.body.items[0],
      }),
    );
    expect(client.getAllPages).toHaveBeenCalledTimes(3);
    expect(notice?.attachmentNames).toEqual(["LED 등기구 시방서.pdf"]);
  });

  it("classifies a notice from a documented G2B attachment filename", async () => {
    const client = createClient();
    client.getAllPages.mockResolvedValue([
      {
        ...g2bFixture.response.body.items[0],
        bidNtceNm: "시설 자재 구매",
        prdctClsfcNoNm: "",
        bidNtceDtl: "",
      },
    ]);
    const adapter = new G2bTenderAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    });

    const [notice] = await adapter.fetchNotices(window);

    expect(new TenderClassifier().classify(notice!)).toEqual(
      expect.objectContaining({
        reasons: expect.arrayContaining([
          expect.objectContaining({
            field: "attachmentNames",
            keyword: "LED",
            score: 100,
          }),
        ]),
      }),
    );
  });

  it("normalizes K-apt official fields without inventing unavailable values", async () => {
    const client = createClient();
    client.getAllPages.mockResolvedValue(kaptFixture.response.body.items);
    const adapter = new KaptTenderAdapter(client, {
      baseUrl:
        "https://apis.data.go.kr/1613000/ApHusBidPblAncInfoOfferServiceV3",
      serviceKey: "test-key",
    });

    const [notice] = await adapter.fetchNotices(window);

    expect(notice).toEqual(
      expect.objectContaining({
        source: TenderSource.KAPT,
        sourceNoticeId: "202608260001",
        revision: "1024",
        title: "단지 LED 조명 교체공사",
        orderingOrganization: "DF아파트",
        demandOrganization: null,
        registeredAt: new Date("2026-08-26T06:30:00.000Z"),
        bidEndedAt: new Date("2026-09-02T01:00:00.000Z"),
        procurementType: ProcurementType.OTHER,
        region: "서울특별시 송파구",
        estimatedAmount: null,
        sourceUrl:
          "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=202608260001",
        description: "공용부 실내 조명 및 등기구 교체",
        rawData: kaptFixture.response.body.items[0],
      }),
    );
  });

  it("maps the isolated KEPCO recorded contract and validates enabled configuration", async () => {
    const client = createClient();
    client.getAllPages.mockResolvedValue(kepcoFixture.items);
    const adapter = new KepcoTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://recorded-contract.example.invalid",
      apiKey: "test-key",
    });

    const [notice] = await adapter.fetchNotices(window);

    expect(notice).toEqual(
      expect.objectContaining({
        source: TenderSource.KEPCO,
        sourceNoticeId: "KEPCO-2026-0001",
        revision: "00",
        title: "LED 보안등 구매",
        orderingOrganization: "한국전력공사",
        registeredAt: new Date("2026-08-26T06:30:00.000Z"),
        bidEndedAt: new Date("2026-09-02T01:00:00.000Z"),
        procurementType: ProcurementType.GOODS,
        region: "경기도",
        estimatedAmount: "77000000",
        sourceUrl: "https://example.invalid/kepco/bids/KEPCO-2026-0001",
        rawData: kepcoFixture.items[0],
      }),
    );

    expect(
      () =>
        new KepcoTenderAdapter(client, {
          enabled: true,
          baseUrl: "",
          apiKey: "",
        }),
    ).toThrow(TenderSourceError);
  });

  it("skips G2B rows with impossible local calendar dates", async () => {
    const client = createClient();
    client.getAllPages.mockResolvedValue([
      {
        ...g2bFixture.response.body.items[0],
        bidNtceDt: "202602311530",
      },
    ]);
    const adapter = new G2bTenderAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual([]);
  });
});

describe("PublicApiClient", () => {
  it("retries provider code 23 twice and retains safe page diagnostics", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(providerResponse("23"))
      .mockResolvedValueOnce(providerResponse("23"))
      .mockResolvedValueOnce(providerResponse("00", [], 0));
    const onRetry = jest.fn();
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
      onRetry,
    });

    const result = client.getAllPages(requestFor("getBidPblancListInfoThng"));
    await jest.advanceTimersByTimeAsync(4_000);

    await expect(result).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: "getBidPblancListInfoThng",
        pageNo: 1,
        providerResultCode: "23",
        attempt: 1,
      }),
    );
    expect(onRetry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operation: "getBidPblancListInfoThng",
        pageNo: 1,
        providerResultCode: "23",
        attempt: 2,
      }),
    );
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("secret-key");
    jest.useRealTimers();
  });

  it.each([
    ["provider", providerResponse("30")],
    ["http", new Response("", { status: 401 })],
  ])("does not retry permanent %s failures", async (_label, response) => {
    const fetcher = jest.fn().mockResolvedValue(response);
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
    });

    await expect(
      client.getAllPages(requestFor("notices")),
    ).rejects.toBeInstanceOf(TenderSourceError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([429, 502, 503, 504])(
    "retries transient HTTP %s responses up to the configured limit",
    async (status) => {
      jest.useFakeTimers();
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce(new Response("", { status }))
        .mockResolvedValueOnce(new Response("", { status }))
        .mockResolvedValueOnce(providerResponse("00", [], 0));
      const onRetry = jest.fn();
      const client = new PublicApiClient(fetcher, {
        retryDelaysMs: [1_000, 3_000],
        onRetry,
      });

      const result = client.getAllPages(requestFor("notices"));
      await jest.advanceTimersByTimeAsync(4_000);

      await expect(result).resolves.toEqual([]);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errorCode: "HTTP_ERROR",
          httpStatus: status,
          attempt: 2,
        }),
      );
      jest.useRealTimers();
    },
  );

  it("retries request timeouts and records only safe retry metadata", async () => {
    jest.useFakeTimers();
    const hangingResponse = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("raw timeout serviceKey=secret-key")),
        );
      });
    const fetcher = jest
      .fn()
      .mockImplementationOnce(hangingResponse)
      .mockImplementationOnce(hangingResponse)
      .mockResolvedValueOnce(providerResponse("00", [], 0));
    const onRetry = jest.fn();
    const client = new PublicApiClient(fetcher, {
      timeoutMs: 10,
      retryDelaysMs: [1_000, 3_000],
      onRetry,
    });

    const result = client.getAllPages(requestFor("notices"));
    await jest.advanceTimersByTimeAsync(4_020);

    await expect(result).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([event]) => event.errorCode)).toEqual([
      "REQUEST_TIMEOUT",
      "REQUEST_TIMEOUT",
    ]);
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("secret-key");
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it("retries network errors without exposing their cause", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("network serviceKey=secret-key"))
      .mockRejectedValueOnce(
        new Error("https://api.example.test/bids?serviceKey=secret-key"),
      )
      .mockResolvedValueOnce(providerResponse("00", [], 0));
    const onRetry = jest.fn();
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
      onRetry,
    });

    const result = client.getAllPages(requestFor("notices"));
    await jest.advanceTimersByTimeAsync(4_000);

    await expect(result).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([event]) => event.errorCode)).toEqual([
      "NETWORK_ERROR",
      "NETWORK_ERROR",
    ]);
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("secret-key");
    jest.useRealTimers();
  });

  it("parses gateway result codes without exposing provider messages", async () => {
    const fetcher = jest.fn().mockResolvedValue(gatewayResponse("30"));
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
    });

    try {
      await client.getAllPages(requestFor("notices"));
      fail("expected a provider result error");
    } catch (error) {
      expect(error).toMatchObject({
        source: TenderSource.G2B,
        code: "PROVIDER_RESULT_ERROR",
        operation: "notices",
        pageNo: 1,
        providerResultCode: "30",
        attempts: 1,
      });
      expect((error as Error).message).not.toContain("secret-key");
      expect((error as Error).message).not.toContain("provider message");
      expect((error as Error).message).not.toContain("raw provider response");
      expect((error as Error).message).not.toContain("api.example.test");
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries gateway provider code 23", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(gatewayResponse("23"))
      .mockResolvedValueOnce(providerResponse("00", [], 0));
    const onRetry = jest.fn();
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
      onRetry,
    });

    const result = client.getAllPages(requestFor("notices"));
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toEqual([]);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ providerResultCode: "23", attempt: 1 }),
    );
    const retryDiagnostics = JSON.stringify(onRetry.mock.calls);
    expect(retryDiagnostics).not.toContain("secret-key");
    expect(retryDiagnostics).not.toContain("provider message");
    expect(retryDiagnostics).not.toContain("raw provider response");
    expect(retryDiagnostics).not.toContain("api.example.test");
    jest.useRealTimers();
  });

  it("retains safe diagnostics after exhausting retries", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockImplementation(() => Promise.resolve(providerResponse("23")));
    const client = new PublicApiClient(fetcher, {
      retryDelaysMs: [1_000, 3_000],
    });

    const result = client.getAllPages(requestFor("notices"));
    const outcome: Promise<TenderSourceError> = result.then(
      () => fail("expected retries to be exhausted"),
      (error: TenderSourceError) => error,
    );
    await jest.advanceTimersByTimeAsync(4_000);

    await expect(outcome).resolves.toMatchObject({
      source: TenderSource.G2B,
      code: "PROVIDER_RESULT_ERROR",
      operation: "notices",
      pageNo: 1,
      providerResultCode: "23",
      attempts: 3,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    const error = await outcome;
    expect(error.message).not.toContain("secret-key");
    expect(error.message).not.toContain("api.example.test");
    jest.useRealTimers();
  });

  it("paces concurrent callers through one shared request-start slot", async () => {
    jest.useFakeTimers();
    const starts: number[] = [];
    const fetcher = jest.fn(async () => {
      starts.push(Date.now());
      return providerResponse("00", [], 0);
    });
    const client = new PublicApiClient(fetcher, {
      minimumRequestIntervalMs: 1_100,
    });
    const requests = Promise.all([
      client.getAllPages(requestFor("construction")),
      client.getAllPages(requestFor("goods")),
    ]);
    await jest.runAllTimersAsync();
    await requests;

    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1_100);
    jest.useRealTimers();
  });

  it("sends the exact official G2B minute-window and pagination parameters for every operation", async () => {
    const row = g2bFixture.response.body.items[0];
    const fetcher = jest.fn(async (urlText: string) => {
      const url = new URL(urlText);
      const pageNo = url.searchParams.get("pageNo");
      const items =
        pageNo === "1" ? Array.from({ length: 100 }, () => row) : [row];
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00" },
            body: { totalCount: 101, items },
          },
        }),
        { status: 200 },
      );
    });
    const adapter = new G2bTenderAdapter(new PublicApiClient(fetcher), {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    });

    await adapter.fetchNotices(window);

    const operations = [
      "getBidPblancListInfoCnstwk",
      "getBidPblancListInfoThng",
      "getBidPblancListInfoServc",
    ];
    expect(fetcher).toHaveBeenCalledTimes(6);
    for (const operation of operations) {
      for (const pageNo of ["1", "2"]) {
        const request = fetcher.mock.calls
          .map(([urlText]) => new URL(urlText))
          .find(
            (url) =>
              url.pathname.endsWith(`/${operation}`) &&
              url.searchParams.get("pageNo") === pageNo,
          );
        expect(request).toBeDefined();
        expect(Object.fromEntries(request!.searchParams.entries())).toEqual({
          serviceKey: "test-key",
          type: "json",
          inqryDiv: "1",
          inqryBgnDt: "202608260900",
          inqryEndDt: "202608270900",
          pageNo,
          numOfRows: "100",
        });
      }
    }
  });

  it("requests 100-row pages and stops at the provider total", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `row-${index + 1}`,
    }));
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: { totalCount: 101, items: firstPage },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: { totalCount: 101, items: [{ id: "two" }] },
            },
          }),
          { status: 200 },
        ),
      );
    const client = new PublicApiClient(fetcher);

    const rows = await client.getAllPages<{ id: string }>({
      source: TenderSource.G2B,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: { serviceKey: "redacted-key" },
    });

    expect(rows).toHaveLength(101);
    expect(rows[0]).toEqual({ id: "row-1" });
    expect(rows[100]).toEqual({ id: "two" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toContain("numOfRows=100");
    expect(fetcher.mock.calls[1][0]).toContain("pageNo=2");
  });

  it("redacts provider response details from failed result errors", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "30", resultMsg: "serviceKey=secret-key" },
            body: {},
          },
        }),
        { status: 200 },
      ),
    );
    const client = new PublicApiClient(fetcher);

    await expect(
      client.getAllPages({
        source: TenderSource.G2B,
        baseUrl: "https://api.example.test/bids",
        operation: "notices",
        query: { serviceKey: "secret-key" },
      }),
    ).rejects.toMatchObject({
      source: TenderSource.G2B,
      code: "PROVIDER_RESULT_ERROR",
      status: 200,
    });
  });

  it("accepts a recorded LINK response with a top-level result code", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          resultCode: "00",
          totalCount: 1,
          items: [{ noticeNo: "KEPCO-1" }],
        }),
        { status: 200 },
      ),
    );
    const client = new PublicApiClient(fetcher);

    await expect(
      client.getAllPages({
        source: TenderSource.KEPCO,
        baseUrl: "https://api.example.test/bids",
        operation: "notices",
        query: {},
      }),
    ).resolves.toEqual([{ noticeNo: "KEPCO-1" }]);
  });

  it("aborts a timed out provider request and preserves source context", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("request aborted")),
          );
        }),
    );
    const client = new PublicApiClient(fetcher, { timeoutMs: 100 });
    const request = client.getAllPages({
      source: TenderSource.KAPT,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
    });
    const expectation = expect(request).rejects.toMatchObject({
      source: TenderSource.KAPT,
      code: "REQUEST_TIMEOUT",
      status: null,
    });

    await jest.advanceTimersByTimeAsync(100);
    await expectation;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    jest.useRealTimers();
  });

  it("cleans up the request timeout after a successful response", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00" },
            body: { totalCount: 0, items: [] },
          },
        }),
        { status: 200 },
      ),
    );
    const client = new PublicApiClient(fetcher, { timeoutMs: 100 });

    await client.getAllPages({
      source: TenderSource.G2B,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
    });

    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it("times out an abort-aware response body that never resolves", async () => {
    jest.useFakeTimers();
    const json = jest.fn(
      (signal: AbortSignal | undefined) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new Error("body read aborted")),
          );
        }),
    );
    const fetcher = jest.fn(
      (_url: string, init?: RequestInit): Promise<Response> =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => json(init?.signal),
        } as Response),
    );
    const client = new PublicApiClient(fetcher, { timeoutMs: 100 });
    const request = client.getAllPages({
      source: TenderSource.KEPCO,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
    });
    const expectation = expect(request).rejects.toMatchObject({
      source: TenderSource.KEPCO,
      code: "REQUEST_TIMEOUT",
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(json).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    await expectation;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    jest.useRealTimers();
  });

  it("rejects an already-aborted caller signal without starting a request", async () => {
    const caller = new AbortController();
    const fetcher = jest.fn();
    const client = new PublicApiClient(fetcher);
    caller.abort();

    await expect(
      client.getAllPages({
        source: TenderSource.G2B,
        baseUrl: "https://api.example.test/bids",
        operation: "notices",
        query: {},
        signal: caller.signal,
      }),
    ).rejects.toMatchObject({
      source: TenderSource.G2B,
      code: "REQUEST_ABORTED",
      status: null,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards a mid-flight caller abort and distinguishes it from timeout", async () => {
    const caller = new AbortController();
    const fetcher = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("caller cancelled")),
          );
        }),
    );
    const client = new PublicApiClient(fetcher, { timeoutMs: 1000 });
    const request = client.getAllPages({
      source: TenderSource.KAPT,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
      signal: caller.signal,
    });
    const expectation = expect(request).rejects.toMatchObject({
      source: TenderSource.KAPT,
      code: "REQUEST_ABORTED",
      status: null,
    });

    caller.abort();
    await expectation;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("does not miss a caller abort triggered synchronously by the fetcher", async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    let forwardedSignal: AbortSignal | undefined;
    const fetcher = jest.fn((_url: string, init?: RequestInit) => {
      forwardedSignal = init?.signal;
      caller.abort();
      return new Promise<Response>(() => undefined);
    });
    const client = new PublicApiClient(fetcher, { timeoutMs: 100 });
    const request = client.getAllPages({
      source: TenderSource.KEPCO,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
      signal: caller.signal,
    });
    const result = request.then(
      () => fail("expected the caller abort to reject the request"),
      (error) => error,
    );

    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toMatchObject({
      source: TenderSource.KEPCO,
      code: "REQUEST_ABORTED",
    });
    expect(forwardedSignal?.aborted).toBe(true);
    jest.useRealTimers();
  });

  it("removes the one-shot caller listener after a completed request", async () => {
    const caller = new AbortController();
    const addListener = jest.spyOn(caller.signal, "addEventListener");
    const removeListener = jest.spyOn(caller.signal, "removeEventListener");
    let forwardedSignal: AbortSignal | undefined;
    const fetcher = jest.fn((_url: string, init?: RequestInit) => {
      forwardedSignal = init?.signal;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: { totalCount: 0, items: [] },
            },
          }),
          { status: 200 },
        ),
      );
    });
    const client = new PublicApiClient(fetcher);

    await client.getAllPages({
      source: TenderSource.G2B,
      baseUrl: "https://api.example.test/bids",
      operation: "notices",
      query: {},
      signal: caller.signal,
    });

    expect(addListener).toHaveBeenCalledWith("abort", expect.any(Function), {
      once: true,
    });
    expect(removeListener).toHaveBeenCalledTimes(1);
    caller.abort();
    expect(forwardedSignal?.aborted).toBe(false);
  });

  it("preserves a network cause without exposing it in the public error message", async () => {
    const cause = new Error("network failed for serviceKey=secret-key");
    const fetcher = jest.fn().mockRejectedValue(cause);
    const client = new PublicApiClient(fetcher);

    try {
      await client.getAllPages({
        source: TenderSource.G2B,
        baseUrl: "https://api.example.test/bids",
        operation: "notices",
        query: { serviceKey: "secret-key" },
      });
      fail("expected a network error");
    } catch (error) {
      expect(error).toBeInstanceOf(TenderSourceError);
      expect(error).toMatchObject({
        source: TenderSource.G2B,
        code: "NETWORK_ERROR",
        cause,
      });
      expect((error as Error).message).not.toContain("secret-key");
    }
  });
});

describe("parseKstDate", () => {
  it.each([
    "202602311530",
    "202613011000",
    "202608262400",
    "202608261560",
    "20260826153061",
    "2026-02-31T09:00:00+09:00",
  ])("rejects impossible local date %s", (value) => {
    expect(parseKstDate(value)).toBeNull();
  });

  it("converts a valid offsetless KST date to UTC", () => {
    expect(parseKstDate("2026-08-26 15:30:00")).toEqual(
      new Date("2026-08-26T06:30:00.000Z"),
    );
  });
});
