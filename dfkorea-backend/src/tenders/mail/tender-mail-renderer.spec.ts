import {
  ProcurementType,
  TenderRelevance,
  TenderSource,
  TenderOpportunityType,
} from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import { TenderMailRenderer } from "./tender-mail-renderer";

const tender = (overrides: Partial<Tender> = {}): Tender =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    title: "<LED> 교체 & 공사",
    orderingOrganization: "발주 <기관>",
    demandOrganization: null,
    source: TenderSource.G2B,
    sourceNoticeId: "N-1",
    revision: "00",
    registeredAt: new Date("2026-08-26T15:00:00.000Z"),
    bidStartedAt: null,
    bidEndedAt: new Date("2026-08-30T15:00:00.000Z"),
    openedAt: null,
    region: "서울 & 경기",
    procurementType: ProcurementType.CONSTRUCTION,
    contractMethod: null,
    estimatedAmount: "1200000",
    sourceUrl: "https://example.com/?q=<unsafe>",
    relevance: TenderRelevance.DIRECT,
    relevanceScore: 100,
    relevanceReasons: [{ field: "title", keyword: "<LED>", score: 100 }],
    opportunityType: TenderOpportunityType.GOODS_SUPPLY,
    opportunityReasons: ["물품 업무구분"],
    rawData: {},
    firstCollectedAt: new Date(),
    lastUpdatedAt: new Date(),
    ...overrides,
  }) as Tender;

describe("TenderMailRenderer", () => {
  it("separates direct and potential notices while escaping external HTML", () => {
    const rendered = new TenderMailRenderer().render(
      new Date("2026-08-27T01:00:00.000Z"),
      [
        tender(),
        tender({
          id: "00000000-0000-4000-8000-000000000002",
          relevance: TenderRelevance.POTENTIAL,
          title: "시설개선",
        }),
      ],
    );

    expect(rendered.subject).toBe(
      "[DF KOREA 입찰정보] 2026-08-27 신규 공고 2건",
    );
    expect(rendered.html).toContain("💡 직접 관련 (1건)");
    expect(rendered.html).toContain("⚡ 잠재 관련 (1건)");
    expect(rendered.html).toContain("&lt;LED&gt; 교체 &amp; 공사");
    expect(rendered.html).not.toContain("<LED> 교체");
    expect(rendered.html).toContain("https://example.com/?q=%3Cunsafe%3E");
    expect(rendered.text).toContain("💡 직접 관련 (1건)");
    expect(rendered.text).toContain("⚡ 잠재 관련 (1건)");
    expect(rendered.html).toContain("title · &lt;LED&gt; · 100점");
    expect(rendered.text).toContain("title · <LED> · 100점");
    expect(rendered.html).not.toContain("[object Object]");
    expect(rendered.text).not.toContain("[object Object]");
  });

  it("omits non-HTTP official links rather than emitting an executable URL", () => {
    const rendered = new TenderMailRenderer().render(
      new Date("2026-08-27T01:00:00.000Z"),
      [tender({ sourceUrl: "javascript:alert(1)" })],
    );

    expect(rendered.html).not.toContain("javascript:");
    expect(rendered.html).not.toContain("공식 원문 보기");
    expect(rendered.text).not.toContain("javascript:");
  });

  it("renders supply and MAS opportunity labels with their reasons without raw source data", () => {
    const rendered = new TenderMailRenderer().render(
      new Date("2026-08-27T01:00:00.000Z"),
      [
        tender(),
        tender({
          id: "00000000-0000-4000-8000-000000000003",
          opportunityType: TenderOpportunityType.MAS,
          opportunityReasons: ["MAS 표현: 제목"],
          rawData: { internalOnly: "do-not-show" },
        }),
      ],
    );

    for (const content of [rendered.html, rendered.text]) {
      expect(content).toContain("📦 물품 납품");
      expect(content).toContain("🧾 MAS");
      expect(content).toContain("기회 판정 근거: 물품 업무구분");
      expect(content).toContain("기회 판정 근거: MAS 표현: 제목");
      expect(content).not.toContain("do-not-show");
    }
  });
});
