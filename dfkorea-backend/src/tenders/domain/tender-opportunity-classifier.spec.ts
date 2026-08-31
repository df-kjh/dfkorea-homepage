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
        licenseLimitsVerified: true,
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
        licenseLimitsVerified: true,
      }),
    ).toEqual(
      expect.objectContaining({ type: TenderOpportunityType.GOODS_SUPPLY }),
    );
  });

  it("excludes goods when license-limit verification is incomplete", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "LED 조명기구 구매",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
        licenseLimitsVerified: false,
      }),
    ).toEqual({
      type: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
      reasons: ["면허제한 정보 확인 불가"],
    });
  });

  it("keeps verified goods eligible when no electrical license restriction exists", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "LED 조명기구 구매",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [],
        licenseLimitsVerified: true,
      }),
    ).toEqual({
      type: TenderOpportunityType.GOODS_SUPPLY,
      reasons: ["물품 업무구분"],
    });
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
        licenseLimitsVerified: true,
      }),
    ).toEqual(
      expect.objectContaining({
        type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
      }),
    );
  });

  it("excludes goods when permitted industries contain 전기공사업 even if the license name does not", () => {
    expect(
      classifier.classify({
        procurementType: ProcurementType.GOODS,
        title: "LED 조명기구 구매",
        description: "",
        attachmentNames: [],
        contractMethod: null,
        licenseLimits: [
          { name: "참가자격 제한", permittedIndustries: "전기공사업(0037)" },
        ],
        licenseLimitsVerified: true,
      }),
    ).toEqual({
      type: TenderOpportunityType.EXCLUDED_CONSTRUCTION,
      reasons: ["전기공사업 면허제한"],
    });
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
        licenseLimitsVerified: true,
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
        licenseLimitsVerified: true,
      }),
    ).toEqual(
      expect.objectContaining({
        type: TenderOpportunityType.EXCLUDED_NON_SUPPLY,
      }),
    );
  });
});
