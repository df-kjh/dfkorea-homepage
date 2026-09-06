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
