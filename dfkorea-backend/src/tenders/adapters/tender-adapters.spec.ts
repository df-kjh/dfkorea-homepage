const g2bFixture = require("./fixtures/g2b-notices.json");
const kaptFixture = require("./fixtures/kapt-notices.json");
const kepcoFixture = require("./fixtures/kepco-notices.json");
import { G2bTenderAdapter } from "./g2b-tender.adapter";
import { KaptTenderAdapter } from "./kapt-tender.adapter";
import { KepcoTenderAdapter } from "./kepco-tender.adapter";
import {
  PublicApiClient,
  TenderApiClient,
  TenderSourceError,
} from "./public-api-client";
import { TenderFetchWindow } from "../domain/tender-source.adapter";
import { ProcurementType, TenderSource } from "../domain/tender.enums";

const window: TenderFetchWindow = {
  from: new Date("2026-08-26T00:00:00.000Z"),
  to: new Date("2026-08-27T00:00:00.000Z"),
};

const createClient = (): jest.Mocked<TenderApiClient> => ({
  getAllPages: jest.fn(),
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
});

describe("PublicApiClient", () => {
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
});
