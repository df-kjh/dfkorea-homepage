import { TenderRelevance } from "./tender.enums";
import { TenderClassifier } from "./tender-classifier";

describe("TenderClassifier", () => {
  const classifier = new TenderClassifier();

  it.each([
    "LED 가로등 교체공사",
    "실내 등기구 구매",
    "경관조명 제어시스템 구축",
  ])("classifies %s as directly related", (title) => {
    expect(
      classifier.classify({
        title,
        itemName: "",
        description: "",
        attachmentNames: [],
      }),
    ).toEqual(
      expect.objectContaining({
        relevance: TenderRelevance.DIRECT,
      }),
    );
  });

  it("classifies indirect work as potential and records its title evidence", () => {
    expect(
      classifier.classify({
        title: "지하주차장 전기시설 개선공사",
        itemName: "",
        description: "",
        attachmentNames: [],
      }),
    ).toEqual(
      expect.objectContaining({
        relevance: TenderRelevance.POTENTIAL,
        score: 40,
        reasons: expect.arrayContaining([
          expect.objectContaining({
            field: "title",
            keyword: "전기시설",
            score: 40,
          }),
        ]),
      }),
    );
  });

  it("prefers direct relevance when a notice also has potential evidence", () => {
    expect(
      classifier.classify({
        title: "전기시설 및 LED 조명 개선",
        itemName: "",
        description: "",
        attachmentNames: [],
      }),
    ).toEqual(
      expect.objectContaining({
        relevance: TenderRelevance.DIRECT,
        score: 240,
      }),
    );
  });

  it("keeps notices with several indirect matches in the potential category", () => {
    expect(
      classifier.classify({
        title: "전기공사 및 시설개선",
        itemName: "",
        description: "",
        attachmentNames: [],
      }),
    ).toEqual(
      expect.objectContaining({
        relevance: TenderRelevance.POTENTIAL,
        score: 80,
      }),
    );
  });

  it.each(["LED 전광판 설치", "LED 디스플레이 구매"])(
    "excludes %s before direct and potential rules run",
    (title) => {
      expect(
        classifier.classify({
          title,
          itemName: "",
          description: "전기시설 개선",
          attachmentNames: [],
        }),
      ).toBeNull();
    },
  );

  it("normalizes repeated whitespace in searchable text and attachment names", () => {
    expect(
      classifier.classify({
        title: "에너지  절감 사업",
        itemName: "",
        description: "지하  주차장\n개선 공사",
        attachmentNames: ["2026   LED\t등기구.pdf"],
      }),
    ).toEqual(
      expect.objectContaining({
        relevance: TenderRelevance.DIRECT,
        score: 280,
        reasons: expect.arrayContaining([
          { field: "title", keyword: "에너지 절감", score: 40 },
          { field: "description", keyword: "주차장 개선", score: 40 },
          { field: "attachmentNames", keyword: "LED", score: 100 },
          { field: "attachmentNames", keyword: "등기구", score: 100 },
        ]),
      }),
    );
  });

  it("matches case-insensitively across every searchable field without duplicate evidence", () => {
    expect(
      classifier.classify({
        title: "",
        itemName: "led LED",
        description: "",
        attachmentNames: ["LED-등기구.pdf", "LED-등기구.pdf"],
      }),
    ).toEqual({
      relevance: TenderRelevance.DIRECT,
      score: 300,
      reasons: [
        { field: "itemName", keyword: "LED", score: 100 },
        { field: "attachmentNames", keyword: "LED", score: 100 },
        { field: "attachmentNames", keyword: "등기구", score: 100 },
      ],
    });
  });

  it("returns null for unrelated notices", () => {
    expect(
      classifier.classify({
        title: "구내식당 식자재 구매",
        itemName: "",
        description: "",
        attachmentNames: [],
      }),
    ).toBeNull();
  });
});
