import { TenderPriceAnalyzer } from "../domain/tender-price-analyzer";
import { TenderRequirementParser } from "../domain/tender-requirement-parser";
import { TenderSuitabilityAnalyzer } from "../domain/tender-suitability-analyzer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { G2bEnrichmentAdapter } from "./g2b-enrichment.adapter";
import {
  PublicApiClient,
  TenderApiClient,
  TenderSourceError,
} from "./public-api-client";
import { NormalizedTender } from "../domain/normalized-tender";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import { G2B_TENDER_ENRICHMENT_ADAPTER } from "../domain/tender-enrichment";
import { TendersModule } from "../tenders.module";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/g2b-enrichment.json"), "utf8"),
) as Record<
  string,
  { response: { body: { items: Record<string, unknown>[] } } }
>;

const tender: NormalizedTender = {
  source: TenderSource.G2B,
  sourceNoticeId: "R26BK01000001",
  revision: "000",
  title: "LED 실내조명 구매",
  orderingOrganization: "조달청",
  demandOrganization: "경기도교육청",
  registeredAt: new Date("2026-09-06T00:00:00Z"),
  bidStartedAt: null,
  bidEndedAt: null,
  openedAt: null,
  region: null,
  procurementType: ProcurementType.GOODS,
  contractMethod: "제한경쟁",
  estimatedAmount: "100000000",
  sourceUrl: "https://www.g2b.go.kr/",
  itemName: "LED실내조명등",
  description: "",
  attachmentNames: [],
  rawData: {},
};

const rowsFor = (operation: string): Record<string, unknown>[] => {
  return fixture[operation]!.response.body.items;
};

const createClient = (
  implementation: (
    request: Parameters<TenderApiClient["getAllPages"]>[0],
  ) => Promise<Record<string, unknown>[]>,
) => {
  const getAllPages = jest.fn(implementation);
  return { client: { getAllPages } as TenderApiClient, getAllPages };
};

describe("G2bEnrichmentAdapter", () => {
  it("normalizes official goods detail, basis, restrictions, products, and documents with evidence", async () => {
    const signal = new AbortController().signal;
    const fetcher = jest.fn((urlText: string, _init?: RequestInit) => {
      const operation = new URL(urlText).pathname.split("/").at(-1)!;
      return Promise.resolve(
        new Response(JSON.stringify(fixture[operation]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const client = new PublicApiClient(fetcher);
    const adapter = new G2bEnrichmentAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    });

    const result = await adapter.enrich(tender, signal);

    expect(result).toEqual(
      expect.objectContaining({
        basisAmount: { value: "100000000", evidence: expect.any(Object) },
        lowerLimitRate: { value: "88.000", evidence: expect.any(Object) },
        lawKind: null,
        formulaVariables: expect.arrayContaining([
          {
            key: "reservePriceMinimumRate",
            value: "-3",
            evidence: expect.any(Object),
          },
          {
            key: "reservePriceMaximumRate",
            value: "3",
            evidence: expect.any(Object),
          },
        ]),
        regions: [
          {
            code: "41",
            name: "경기도",
            required: true,
            evidence: expect.any(Object),
          },
        ],
        licenses: [
          {
            code: "1468",
            name: "전기공사업",
            group: "1",
            required: true,
            evidence: expect.any(Object),
          },
          {
            code: "0037",
            name: "소방시설공사업",
            group: "1",
            required: true,
            evidence: expect.any(Object),
          },
          {
            code: "0036",
            name: "정보통신공사업",
            group: "2",
            required: true,
            evidence: expect.any(Object),
          },
        ],
        purchaseItems: [
          expect.objectContaining({
            classificationCode: "39111515",
            name: "LED실내조명등",
            specification: "40W, 5700K",
            quantity: "100",
            unit: "개",
            evidence: expect.any(Object),
          }),
        ],
        documents: expect.arrayContaining([
          expect.objectContaining({ formatHint: "HWP", source: "G2B_API" }),
          expect.objectContaining({ formatHint: "XLSX", source: "G2B_API" }),
        ]),
        failures: [],
      }),
    );
    expect(result.regions[0]?.evidence).toMatchObject({
      source: "G2B_API",
      operation: "getBidPblancListInfoPrtcptPsblRgn",
      field: "prtcptPsblRgnNm",
    });
    expect(result.documents).toHaveLength(10);
    expect(result.documents[9]).toMatchObject({
      identity: "G2B:R26BK01000001:000:10",
      evidence: { field: "ntceSpecDocUrl10" },
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
    for (const [urlText, init] of fetcher.mock.calls) {
      const url = new URL(urlText);
      const expectedQuery: Record<string, string> = {
        serviceKey: "test-key",
        type: "json",
        inqryDiv: "2",
        bidNtceNo: tender.sourceNoticeId,
        pageNo: "1",
        numOfRows: "100",
      };
      if (
        url.pathname.endsWith("getBidPblancListInfoLicenseLimit") ||
        url.pathname.endsWith("getBidPblancListInfoPrtcptPsblRgn") ||
        url.pathname.endsWith("getBidPblancListInfoThngPurchsObjPrdct")
      ) {
        expectedQuery.bidNtceOrd = tender.revision;
      }
      expect(Object.fromEntries(url.searchParams)).toEqual(expectedQuery);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("issues a bound reference for the recorded official goods attachment URL shape", async () => {
    const sourceNoticeId = "R26BK01707695";
    const recordedUrl =
      "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01707695&bidPbancOrd=000&fileType=&fileSeq=1&prcmBsneSeCd=01";
    const { client } = createClient((request) =>
      Promise.resolve(
        request.operation === "getBidPblancListInfoThng"
          ? [
              {
                bidNtceNo: sourceNoticeId,
                bidNtceOrd: "000",
                ntceSpecFileNm1: "물품 규격서.hwp",
                ntceSpecDocUrl1: recordedUrl,
              },
            ]
          : [],
      ),
    );

    const result = await new G2bEnrichmentAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    }).enrich({ ...tender, sourceNoticeId }, new AbortController().signal);

    expect(result.documents).toEqual([
      expect.objectContaining({
        identity: "G2B:R26BK01707695:000:1",
        url: recordedUrl,
        formatHint: "HWP",
      }),
    ]);
  });

  it("keeps successful facts and records each failed provider operation explicitly", async () => {
    const { client } = createClient((request) => {
      if (request.operation === "getBidPblancListInfoLicenseLimit") {
        return Promise.reject(
          new TenderSourceError(
            TenderSource.G2B,
            "HTTP_ERROR",
            503,
            undefined,
            request.operation,
            1,
            null,
            3,
          ),
        );
      }
      return Promise.resolve(rowsFor(request.operation));
    });

    const result = await new G2bEnrichmentAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    }).enrich(tender, new AbortController().signal);

    expect(result.basisAmount?.value).toBe("100000000");
    expect(result.licenses).toEqual([]);
    expect(result.failures).toEqual([
      {
        operation: "getBidPblancListInfoLicenseLimit",
        errorCode: "HTTP_ERROR",
        pageNo: 1,
        providerResultCode: null,
        httpStatus: 503,
        attempts: 3,
      },
    ]);
  });

  it("redacts arbitrary provider result text at the enrichment output boundary", async () => {
    const maliciousProviderText =
      "https://provider.example/error?serviceKey=secret-key-material";
    const { client } = createClient((request) => {
      if (request.operation === "getBidPblancListInfoThngBsisAmount") {
        return Promise.reject(
          new TenderSourceError(
            TenderSource.G2B,
            "PROVIDER_RESULT_ERROR",
            200,
            undefined,
            request.operation,
            1,
            maliciousProviderText,
            1,
          ),
        );
      }
      return Promise.resolve(rowsFor(request.operation));
    });

    const result = await new G2bEnrichmentAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "test-key",
    }).enrich(tender, new AbortController().signal);

    expect(result.failures[0]?.providerResultCode).toBe(
      "PROVIDER_CODE_REPORTED",
    );
    expect(JSON.stringify(result)).not.toContain(maliciousProviderText);
    expect(JSON.stringify(result)).not.toContain("secret-key-material");
  });

  it("uses the established relay policy when a direct enrichment response has no provider envelope", async () => {
    const direct = createClient((request) =>
      request.operation === "getBidPblancListInfoThngBsisAmount"
        ? Promise.reject(
            new TenderSourceError(
              TenderSource.G2B,
              "PROVIDER_RESULT_ERROR",
              200,
              undefined,
              request.operation,
              1,
              null,
              1,
            ),
          )
        : Promise.resolve(rowsFor(request.operation)),
    );
    const relay = createClient((request) =>
      Promise.resolve(rowsFor(request.operation)),
    );
    const AdapterWithRelay = G2bEnrichmentAdapter as unknown as new (
      client: TenderApiClient,
      config: {
        baseUrl: string;
        serviceKey: string;
        relayEnabled: boolean;
      },
      relayClient: TenderApiClient,
    ) => G2bEnrichmentAdapter;
    const adapter = new AdapterWithRelay(
      direct.client,
      {
        baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
        serviceKey: "test-key",
        relayEnabled: true,
      },
      relay.client,
    );

    const result = await adapter.enrich(tender, new AbortController().signal);

    expect(result.basisAmount?.value).toBe("100000000");
    expect(result.failures).toEqual([]);
    expect(relay.getAllPages).toHaveBeenCalledTimes(1);
    expect(relay.getAllPages).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "getBidPblancListInfoThngBsisAmount",
      }),
    );
  });

  it("constructs the module enrichment adapter with a relay client only when enabled", () => {
    const providers = Reflect.getMetadata("providers", TendersModule) as Array<{
      provide?: symbol;
      useFactory?: (config: {
        get(key: string): string | undefined;
      }) => unknown;
    }>;
    const provider = providers.find(
      (candidate) => candidate.provide === G2B_TENDER_ENRICHMENT_ADAPTER,
    );
    const values: Record<string, string> = {
      G2B_RELAY_ENABLED: "true",
      G2B_RELAY_URL: "https://dfkorealed.com/api/internal/g2b-relay",
      G2B_RELAY_SHARED_SECRET: "relay-test-secret-with-at-least-32-bytes",
      G2B_TENDER_API_BASE_URL:
        "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      PUBLIC_DATA_SERVICE_KEY: "test-key",
    };

    const adapter = provider?.useFactory?.({ get: (key) => values[key] });

    expect(adapter).toBeInstanceOf(G2bEnrichmentAdapter);
    expect(
      (adapter as { relayClient?: TenderApiClient }).relayClient,
    ).toBeDefined();
  });

  it("rejects a non-G2B or non-goods tender without provider access", async () => {
    const getAllPages = jest.fn();
    const client = { getAllPages } as TenderApiClient;
    const adapter = new G2bEnrichmentAdapter(client, {
      baseUrl: "x",
      serviceKey: "x",
    });

    await expect(
      adapter.enrich(
        { ...tender, source: TenderSource.KAPT },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "ENRICHMENT_SOURCE_MISMATCH" });
    await expect(
      adapter.enrich(
        { ...tender, procurementType: ProcurementType.SERVICE },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "ENRICHMENT_UNSUPPORTED_TYPE" });
    expect(getAllPages).not.toHaveBeenCalled();
  });
});

describe("incomplete G2B data through parser and analyzer", () => {
  const identity = {
    bidNtceNo: tender.sourceNoticeId,
    bidNtceOrd: tender.revision,
  };
  const invalidCases: Array<[string, string, Record<string, unknown>]> = [
    [
      "rejected attachment",
      "getBidPblancListInfoThng",
      {
        ntceSpecDocUrl1: "https://invalid.example/file?serviceKey=never-expose",
        ntceSpecFileNm1: "required.pdf",
      },
    ],
    [
      "advertised missing URL",
      "getBidPblancListInfoThng",
      { ntceSpecFileNm1: "required.pdf" },
    ],
    [
      "malformed URL",
      "getBidPblancListInfoThng",
      { ntceSpecDocUrl1: { private: "never-expose" } },
    ],
    [
      "malformed basis amount",
      "getBidPblancListInfoThngBsisAmount",
      { bssamt: { private: "never-expose" } },
    ],
    [
      "invalid lower rate",
      "getBidPblancListInfoThng",
      { sucsfbidLwltRate: "never-expose" },
    ],
    [
      "license name only",
      "getBidPblancListInfoLicenseLimit",
      { lcnsLmtNm: "전기공사업" },
    ],
    [
      "license code only",
      "getBidPblancListInfoLicenseLimit",
      { permsnIndstrytyList: "1468" },
    ],
    [
      "unnormalizable region name",
      "getBidPblancListInfoPrtcptPsblRgn",
      { prtcptPsblRgnNm: "알 수 없는 지역" },
    ],
    [
      "region code only",
      "getBidPblancListInfoPrtcptPsblRgn",
      { prtcptPsblRgnCd: "41" },
    ],
    [
      "purchase code only",
      "getBidPblancListInfoThngPurchsObjPrdct",
      { prdctClsfcNo: "39111515" },
    ],
  ];
  const run = async (operation: string, row: Record<string, unknown>) => {
    const { client } = createClient(async (request) => [
      ...(request.operation === operation ? [{ ...identity, ...row }] : []),
      ...(request.operation === "getBidPblancListInfoThngPurchsObjPrdct"
        ? [
            {
              ...identity,
              prdctClsfcNo: "39111515",
              prdctClsfcNoNm: "LED",
              prdctSpecNm: "소비전력 40W 이하",
            },
          ]
        : []),
    ]);
    const enriched = await new G2bEnrichmentAdapter(client, {
      baseUrl: "fixture",
      serviceKey: "fixture",
    }).enrich(tender, new AbortController().signal);
    const parsed = new TenderRequirementParser().parse(enriched, []);
    const result = new TenderSuitabilityAnalyzer().analyze(
      parsed,
      {
        companyName: "test",
        businessNumber: "1234567890",
        headquarters: { sido: "경기도", sigungu: "화성시" },
        g2bRegistered: true,
        supplyProducts: [],
        licenses: [],
        companyTypes: [],
        directProduction: [],
        certifications: [],
        performanceRecords: [],
        version: 1,
      },
      [
        {
          id: "hidden",
          power: [40],
          colorTemp: [],
          dimensions: "",
          certifications: [],
        },
      ],
      new Date(),
    );
    return { enriched, result };
  };
  it.each(invalidCases)(
    "keeps %s UNKNOWN and prevents a false recommendation",
    async (_label, operation, row) => {
      const { enriched, result } = await run(operation, row);
      expect(enriched.failures).toHaveLength(1);
      expect(result).toMatchObject({
        specificationScore: 100,
        suitability: "REVIEW",
      });
      expect(result.evidence).toEqual(
        expect.arrayContaining([expect.objectContaining({ state: "UNKNOWN" })]),
      );
      expect(
        JSON.stringify({ failures: enriched.failures, result }),
      ).not.toMatch(/never-expose|invalid.example|required.pdf/);
    },
  );
  it.each([
    ["prdctSpecNm", { private: "never-expose" }],
    ["prdctSpecNm", ["never-expose"]],
    ["prdctSpecNm", 40],
    ["qty", { private: "never-expose" }],
    ["unit", { private: "never-expose" }],
    ["prdctClsfcNoNm", { private: "never-expose" }],
    ["prdctClsfcNo", { private: "never-expose" }],
  ])(
    "preserves malformed advertised purchase field %s as incomplete",
    async (field, value) => {
      const { enriched, result } = await run(
        "getBidPblancListInfoThngPurchsObjPrdct",
        {
          prdctClsfcNo: "39111515",
          prdctClsfcNoNm: "LED",
          [field as string]: value,
        },
      );
      expect(enriched.failures.length).toBeGreaterThan(0);
      expect(result.suitability).toBe("REVIEW");
      expect(
        JSON.stringify({ failures: enriched.failures, result }),
      ).not.toContain("never-expose");
    },
  );
  it("also treats a discovered but unreadable attachment as UNKNOWN", async () => {
    const { enriched, result } = await run("getBidPblancListInfoThng", {
      ntceSpecDocUrl1: rowsFor("getBidPblancListInfoThng")[1].ntceSpecDocUrl1,
      ntceSpecFileNm1: "required.pdf",
    });
    expect(enriched.documents).toHaveLength(1);
    expect(result.suitability).toBe("REVIEW");
  });
  it("leaves truly absent optional document slots complete", async () => {
    const { enriched, result } = await run("getBidPblancListInfoThng", {
      ntceSpecDocUrl1: "",
      ntceSpecFileNm1: "",
    });
    expect(enriched.failures).toEqual([]);
    expect(result.suitability).toBe("RECOMMENDED");
  });
});

describe("verified G2B production pricing context", () => {
  const enriched = async (detailChanges: Record<string, unknown> = {}) => {
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "fixtures/g2b-enrichment-pricing.json"),
        "utf8",
      ),
    );
    Object.assign(
      fixture.getBidPblancListInfoThng.response.body.items[0],
      detailChanges,
    );
    const client = new PublicApiClient(
      async (url) =>
        new Response(
          JSON.stringify(fixture[new URL(url).pathname.split("/").at(-1)!]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    return new G2bEnrichmentAdapter(client, {
      baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
      serviceKey: "fixture",
    }).enrich(tender, new AbortController().signal);
  };
  const priceFor = (result: Awaited<ReturnType<typeof enriched>>) =>
    new TenderPriceAnalyzer().analyze(
      {
        ...new TenderRequirementParser().parse(result, []),
        pricingContext: {
          contractKind: "UNKNOWN",
          currency: "UNKNOWN",
          formulaKind: "UNKNOWN",
          ...result.pricingContext,
          source: "G2B",
          now: new Date(),
        },
      },
      [],
    );
  const wraps = [
    [" ", ""],
    ["\n", ""],
    ["\r\n", ""],
    [", ", ""],
    [" (", ")"],
    [" [", "]"],
    [" {", "}"],
    [" · ", ""],
    ["（", "）"],
    ["\n[", "]\n"],
  ];
  it.each(wraps)(
    "retains pricing qualifiers across %j ... %j",
    async (open, close) => {
      for (const qualifier of [
        "미확정",
        "미 확정",
        "여부",
        "확인 필요",
        "가능",
        "예정",
        "검토",
        "조건부",
        "적용할 경우",
        "미적용 아님",
        "A값 적용",
      ]) {
        for (const declaration of ["A값 미적용", "총액입찰", "원화 KRW"]) {
          const facts = ["총액입찰", "원화 KRW", "A값 미적용"].map((fact) =>
            fact === declaration ? `${fact}${open}${qualifier}${close}` : fact,
          );
          const result = await enriched({
            bidNtceNm: `LED 구매 (${facts.join(", ")})`,
          });
          expect({
            title: facts.join(", "),
            status: priceFor(result).official.status,
          }).toEqual({
            title: facts.join(", "),
            status: "FORMULA_REVIEW_REQUIRED",
          });
          expect(result.pricingContext).toBeUndefined();
        }
      }
    },
  );
  it.each(wraps)(
    "accepts confirmed declarations across %j ... %j",
    async (open, close) => {
      for (const noA of ["A값 미적용", "A 값 미적용 대상"]) {
        const title = `LED 구매 ${["총액입찰", "원화 KRW", noA].map((fact) => `${open}${fact}${close}`).join(", ")}`;
        const result = await enriched({ bidNtceNm: title });
        expect(priceFor(result).official.status).toBe("AVAILABLE");
      }
    },
  );
  it("withholds oversized declaration context instead of inspecting a truncated prefix", async () => {
    const result = await enriched({
      bidNtceNm: `LED 구매 (총액입찰, 원화 KRW, A값 미적용)${" ".repeat(4096)}미확정`,
    });
    expect(priceFor(result).official.status).toBe("FORMULA_REVIEW_REQUIRED");
  });
  it("emits supported total KRW context only with explicit official facts", async () => {
    expect((await enriched()).pricingContext).toMatchObject({
      contractKind: "TOTAL",
      currency: "KRW",
      formulaKind: "STANDARD",
      awardMethod: "적격심사",
      region: "41",
      productGroup: "LED",
    });
  });
  it.each(["미적용", "미적용 대상"])(
    "prices an affirmative no-A declaration: %s",
    async (declaration) => {
      const result = await enriched({
        bidNtceNm: `LED 구매 (총액입찰, 원화 KRW, A값 ${declaration})`,
      });
      const price = new TenderPriceAnalyzer().analyze(
        {
          ...new TenderRequirementParser().parse(result, []),
          pricingContext: {
            contractKind: "UNKNOWN",
            currency: "UNKNOWN",
            formulaKind: "UNKNOWN",
            ...result.pricingContext,
            source: "G2B",
            now: new Date(),
          },
        },
        [],
      );
      expect(result.pricingContext).toBeDefined();
      expect(price.official.status).toBe("AVAILABLE");
    },
  );
  it.each([
    { bidNtceNm: "LED 구매" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용 여부 확인 필요)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용 가능)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 적용 여부 확인)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용 또는 적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용, A값 적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용 대상일 경우)" },
    { bidNtceNm: "LED 구매 (총액입찰 여부 확인, 원화, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액입찰 가능, 원화, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화 결제 여부 확인, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액, KRW 사용 가능, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액입찰 아님, 원화, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화 결제 불가, A값 미적용)" },
    { bidNtceNm: "LED 구매 (단가, 총액, 원화 KRW, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액, USD, A값 미적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 적용)" },
    { bidNtceNm: "LED 구매 (총액, 원화, A값 미적용, 특수산식)" },
    { intrbidYn: "Y" },
    { sucsfbidMthdNm: "협상에 의한 계약" },
    { prearngPrceDcsnMthdNm: "단일예가" },
  ])(
    "leaves ambiguous/unit/foreign/special or unknown A-value facts unpriced: %j",
    async (change) => {
      const result = await enriched(change);
      const parsed = new TenderRequirementParser().parse(result, []);
      const price = new TenderPriceAnalyzer().analyze(
        {
          ...parsed,
          pricingContext: {
            contractKind: "UNKNOWN",
            currency: "UNKNOWN",
            formulaKind: "UNKNOWN",
            ...result.pricingContext,
            source: "G2B",
            now: new Date(),
          },
        },
        [],
      );
      expect(result.pricingContext).toBeUndefined();
      expect(price.official.status).toBe("FORMULA_REVIEW_REQUIRED");
    },
  );
});

it("aggregates every rejected row into bounded stable value-free failure buckets", async () => {
  const { client } = createClient(async (request) =>
    request.operation === "getBidPblancListInfoLicenseLimit"
      ? Array.from({ length: 1000 }, () => ({
          bidNtceNo: tender.sourceNoticeId,
          bidNtceOrd: tender.revision,
          lcnsLmtNm: "private-provider-condition",
        }))
      : [],
  );
  const result = await new G2bEnrichmentAdapter(client, {
    baseUrl: "fixture",
    serviceKey: "fixture",
  }).enrich(tender, new AbortController().signal);
  expect(result.failures).toEqual([
    expect.objectContaining({
      errorCode: "SOURCE_RESTRICTION_INCOMPLETE",
      rejectedCount: 1000,
    }),
  ]);
  expect(JSON.stringify(result.failures).length).toBeLessThan(300);
  expect(JSON.stringify(result)).not.toContain("private-provider-condition");
});
