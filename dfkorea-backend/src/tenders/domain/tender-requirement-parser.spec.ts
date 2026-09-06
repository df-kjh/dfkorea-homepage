import { ExtractedDocument } from "../documents/tender-document-extraction.types";
import { emptyTenderEnrichment, TenderEnrichment } from "./tender-enrichment";
import {
  normalizeCertificationAlias,
  parseBidFormulaText,
  parseEligibilityRequirements,
  parseUnitSpecifications,
  TenderRequirementParser,
} from "./tender-requirement-parser";

const source = {
  source: "G2B_API" as const,
  operation: "getBidPblancListInfoThngPurchsObjPrdct",
  field: "prdctSpecNm",
};

const document = (
  identity: string,
  revision: string,
  text: string,
): ExtractedDocument & { identity: string; revision: string } => ({
  identity,
  revision,
  status: "EXTRACTED",
  blocks: [{ kind: "text", ordinal: 0, location: "page:1", text }],
  metadata: { pages: 1 },
});

describe("tender requirement rule modules", () => {
  it.each([
    {
      text: "소비전력 49.50 W 이상",
      want: { kind: "POWER", comparator: "GTE", value: "49.5", unit: "W" },
    },
    {
      text: "광효율 120.25 lm/W 이하",
      want: {
        kind: "LUMINOUS_EFFICACY",
        comparator: "LTE",
        value: "120.25",
        unit: "LM_PER_W",
      },
    },
    {
      text: "색온도 4,000 K 초과",
      want: {
        kind: "COLOR_TEMPERATURE",
        comparator: "GT",
        value: "4000",
        unit: "K",
      },
    },
    {
      text: "보호등급 IP65 미만",
      want: { kind: "IP_RATING", comparator: "LT", value: "65", unit: "IP" },
    },
    {
      text: "연색성 CRI 80 이상",
      want: { kind: "CRI", comparator: "GTE", value: "80", unit: "CRI" },
    },
  ])(
    "normalizes decimal units and comparator boundaries: $text",
    ({ text, want }) => {
      expect(parseUnitSpecifications(text, "item:1", "evidence:1")).toEqual([
        expect.objectContaining({ ...want, required: true }),
      ]);
    },
  );

  it("keeps a three-axis dimension requirement together for one product", () => {
    expect(
      parseUnitSpecifications(
        "외형 치수 600 × 300 x 80 mm 이하",
        "item:1",
        "evidence:1",
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "DIMENSIONS",
        comparator: "LTE",
        values: ["600", "300", "80"],
        unit: "MM",
        required: true,
      }),
    ]);
  });

  it("treats a bare specification as reference rather than inventing an obligation", () => {
    expect(
      parseUnitSpecifications("소비전력 50W", "item:1", "evidence:1"),
    ).toEqual([
      expect.objectContaining({
        kind: "POWER",
        comparator: "EQ",
        value: "50",
        required: false,
      }),
    ]);
  });

  it.each([
    ["KS인증", "KS"],
    ["한국산업표준(KS) 인증", "KS"],
    ["고효율 에너지 기자재 인증", "HIGH_EFFICIENCY"],
    ["KC 안전인증", "KC"],
    ["환경표지 인증", "ECO_LABEL"],
    ["V-CHECK 마크", "V_CHECK"],
  ])("normalizes Korean certification alias %s", (alias, code) => {
    expect(normalizeCertificationAlias(alias)?.code).toBe(code);
  });

  it("extracts explicit eligibility obligations without guessing from descriptive prose", () => {
    const parsed = parseEligibilityRequirements(
      [
        "본점 소재지가 경기도 화성시인 업체만 참가할 수 있습니다.",
        "업종코드 1234 전기공사업 면허 등록 필수.",
        "중소기업 또는 소상공인 확인서를 보유해야 합니다.",
        "세부품명번호 39112102 직접생산확인증명서 제출 필수.",
        "나라장터 경쟁입찰참가자격 등록을 하여야 합니다.",
        "최근 3년 이내 동종 물품 납품실적 1억원 이상 필수.",
        "친환경 제품을 선호합니다.",
      ].join("\n"),
      "evidence:1",
    );

    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "REGION",
          required: true,
          values: ["경기도", "화성시"],
        }),
        expect.objectContaining({
          kind: "LICENSE",
          required: true,
          codes: ["1234"],
        }),
        expect.objectContaining({
          kind: "COMPANY_TYPE",
          required: true,
          codes: ["SME", "SMALL_BUSINESS"],
        }),
        expect.objectContaining({
          kind: "DIRECT_PRODUCTION",
          required: true,
          codes: ["39112102"],
        }),
        expect.objectContaining({ kind: "G2B_REGISTRATION", required: true }),
        expect.objectContaining({
          kind: "PERFORMANCE",
          required: true,
          periodYears: 3,
          minimumAmount: "100000000",
        }),
      ]),
    );
    expect(parsed.some((condition) => condition.label.includes("선호"))).toBe(
      false,
    );
  });

  it("does not borrow an obligation word from a different sentence", () => {
    expect(
      parseEligibilityRequirements(
        "나라장터 등록은 필수입니다. 중소기업 제품을 선호합니다.",
        "evidence:1",
      ),
    ).toEqual([
      expect.objectContaining({ kind: "G2B_REGISTRATION", required: true }),
    ]);
  });

  it("parses lower-limit and reserve-price formula phrases as decimal strings", () => {
    expect(
      parseBidFormulaText(
        "낙찰하한율은 87.745%, 예정가격 범위는 기초금액의 -2.5% 이상 +2.5% 이하이다.",
        "evidence:1",
      ),
    ).toEqual(
      expect.objectContaining({
        lowerLimitRate: "87.745",
        reservePriceMinimumRate: "97.5",
        reservePriceMaximumRate: "102.5",
      }),
    );
  });
});

describe("TenderRequirementParser", () => {
  it("parses structured purchase items and document evidence deterministically", () => {
    const enrichment: TenderEnrichment = {
      ...emptyTenderEnrichment(),
      purchaseItems: [
        {
          classificationCode: "39112102",
          name: "LED 보안등기구",
          specification: "소비전력 50W 이하, 색온도 4000K",
          quantity: "2",
          unit: "EA",
          evidence: source,
        },
      ],
    };

    const parsed = new TenderRequirementParser().parse(enrichment, [
      document("doc-1", "00", "KS 인증 필수. 참고: 디자인이 우수한 제품."),
    ]);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].specifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "POWER", required: true }),
        expect.objectContaining({
          kind: "COLOR_TEMPERATURE",
          required: false,
        }),
      ]),
    );
    expect(parsed.certifications).toEqual([
      expect.objectContaining({ code: "KS", required: true }),
    ]);
    expect(parsed.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "STRUCTURED", state: null }),
        expect.objectContaining({
          source: "DOCUMENT",
          documentIdentity: "doc-1",
          location: "page:1",
        }),
        expect.objectContaining({ kind: "UNSUPPORTED", state: "UNKNOWN" }),
      ]),
    );
  });

  it("keeps recommended certification prose unknown instead of making it mandatory", () => {
    const parsed = new TenderRequirementParser().parse(
      emptyTenderEnrichment(),
      [
        document(
          "doc-1",
          "00",
          "KS 인증은 필수입니다. KC 인증 제품은 권장합니다.",
        ),
      ],
    );

    expect(parsed.certifications).toEqual([
      expect.objectContaining({ code: "KS", required: true }),
      expect.objectContaining({ code: "KC", required: false }),
    ]);
    expect(parsed.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "UNSUPPORTED",
          state: "UNKNOWN",
          snippet: "KC 인증 제품은 권장합니다",
        }),
      ]),
    );
  });

  it("lets corrected structured restrictions override an older attachment and retains the conflict", () => {
    const enrichment: TenderEnrichment = {
      ...emptyTenderEnrichment(),
      lowerLimitRate: {
        value: "88.125",
        evidence: {
          source: "G2B_API",
          operation: "getBidPblancListInfoThng",
          field: "sucsfbidLwltRate",
        },
      },
      regions: [
        {
          code: "41",
          name: "경기도",
          required: true,
          evidence: {
            source: "G2B_API",
            operation: "getBidPblancListInfoPrtcptPsblRgn",
            field: "prtcptPsblRgnCd",
          },
        },
      ],
    };

    const parsed = new TenderRequirementParser().parse(enrichment, [
      document(
        "old-notice",
        "00",
        "참가 가능 지역은 서울특별시로 제한합니다. 낙찰하한율은 87.745%입니다.",
      ),
    ]);

    expect(parsed.participationConditions).toEqual([
      expect.objectContaining({
        kind: "REGION",
        sourcePriority: "STRUCTURED",
        codes: ["41"],
        values: ["경기도"],
      }),
    ]);
    expect(parsed.bidFormula.lowerLimitRate).toBe("88.125");
    expect(parsed.evidence.filter((item) => item.kind === "CONFLICT")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conflictField: "REGION" }),
        expect.objectContaining({ conflictField: "LOWER_LIMIT_RATE" }),
      ]),
    );
    expect(
      parsed.evidence.some(
        (item) =>
          item.documentIdentity === "old-notice" &&
          item.snippet.includes("서울"),
      ),
    ).toBe(true);
  });

  it("does not report a conflict when structured and document regions agree", () => {
    const enrichment: TenderEnrichment = {
      ...emptyTenderEnrichment(),
      regions: [
        {
          code: "41",
          name: "경기도",
          required: true,
          evidence: source,
        },
      ],
    };

    const parsed = new TenderRequirementParser().parse(enrichment, [
      document(
        "same-region",
        "00",
        "소재지가 경기도인 업체만 참가할 수 있습니다.",
      ),
    ]);

    expect(parsed.evidence.some((item) => item.kind === "CONFLICT")).toBe(
      false,
    );
  });

  it("is stable when independent document and structured input ordering changes", () => {
    const first: TenderEnrichment = {
      ...emptyTenderEnrichment(),
      licenses: [
        {
          code: "B",
          name: "면허 B",
          group: "1",
          required: true,
          evidence: source,
        },
        {
          code: "A",
          name: "면허 A",
          group: "1",
          required: true,
          evidence: source,
        },
      ],
    };
    const second: TenderEnrichment = {
      ...first,
      licenses: [...first.licenses].reverse(),
    };
    const documents = [
      document("b", "00", "KC 인증 필수"),
      document("a", "00", "KS 인증 필수"),
    ];
    const parser = new TenderRequirementParser();

    expect(parser.parse(first, documents).fingerprint).toBe(
      parser.parse(second, [...documents].reverse()).fingerprint,
    );
  });
});
