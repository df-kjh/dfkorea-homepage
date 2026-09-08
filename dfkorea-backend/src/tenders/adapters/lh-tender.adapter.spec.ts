import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LhHtmlClient, LhHtmlRequest } from "./public-api-client";
import { LhTenderAdapter } from "./lh-tender.adapter";
import {
  ProcurementType,
  SyncRunStatus,
  TenderSource,
} from "../domain/tender.enums";

const fixtures = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

const noticesHtml = fixtures("lh-notices.html");
const detailHtml = fixtures("lh-detail-material.html");
const emptyNoticesHtml = noticesHtml.replace(
  /<tr>\s*<td>1[\s\S]*?<\/tr>\s*<tr>\s*<td>2[\s\S]*?<\/tr>\s*<tr>\s*<td>3[\s\S]*?<\/tr>/,
  "",
);

const window = {
  from: new Date("2026-09-01T00:00:00.000Z"),
  to: new Date("2026-09-10T00:00:00.000Z"),
};

class StubLhHtmlClient implements LhHtmlClient {
  readonly requests: LhHtmlRequest[] = [];

  constructor(
    private readonly respond: (
      request: LhHtmlRequest,
    ) => Promise<string> | string,
  ) {}

  request(request: LhHtmlRequest): Promise<string> {
    this.requests.push(request);
    return Promise.resolve(this.respond(request));
  }
}

describe("LhTenderAdapter", () => {
  it("returns an empty successful result without requesting LH when disabled", async () => {
    const client = new StubLhHtmlClient(() => noticesHtml);
    const adapter = new LhTenderAdapter(client, {
      enabled: false,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual({
      notices: [],
      status: SyncRunStatus.SUCCEEDED,
      errorCode: null,
      failures: [],
    });
    expect(client.requests).toEqual([]);
  });

  it("posts both LH work types, deduplicates candidates, and maps a lighting detail", async () => {
    const client = new StubLhHtmlClient((request) =>
      request.operation === "detail" ? detailHtml : noticesHtml,
    );
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    const result = await adapter.fetchNotices(window);

    expect(
      client.requests
        .filter((request) => request.operation === "list")
        .map((request) => request.form?.workTypeCode),
    ).toEqual(["30", "40"]);
    expect(
      client.requests.filter((request) => request.operation === "detail"),
    ).toHaveLength(1);
    expect(result).toEqual({
      status: SyncRunStatus.SUCCEEDED,
      errorCode: null,
      failures: [],
      notices: [
        expect.objectContaining({
          source: TenderSource.LH,
          sourceNoticeId: "LH-2026-1001",
          revision: "00",
          title: "LED 가로등 구매",
          orderingOrganization: "한국토지주택공사 경기남부지역본부",
          demandOrganization: "한국토지주택공사",
          registeredAt: new Date("2026-08-31T15:00:00.000Z"),
          bidStartedAt: new Date("2026-09-08T01:00:00.000Z"),
          bidEndedAt: new Date("2026-09-10T05:00:00.000Z"),
          openedAt: new Date("2026-09-10T06:00:00.000Z"),
          procurementType: ProcurementType.GOODS,
          contractMethod: "제한경쟁",
          estimatedAmount: "12345000",
          region: "경기도 화성시",
          attachmentNames: ["공고문.pdf", "물량내역.xlsx"],
          rawData: {
            lh: {
              workTypeCode: "30",
              emergencyOrder: "Y",
              detailPath:
                "/ebid.et.tp.cmd.BidMasterDetailCmd.dev?bidNum=LH-2026-1001&bidSeq=00",
              basisAmount: "12345000",
              attachments: [
                {
                  sequence: "1",
                  displayName: "공고문.pdf",
                  savedName: "20260901_notice.pdf",
                },
                {
                  sequence: "2",
                  displayName: "물량내역.xlsx",
                  savedName: "20260901_items.xlsx",
                },
              ],
            },
          },
        }),
      ],
    });
  });

  it("requests list pages sequentially before collecting a candidate detail", async () => {
    const secondPage = emptyNoticesHtml.replace(
      'data-total-pages="1"',
      'data-total-pages="2"',
    );
    const firstPage = noticesHtml.replace(
      'data-total-pages="1"',
      'data-total-pages="2"',
    );
    const client = new StubLhHtmlClient((request) => {
      if (request.operation === "detail") return detailHtml;
      return request.form?.pageNo === "1" ? firstPage : secondPage;
    });
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    await adapter.fetchNotices(window);

    expect(
      client.requests.map(
        (request) =>
          `${request.operation}:${request.form?.workTypeCode ?? ""}:${request.form?.pageNo ?? ""}`,
      ),
    ).toEqual(["list:30:1", "list:30:2", "list:40:1", "list:40:2", "detail::"]);
  });

  it("reports a structure change instead of treating malformed list HTML as empty", async () => {
    const client = new StubLhHtmlClient(() => "<main>로그인</main>");
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual(
      expect.objectContaining({
        notices: [],
        status: SyncRunStatus.FAILED,
        errorCode: "STRUCTURE_CHANGED",
        failures: expect.arrayContaining([
          expect.objectContaining({ errorCode: "STRUCTURE_CHANGED" }),
        ]),
      }),
    );
  });

  it("returns a bounded partial result when the configured page cap is reached", async () => {
    const oversizedPage = noticesHtml.replace(
      'data-total-pages="1"',
      'data-total-pages="2"',
    );
    const client = new StubLhHtmlClient((request) =>
      request.operation === "detail" ? detailHtml : oversizedPage,
    );
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
      maximumPages: 1,
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual(
      expect.objectContaining({
        status: SyncRunStatus.PARTIAL,
        errorCode: "PARTIAL_PROVIDER_FAILURE",
        failures: expect.arrayContaining([
          expect.objectContaining({ errorCode: "PAGINATION_LIMIT" }),
        ]),
      }),
    );
  });
});
