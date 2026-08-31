import { ProcurementType, TenderOpportunityType } from "./tender.enums";
import { TenderOpportunityClassifier } from "./tender-opportunity-classifier";

describe("TenderOpportunityClassifier", () => {
  const classifier = new TenderOpportunityClassifier();

  it("excludes construction notices regardless of their title", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.CONSTRUCTION,
        title: "LED 가로등 교체공사",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
      }),
    ).toEqual(
      expect.objectContaining({
        type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
      }),
    );
  });

  it("keeps goods containing 공사 관급자재 구입 as a supply opportunity", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "청사 공사 관급자재 구입 LED 조명기구",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
      }),
    ).toEqual(
      expect.objectContaining({ type: TenderOpportunityType.GOODS_SUPPLY }),
    );
  });

  it("excludes goods that restrict participation to electrical construction licenses", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "LED 조명기구 구매",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [{ name: "전기공사업", permittedIndustries: "0037" }],
      }),
    ).toEqual(
      expect.objectContaining({
        type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
      }),
    );
  });

  it("classifies goods with a 다수공급자계약 title as MAS", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "다수공급자계약 LED 조명기구",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
      }),
    ).toEqual(expect.objectContaining({ type: TenderOpportunityType.MAS }));
  });

  it("excludes service notices as non-supply opportunities", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.SERVICE,
        title: "LED 조명 유지관리 용역",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
      }),
    ).toEqual(
      expect.objectContaining({
        type: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
      }),
    );
  });
});
