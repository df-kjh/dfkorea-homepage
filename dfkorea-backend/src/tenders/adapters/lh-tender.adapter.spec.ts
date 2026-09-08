import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BoundedLhHtmlClient,
  LhHtmlClient,
  LhHtmlRequest,
} from "./public-api-client";
import { LhTenderAdapter } from "./lh-tender.adapter";
import {
  LhHtmlStructureError,
  parseLhListPage,
  parseLhTenderDetail,
} from "./lh-html";
import {
  ProcurementType,
  SyncRunStatus,
  TenderSource,
} from "../domain/tender.enums";

const fixtures = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

const noticesHtml = fixtures("lh-notices.html");
const materialNoticesHtml = fixtures("lh-notices-material.html");
const detailHtml = fixtures("lh-detail-material.html");
const emptyNoticesHtml = noticesHtml.replace(
  /<tr onclick="fn_dds_open\('[\s\S]*?<\/tr>\s*<tr onclick="fn_dds_open\('[\s\S]*?<\/tr>\s*<tr onclick="fn_dds_open\('[\s\S]*?<\/tr>/,
  "",
);
const normalEmptyNoticesHtml = emptyNoticesHtml.replace(
  "</tbody>",
  '<tr><td colspan="8">해당 자료가 없음</td></tr></tbody>',
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

  it("uses the collection-time deadline window, validates work types, and maps a lighting detail", async () => {
    const client = new StubLhHtmlClient((request) => {
      if (request.operation === "detail") return detailHtml;
      return request.form?.s_cstrtnJobGbCd === "30"
        ? noticesHtml
        : materialNoticesHtml;
    });
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    const result = await adapter.fetchNotices(window);

    expect(
      client.requests
        .filter((request) => request.operation === "list")
        .map((request) => request.form),
    ).toEqual([
      {
        s_cstrtnJobGbCd: "30",
        s_bidnm: "",
        s_tndrdocAcptOpenDtm: "2026/09/03",
        s_tndrdocAcptEndDtm: "2027/03/09",
        targetRow: "1",
        pageSpec: "default",
        devonOrderBy: "",
      },
      {
        s_cstrtnJobGbCd: "40",
        s_bidnm: "",
        s_tndrdocAcptOpenDtm: "2026/09/03",
        s_tndrdocAcptEndDtm: "2027/03/09",
        targetRow: "1",
        pageSpec: "default",
        devonOrderBy: "",
      },
    ]);
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
          sourceNoticeId: "2603251",
          revision: "00",
          title: "LED 가로등 구매",
          orderingOrganization: "한국토지주택공사 경기남부지역본부",
          demandOrganization: null,
          registeredAt: new Date("2026-08-31T15:00:00.000Z"),
          bidStartedAt: new Date("2026-09-08T01:00:00.000Z"),
          bidEndedAt: new Date("2026-09-10T05:00:00.000Z"),
          openedAt: new Date("2026-09-10T06:00:00.000Z"),
          procurementType: ProcurementType.GOODS,
          contractMethod: "제한경쟁",
          estimatedAmount: "12345000",
          region: "경기도 화성시",
          sourceUrl:
            "https://ebid.lh.or.kr/ebid.et.tp.cmd.BidgdsDetailListCmd.dev?bidNum=2603251&bidDegree=00&cstrtnJobGbCd=30&emrgncyOrder=Y",
          attachmentNames: ["공고문.pdf", "물량내역.xlsx"],
          rawData: {
            lh: {
              workTypeCode: "30",
              emergencyOrder: "Y",
              detailPath:
                "/ebid.et.tp.cmd.BidgdsDetailListCmd.dev?bidNum=2603251&bidDegree=00&cstrtnJobGbCd=30&emrgncyOrder=Y",
              basisAmount: "12345000",
              attachments: [
                {
                  sequence: "10",
                  displayName: "공고문.pdf",
                  savedName: "20260901_notice.pdf",
                },
                {
                  sequence: "20",
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

  it("uses targetRow pagination sequentially before collecting a candidate detail", async () => {
    const secondPage = normalEmptyNoticesHtml
      .replace('name="targetRow" value="1"', 'name="targetRow" value="11"')
      .replace(
        "<option value=1 selected>1</option>",
        "<option value=11 selected>2</option>",
      );
    const firstPage = noticesHtml.replace(
      "<option value=1 selected>1</option>",
      "<option value=1 selected>1</option><option value=11>2</option>",
    );
    const materialFirstPage = materialNoticesHtml.replace(
      "<option value=1 selected>1</option>",
      "<option value=1 selected>1</option><option value=11>2</option>",
    );
    const client = new StubLhHtmlClient((request) => {
      if (request.operation === "detail") return detailHtml;
      if (request.form?.targetRow === "11") return secondPage;
      return request.form?.s_cstrtnJobGbCd === "30"
        ? firstPage
        : materialFirstPage;
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
          `${request.operation}:${request.form?.s_cstrtnJobGbCd ?? ""}:${request.form?.targetRow ?? ""}`,
      ),
    ).toEqual([
      "list:30:1",
      "list:30:11",
      "list:40:1",
      "list:40:11",
      "detail::",
    ]);
  });

  it("rejects mismatched work types and ambiguous detail identities", () => {
    expect(() => parseLhListPage(materialNoticesHtml, "30")).toThrow(
      LhHtmlStructureError,
    );
    expect(() =>
      parseLhListPage(
        noticesHtml.replace(
          "fn_dds_open('2603251','00','30','Y')",
          "fn_dds_open('2603251','00','30','Y','extra')",
        ),
        "30",
      ),
    ).toThrow(LhHtmlStructureError);
  });

  it("accepts only the known normal empty list row", () => {
    expect(parseLhListPage(normalEmptyNoticesHtml, "30")).toEqual({
      rows: [],
      nextTargetRow: null,
    });
    expect(() => parseLhListPage(emptyNoticesHtml, "30")).toThrow(
      LhHtmlStructureError,
    );
  });

  it("accepts quoted paginator offsets while ignoring numeric filter options", () => {
    const quotedPaginator = noticesHtml.replace(
      "<option value=1 selected>1</option>",
      '<option value="1" selected>1</option><option value="11">2</option>',
    );
    expect(parseLhListPage(quotedPaginator, "30").nextTargetRow).toBe("11");
  });

  it("requires every public detail identity part and fails malformed attachment rows", () => {
    expect(() => parseLhTenderDetail(detailHtml, "2603251", "01")).toThrow(
      LhHtmlStructureError,
    );
    expect(() =>
      parseLhTenderDetail(
        detailHtml.replace("javascript:fn_dds_open", "javascript:unknown"),
        "2603251",
        "00",
      ),
    ).toThrow(LhHtmlStructureError);
  });

  it("allows the known no-file row without accepting malformed attachment data", () => {
    const noFileDetail = detailHtml.replace(
      /<tr><th>첨부파일<\/th>[\s\S]*?<\/tr>\s*<tr><th>첨부파일<\/th>[\s\S]*?<\/tr>/,
      "<tr><td>첨부파일이 없습니다.</td></tr>",
    );
    expect(
      parseLhTenderDetail(noFileDetail, "2603251", "00").attachments,
    ).toEqual([]);
  });

  it.each([
    [
      "an empty tbody",
      '<table summary="파일정보"><thead><tr><th>문서명</th><th>공고파일명</th></tr></thead><tbody></tbody></table>',
    ],
    [
      "a header-only table",
      '<table summary="파일정보"><thead><tr><th>문서명</th><th>공고파일명</th></tr></thead><tbody></tbody></table>',
    ],
    [
      "a th-only unknown row",
      '<table summary="파일정보"><tbody><tr><th>알 수 없는 파일</th></tr></tbody></table>',
    ],
  ])(
    "rejects %s instead of silently dropping attachments",
    (_caseName, fileTable) => {
      const malformedDetail = detailHtml.replace(
        /<table summary="파일정보">[\s\S]*?<\/table>/,
        fileTable,
      );
      expect(() =>
        parseLhTenderDetail(malformedDetail, "2603251", "00"),
      ).toThrow(LhHtmlStructureError);
    },
  );

  it.each([
    ["a missing header", /<thead>[\s\S]*?<\/thead>\s*/],
    [
      "a duplicate header",
      /<tbody>\s*<tr><th>첨부파일/,
      "<tbody><tr><th>문서명</th><th>공고파일명</th></tr><tr><th>첨부파일",
    ],
    [
      "a header in a data position",
      /<tr><th>첨부파일<\/th>/,
      "<tr><th>문서명</th><th>공고파일명</th></tr><tr><th>첨부파일</th>",
    ],
  ])(
    "rejects %s in the public file table",
    (_caseName, pattern, replacement = "") => {
      const malformedDetail = detailHtml.replace(pattern, replacement);
      expect(() =>
        parseLhTenderDetail(malformedDetail, "2603251", "00"),
      ).toThrow(LhHtmlStructureError);
    },
  );

  it("rejects a detail page whose tender identity differs from its list row", async () => {
    const client = new StubLhHtmlClient((request) => {
      if (request.operation === "detail") {
        return detailHtml.replace("2603251 - 00", "2603999 - 00");
      }
      return request.form?.s_cstrtnJobGbCd === "30"
        ? noticesHtml
        : materialNoticesHtml;
    });
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual(
      expect.objectContaining({
        notices: [],
        status: SyncRunStatus.PARTIAL,
        failures: expect.arrayContaining([
          expect.objectContaining({
            operation: "detail",
            errorCode: "STRUCTURE_CHANGED",
          }),
        ]),
      }),
    );
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
    const paginatedPage = noticesHtml.replace(
      "<option value=1 selected>1</option>",
      "<option value=1 selected>1</option><option value=11>2</option>",
    );
    const client = new StubLhHtmlClient((request) =>
      request.operation === "detail"
        ? detailHtml
        : request.form?.s_cstrtnJobGbCd === "30"
          ? paginatedPage
          : materialNoticesHtml,
    );
    const adapter = new LhTenderAdapter(client, {
      enabled: true,
      baseUrl: "https://ebid.lh.or.kr",
      requestIntervalMs: 0,
      maximumPages: 1,
    });

    await expect(adapter.fetchNotices(window)).resolves.toEqual(
      expect.objectContaining({
        notices: [
          expect.objectContaining({
            sourceNoticeId: "2603251",
            revision: "00",
          }),
        ],
        status: SyncRunStatus.PARTIAL,
        errorCode: "PARTIAL_PROVIDER_FAILURE",
        failures: expect.arrayContaining([
          expect.objectContaining({ errorCode: "PAGINATION_LIMIT" }),
        ]),
      }),
    );
  });
});

const htmlRequest: LhHtmlRequest = {
  source: TenderSource.LH,
  operation: "list",
  baseUrl: "https://ebid.lh.or.kr",
  path: "/ebid.et.tp.cmd.BidMasterListCmd.dev",
  method: "POST",
  form: { targetRow: "1" },
};

describe("BoundedLhHtmlClient", () => {
  const response = (
    body: string,
    status = 200,
    headers?: Record<string, string>,
  ) => new Response(body, { status, headers });

  it("follows same-host redirects and converts POST to GET for 302", async () => {
    const fetcher = jest
      .fn<Promise<Response>, [string, RequestInit?]>()
      .mockResolvedValueOnce(response("", 302, { location: "/next" }))
      .mockResolvedValueOnce(response("ok"));
    const client = new BoundedLhHtmlClient(fetcher);

    await expect(client.request(htmlRequest)).resolves.toBe("ok");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://ebid.lh.or.kr/ebid.et.tp.cmd.BidMasterListCmd.dev",
      "https://ebid.lh.or.kr/next",
    ]);
    expect(fetcher.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetcher.mock.calls[1][1]?.body).toBeUndefined();
  });

  it.each([
    "https://evil.example/path",
    "http://ebid.lh.or.kr/path",
    "http://[::1",
  ])("rejects an unsafe redirect target %s", async (location) => {
    const client = new BoundedLhHtmlClient(() =>
      Promise.resolve(response("", 302, { location })),
    );
    await expect(client.request(htmlRequest)).rejects.toEqual(
      expect.objectContaining({ code: "UNSAFE_REDIRECT" }),
    );
  });

  it.each([
    "https://evil.example/path",
    "http://ebid.lh.or.kr/path",
    "http://[::1",
  ])("cancels an unsafe redirect response for %s", async (location) => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const unsafeRedirect = {
      status: 302,
      ok: false,
      headers: new Headers({ location }),
      url: "",
      body: { cancel },
    } as unknown as Response;

    await expect(
      new BoundedLhHtmlClient(() => Promise.resolve(unsafeRedirect)).request(
        htmlRequest,
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects more than five redirects", async () => {
    const cancels = Array.from({ length: 6 }, () =>
      jest.fn().mockResolvedValue(undefined),
    );
    let call = 0;
    const client = new BoundedLhHtmlClient(() =>
      Promise.resolve({
        status: 302,
        ok: false,
        headers: new Headers({ location: "/again" }),
        url: "",
        body: { cancel: cancels[call++] },
      } as unknown as Response),
    );
    await expect(client.request(htmlRequest)).rejects.toEqual(
      expect.objectContaining({ code: "UNSAFE_REDIRECT" }),
    );
    await Promise.resolve();
    expect(cancels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mock: expect.objectContaining({ calls: [[]] }),
        }),
      ]),
    );
    expect(cancels.every((cancel) => cancel.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it.each([
    ["content length", response("ok", 200, { "content-length": "3" })],
    ["actual bytes", response("abc")],
  ])("caps HTML responses by %s", async (_caseName, value) => {
    const client = new BoundedLhHtmlClient(() => Promise.resolve(value), {
      maximumBodyBytes: 2,
    });
    await expect(client.request(htmlRequest)).rejects.toEqual(
      expect.objectContaining({ code: "RESPONSE_TOO_LARGE" }),
    );
  });

  it("cancels redirect, HTTP error, and oversized response bodies", async () => {
    const redirectCancel = jest.fn().mockResolvedValue(undefined);
    const errorCancel = jest.fn().mockResolvedValue(undefined);
    const oversizedCancel = jest.fn().mockResolvedValue(undefined);
    const body = (cancel: jest.Mock) => ({ cancel });
    const redirect = {
      status: 302,
      ok: false,
      headers: new Headers({ location: "/next" }),
      url: "",
      body: body(redirectCancel),
    } as unknown as Response;
    const failure = {
      status: 500,
      ok: false,
      headers: new Headers(),
      url: "",
      body: body(errorCancel),
    } as unknown as Response;
    const oversized = {
      status: 200,
      ok: true,
      headers: new Headers({ "content-length": "3" }),
      url: "",
      body: body(oversizedCancel),
    } as unknown as Response;
    const fetcher = jest
      .fn<Promise<Response>, [string, RequestInit?]>()
      .mockResolvedValueOnce(redirect)
      .mockResolvedValueOnce(response("ok"));

    await expect(
      new BoundedLhHtmlClient(fetcher).request(htmlRequest),
    ).resolves.toBe("ok");
    await expect(
      new BoundedLhHtmlClient(() => Promise.resolve(failure)).request(
        htmlRequest,
      ),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
    await expect(
      new BoundedLhHtmlClient(() => Promise.resolve(oversized), {
        maximumBodyBytes: 2,
      }).request(htmlRequest),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    await Promise.resolve();
    expect(redirectCancel).toHaveBeenCalledTimes(1);
    expect(errorCancel).toHaveBeenCalledTimes(1);
    expect(oversizedCancel).toHaveBeenCalledTimes(1);
  });

  it("caps a content-length-less streamed body before buffering it all", async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel,
    });
    const client = new BoundedLhHtmlClient(
      () => Promise.resolve(new Response(stream)),
      {
        maximumBodyBytes: 2,
      },
    );

    await expect(client.request(htmlRequest)).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe base and request path hosts", async () => {
    const client = new BoundedLhHtmlClient(() =>
      Promise.resolve(response("ok")),
    );
    await expect(
      client.request({ ...htmlRequest, baseUrl: "https://evil.example" }),
    ).rejects.toEqual(expect.objectContaining({ code: "CONFIGURATION_ERROR" }));
    await expect(
      client.request({ ...htmlRequest, path: "https://evil.example/path" }),
    ).rejects.toEqual(expect.objectContaining({ code: "CONFIGURATION_ERROR" }));
  });

  it("aborts a request at the configured timeout", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    );
    const client = new BoundedLhHtmlClient(fetcher, { timeoutMs: 10 });
    const pending = expect(client.request(htmlRequest)).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await jest.advanceTimersByTimeAsync(10);
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("keeps the deadline through a slow response body and cancels it", async () => {
    jest.useFakeTimers();
    const cancel = jest.fn();
    const stalledResponse = {
      status: 200,
      ok: true,
      headers: new Headers(),
      url: "",
      body: {
        getReader: () => ({
          read: () => new Promise<never>(() => undefined),
          cancel: () => {
            cancel();
            return Promise.resolve();
          },
        }),
      },
    } as unknown as Response;
    const client = new BoundedLhHtmlClient(
      () => Promise.resolve(stalledResponse),
      { timeoutMs: 10 },
    );
    const pending = expect(client.request(htmlRequest)).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await pending;
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
