import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KaptEnrichmentAdapter } from "./kapt-enrichment.adapter";
import { NormalizedTender } from "../domain/normalized-tender";
import { ProcurementType, TenderSource } from "../domain/tender.enums";

const html = readFileSync(
  join(__dirname, "fixtures/kapt-enrichment.html"),
  "utf8",
);
const tender: NormalizedTender = {
  source: TenderSource.KAPT,
  sourceNoticeId: "202609060001",
  revision: "1",
  title: "공동주택 LED 조명 교체",
  orderingOrganization: "테스트아파트",
  demandOrganization: null,
  registeredAt: new Date("2026-09-06T00:00:00Z"),
  bidStartedAt: null,
  bidEndedAt: null,
  openedAt: null,
  region: "경기도",
  procurementType: ProcurementType.OTHER,
  contractMethod: null,
  estimatedAmount: null,
  sourceUrl: "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=202609060001",
  itemName: "",
  description: "",
  attachmentNames: [],
  rawData: {},
};

describe("KaptEnrichmentAdapter", () => {
  it("discovers only direct official attachment anchors bound to the same notice", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html;charset=UTF-8" },
      }),
    );
    const signal = new AbortController().signal;

    const result = await new KaptEnrichmentAdapter(fetcher).enrich(
      tender,
      signal,
    );

    expect(result.documents).toEqual([
      expect.objectContaining({
        displayName: "공고문.pdf",
        formatHint: "PDF",
        source: "KAPT_PAGE",
        sourceNoticeId: "202609060001",
      }),
      expect.objectContaining({
        displayName: "규격서.hwpx",
        formatHint: "HWPX",
        source: "KAPT_PAGE",
        sourceNoticeId: "202609060001",
      }),
    ]);
    expect(result.failures).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(tender.sourceUrl, {
      method: "GET",
      redirect: "error",
      signal,
    });
    expect(JSON.stringify(result)).not.toContain("evil.example");
    expect(JSON.stringify(result)).not.toContain("ANOTHER-NOTICE");
    expect(JSON.stringify(result)).not.toContain("login.do");
  });

  it("returns a safe partial failure when the canonical page is unavailable", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(new Response("provider secret", { status: 503 }));

    const result = await new KaptEnrichmentAdapter(fetcher).enrich(
      tender,
      new AbortController().signal,
    );

    expect(result.documents).toEqual([]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        operation: "KAPT_NOTICE_DOCUMENTS",
        errorCode: "HTTP_ERROR",
        httpStatus: 503,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("provider secret");
  });

  it("does not navigate a non-canonical or mismatched notice page", async () => {
    const fetcher = jest.fn();
    const adapter = new KaptEnrichmentAdapter(fetcher);

    for (const sourceUrl of [
      "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=OTHER",
      "https://k-apt.go.kr/bid/bidDetail.do?bidNum=202609060001",
      "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=202609060001#attachment",
    ]) {
      await expect(
        adapter.enrich({ ...tender, sourceUrl }, new AbortController().signal),
      ).rejects.toMatchObject({ code: "ENRICHMENT_NOTICE_MISMATCH" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
