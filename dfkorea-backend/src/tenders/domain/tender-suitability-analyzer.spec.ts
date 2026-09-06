import { TenderCompanyProfileDto } from "../dto/tender-company-profile.dto";
import { ExtractedDocument } from "../documents/tender-document-extraction.types";
import {
  TenderRequirementState,
  TenderSuitability,
} from "./tender-analysis.enums";
import { emptyTenderEnrichment, TenderEnrichment } from "./tender-enrichment";
import {
  ParsedTenderRequirements,
  TenderProductSnapshot,
} from "./tender-requirement";
import { TenderRequirementParser } from "./tender-requirement-parser";
import { TenderSuitabilityAnalyzer } from "./tender-suitability-analyzer";

const now = new Date("2026-09-07T12:00:00.000Z");

const profile = (
  overrides: Partial<TenderCompanyProfileDto> = {},
): TenderCompanyProfileDto => ({
  companyName: "디에프코리아",
  businessNumber: "1234567890",
  headquarters: { sido: "경기도", sigungu: "화성시" },
  g2bRegistered: true,
  supplyProducts: [],
  licenses: [],
  companyTypes: [],
  directProduction: [],
  certifications: [],
  performanceRecords: [],
  version: 1,
  ...overrides,
});

const requirements = (
  overrides: Partial<ParsedTenderRequirements> = {},
): ParsedTenderRequirements => ({
  items: [],
  certifications: [],
  participationConditions: [],
  bidFormula: {},
  evidence: [],
  fingerprint: "requirements-fixture",
  ...overrides,
});

const product = (
  id: string,
  overrides: Partial<TenderProductSnapshot> = {},
): TenderProductSnapshot => ({
  id,
  dimensions: "600 x 300 x 80 mm",
  power: [],
  colorTemp: [],
  certifications: [],
  ...overrides,
});

const source = {
  source: "G2B_API" as const,
  operation: "getBidPblancListInfoThngPurchsObjPrdct",
  field: "prdctSpecNm",
};

const extractedDocument = (
  identity: string,
  text: string,
): ExtractedDocument & { identity: string; revision: string } => ({
  identity,
  revision: "00",
  status: "EXTRACTED",
  blocks: [{ kind: "text", ordinal: 0, location: "page:1", text }],
  metadata: { pages: 1 },
});

const parseAndAnalyze = (
  enrichment: TenderEnrichment,
  documentTexts: string[],
  company = profile(),
  catalog: TenderProductSnapshot[] = [],
) => {
  const parsed = new TenderRequirementParser().parse(
    enrichment,
    documentTexts.map((text, index) => extractedDocument(`doc-${index}`, text)),
  );
  return {
    parsed,
    result: new TenderSuitabilityAnalyzer().analyze(
      parsed,
      company,
      catalog,
      now,
    ),
  };
};

const spec = (id: string, required: boolean, value: string) => ({
  id,
  itemKey: "item:1",
  kind: "POWER" as const,
  comparator: "GTE" as const,
  value,
  unit: "W" as const,
  required,
  evidenceIds: [`evidence:${id}`],
});

describe("TenderSuitabilityAnalyzer specification scoring", () => {
  it("weights required specifications by two and references by one", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications: [
              spec("required", true, "50"),
              spec("reference", false, "100"),
            ],
            evidenceIds: [],
          },
        ],
      }),
      profile(),
      [product("catalog-1", { power: [50] })],
      now,
    );

    expect(result.specificationScore).toBe(67);
    expect(result.satisfiedCount).toBe(1);
    expect(result.unsatisfiedCount).toBe(1);
    expect(result.unknownCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it("honors inclusive and exclusive decimal boundaries without binary rounding drift", () => {
    const boundaryRequirements = requirements({
      items: [
        {
          key: "item:1",
          classificationCode: "39112102",
          specifications: [
            { ...spec("gte", true, "49.5"), comparator: "GTE" as const },
            { ...spec("gt", true, "49.5"), comparator: "GT" as const },
            { ...spec("lte", true, "49.5"), comparator: "LTE" as const },
            { ...spec("lt", true, "49.5"), comparator: "LT" as const },
          ],
          evidenceIds: [],
        },
      ],
    });

    const result = new TenderSuitabilityAnalyzer().analyze(
      boundaryRequirements,
      profile(),
      [product("catalog-1", { power: [49.5] })],
      now,
    );

    expect(result.satisfiedCount).toBe(2);
    expect(result.unsatisfiedCount).toBe(2);
    expect(result.specificationScore).toBe(50);
  });

  it("does not combine wattage from one product with certification from another", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications: [spec("power", true, "50")],
            evidenceIds: [],
          },
        ],
        certifications: [
          {
            id: "cert:ks",
            code: "KS",
            name: "KS 인증",
            required: true,
            itemKeys: ["item:1"],
            evidenceIds: ["evidence:ks"],
          },
        ],
      }),
      profile(),
      [
        product("product-a", { power: [50] }),
        product("product-b", { power: [20], certifications: ["KS"] }),
      ],
      now,
    );

    expect(result.satisfiedCount).toBe(1);
    expect(result.certifications).toEqual([
      expect.objectContaining({ state: TenderRequirementState.UNSATISFIED }),
    ]);
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
    expect(JSON.stringify(result)).not.toMatch(/product-a|product-b/i);
  });

  it("selects a certified product when certification is the only item requirement", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications: [],
            evidenceIds: [],
          },
        ],
        certifications: [
          {
            id: "cert:ks",
            code: "KS",
            name: "KS 인증",
            required: true,
            itemKeys: ["item:1"],
            evidenceIds: [],
          },
        ],
      }),
      profile(),
      [
        product("a-uncertified", { certifications: ["AA"] }),
        product("z-certified", { certifications: ["KS인증"] }),
      ],
      now,
    );

    expect(result.certifications[0].state).toBe(
      TenderRequirementState.SATISFIED,
    );
  });

  it("uses the injected date for a product certification recorded in the profile", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications: [],
            evidenceIds: [],
          },
        ],
        certifications: [
          {
            id: "cert:ks",
            code: "KS",
            name: "KS 인증",
            required: true,
            itemKeys: ["item:1"],
            evidenceIds: [],
          },
        ],
      }),
      profile({
        certifications: [
          { code: "KS", name: "KS 인증", expiresAt: "2026-09-06" },
        ],
      }),
      [product("catalog-1", { certifications: ["KS"] })],
      now,
    );

    expect(result.certifications[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("returns a nullable score and exact unknown coverage when products lack comparable fields", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications: [spec("power", true, "50")],
            evidenceIds: [],
          },
        ],
      }),
      profile(),
      [product("catalog-1")],
      now,
    );

    expect(result).toEqual(
      expect.objectContaining({
        suitability: TenderSuitability.REVIEW,
        specificationScore: null,
        satisfiedCount: 0,
        unsatisfiedCount: 0,
        unknownCount: 1,
        totalCount: 1,
      }),
    );
  });
});

describe("TenderSuitabilityAnalyzer qualification rules", () => {
  it("uses the injected date and treats expiry on that date as valid", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        participationConditions: [
          {
            id: "license:1",
            kind: "LICENSE",
            label: "전기공사업",
            codes: ["0037"],
            values: ["전기공사업"],
            required: true,
            sourcePriority: "STRUCTURED",
            evidenceIds: ["evidence:license"],
          },
        ],
      }),
      profile({
        licenses: [
          { code: "0037", name: "전기공사업", expiresAt: "2026-09-07" },
        ],
      }),
      [],
      now,
    );

    expect(result.participationConditions).toEqual([
      expect.objectContaining({ state: TenderRequirementState.SATISFIED }),
    ]);
  });

  it("rejects an expired qualification and reports a hard failure", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        participationConditions: [
          {
            id: "direct:1",
            kind: "DIRECT_PRODUCTION",
            label: "직접생산확인",
            codes: ["39112102"],
            values: [],
            required: true,
            sourcePriority: "DOCUMENT",
            evidenceIds: ["evidence:direct"],
          },
        ],
      }),
      profile({
        directProduction: [
          { code: "39112102", name: "LED등기구", expiresAt: "2026-09-06" },
        ],
      }),
      [],
      now,
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("evaluates region, company type, G2B registration, and performance phrases", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        participationConditions: [
          {
            id: "region:1",
            kind: "REGION",
            label: "경기도 또는 서울특별시",
            codes: ["41", "11"],
            values: ["경기도", "서울특별시"],
            required: true,
            sourcePriority: "STRUCTURED",
            evidenceIds: [],
          },
          {
            id: "type:1",
            kind: "COMPANY_TYPE",
            label: "중소기업 또는 소상공인",
            codes: ["SME", "SMALL_BUSINESS"],
            values: [],
            required: true,
            sourcePriority: "DOCUMENT",
            evidenceIds: [],
          },
          {
            id: "g2b:1",
            kind: "G2B_REGISTRATION",
            label: "나라장터 등록",
            codes: [],
            values: [],
            required: true,
            sourcePriority: "DOCUMENT",
            evidenceIds: [],
          },
          {
            id: "performance:1",
            kind: "PERFORMANCE",
            label: "LED등기구 실적",
            codes: [],
            values: ["LED등기구"],
            periodYears: 3,
            minimumAmount: "100000000",
            required: true,
            sourcePriority: "DOCUMENT",
            evidenceIds: [],
          },
        ],
      }),
      profile({
        companyTypes: [
          { code: "SME", name: "중소기업", expiresAt: "2027-01-01" },
        ],
        performanceRecords: [
          {
            itemName: "동종 물품 LED등기구",
            from: "2025-01-01",
            to: "2026-08-01",
            amount: "100000000.00",
          },
        ],
      }),
      [],
      now,
    );

    expect(result.participationConditions.map((item) => item.state)).toEqual([
      TenderRequirementState.SATISFIED,
      TenderRequirementState.SATISFIED,
      TenderRequirementState.SATISFIED,
      TenderRequirementState.SATISFIED,
    ]);
  });

  it("retains decimal scale while totaling performance amounts", () => {
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        participationConditions: [
          {
            id: "performance:decimal",
            kind: "PERFORMANCE",
            label: "LED 조명 실적",
            codes: [],
            values: ["LED 조명"],
            periodYears: 3,
            minimumAmount: "2",
            required: true,
            sourcePriority: "DOCUMENT",
            evidenceIds: [],
          },
        ],
      }),
      profile({
        performanceRecords: [
          {
            itemName: "LED 조명 A",
            from: "2025-01-01",
            to: "2026-01-01",
            amount: "0.6",
          },
          {
            itemName: "LED 조명 B",
            from: "2025-01-01",
            to: "2026-01-01",
            amount: "0.6",
          },
        ],
      }),
      [],
      now,
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
  });
});

describe("TenderSuitabilityAnalyzer status and fingerprints", () => {
  it.each([
    { score: 80, unknown: 0, hardFailure: false, want: "RECOMMENDED" },
    { score: 80, unknown: 1, hardFailure: false, want: "REVIEW" },
    { score: 50, unknown: 0, hardFailure: false, want: "REVIEW" },
    { score: 49, unknown: 0, hardFailure: false, want: "DIFFICULT" },
    { score: 100, unknown: 0, hardFailure: true, want: "DIFFICULT" },
  ])(
    "applies the documented status precedence: $want",
    ({ score, unknown, hardFailure, want }) => {
      const comparable = 100;
      const passing = score;
      const failing = comparable - passing;
      const specifications = [
        ...Array.from({ length: passing }, (_, index) =>
          spec(`pass-${index}`, false, "1"),
        ),
        ...Array.from({ length: failing }, (_, index) =>
          spec(`fail-${index}`, false, "2"),
        ),
        ...Array.from({ length: unknown }, (_, index) => ({
          ...spec(`unknown-${index}`, false, "1"),
          kind: "LUMINOUS_EFFICACY" as const,
          unit: "LM_PER_W" as const,
        })),
      ];
      const participationConditions = hardFailure
        ? [
            {
              id: "hard-failure",
              kind: "G2B_REGISTRATION" as const,
              label: "나라장터 등록",
              codes: [],
              values: [],
              required: true,
              sourcePriority: "DOCUMENT" as const,
              evidenceIds: [],
            },
          ]
        : [];
      const result = new TenderSuitabilityAnalyzer().analyze(
        requirements({
          items: [
            {
              key: "item:1",
              classificationCode: "39112102",
              specifications,
              evidenceIds: [],
            },
          ],
          participationConditions,
        }),
        profile({ g2bRegistered: !hardFailure }),
        [product("catalog-1", { power: [1] })],
        now,
      );

      expect(result.suitability).toBe(want);
    },
  );

  it("uses the unrounded weighted ratio at the 80 percent boundary", () => {
    const specifications = [
      ...Array.from({ length: 35 }, (_, index) =>
        spec(`pass-${index}`, false, "1"),
      ),
      ...Array.from({ length: 9 }, (_, index) =>
        spec(`fail-${index}`, false, "2"),
      ),
    ];
    const result = new TenderSuitabilityAnalyzer().analyze(
      requirements({
        items: [
          {
            key: "item:1",
            classificationCode: "39112102",
            specifications,
            evidenceIds: [],
          },
        ],
      }),
      profile(),
      [product("catalog-1", { power: [1] })],
      now,
    );

    expect(result.specificationScore).toBe(80);
    expect(result.suitability).toBe(TenderSuitability.REVIEW);
  });

  it("keeps requirement, profile, and product fingerprints stable under input ordering", () => {
    const analyzer = new TenderSuitabilityAnalyzer();
    const input = requirements({
      items: [
        {
          key: "item:1",
          classificationCode: "39112102",
          specifications: [spec("a", true, "50")],
          evidenceIds: [],
        },
      ],
    });
    const first = analyzer.analyze(
      input,
      profile({
        licenses: [
          { code: "B", name: "B", expiresAt: null },
          { code: "A", name: "A", expiresAt: null },
        ],
      }),
      [product("b", { power: [50] }), product("a", { power: [50] })],
      now,
    );
    const second = analyzer.analyze(
      input,
      profile({
        licenses: [
          { code: "A", name: "A", expiresAt: null },
          { code: "B", name: "B", expiresAt: null },
        ],
      }),
      [product("a", { power: [50] }), product("b", { power: [50] })],
      now,
    );

    expect(first.inputFingerprints).toEqual(second.inputFingerprints);
    expect(Object.values(first.inputFingerprints)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]),
    );
  });
});

describe("Tender requirement parsing and scoring regressions", () => {
  it.each([
    {
      sourceKind: "structured",
      enrichment: {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 이하 및 특수 방폭 인증 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      documents: [],
      evidenceSource: "STRUCTURED",
    },
    {
      sourceKind: "document",
      enrichment: emptyTenderEnrichment(),
      documents: ["소비전력 50W 이하 및 특수 방폭 인증 필수"],
      evidenceSource: "DOCUMENT",
    },
  ])(
    "keeps the unconsumed mandatory span UNKNOWN for $sourceKind prose",
    ({ enrichment, documents, evidenceSource }) => {
      const { parsed, result } = parseAndAnalyze(
        enrichment,
        documents,
        profile(),
        [product("catalog-1", { power: [50] })],
      );

      expect(parsed.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "UNSUPPORTED",
            source: evidenceSource,
            state: "UNKNOWN",
            snippet: expect.stringContaining("특수 방폭 인증 필수"),
          }),
        ]),
      );
      expect(result.specificationScore).toBe(100);
      expect(result.suitability).toBe(TenderSuitability.REVIEW);
    },
  );

  it("preserves a province and district as one conjunctive region path", () => {
    const { parsed, result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      ["본점 소재지가 경기도 화성시인 업체만 참가할 수 있습니다."],
      profile({ headquarters: { sido: "경기도", sigungu: "수원시" } }),
    );

    expect(parsed.participationConditions).toEqual([
      expect.objectContaining({
        kind: "REGION",
        regionPaths: [
          expect.objectContaining({ values: ["경기도", "화성시"] }),
        ],
      }),
    ]);
    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("keeps explicit alternative region paths disjunctive", () => {
    const { result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      [
        "본점 소재지가 경기도 화성시 또는 서울특별시인 업체만 참가할 수 있습니다.",
      ],
      profile({
        headquarters: { sido: "서울특별시", sigungu: "종로구" },
      }),
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.SATISFIED,
    );
  });

  it("does not let a matching license name override an explicit code mismatch", () => {
    const { result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      ["업종코드 1234 전기공사업 면허 등록 필수."],
      profile({
        licenses: [{ code: "9999", name: "전기공사업", expiresAt: null }],
      }),
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("keeps generic same-kind performance equivalence UNKNOWN", () => {
    const { result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      ["최근 3년 이내 동종 물품 납품실적 1억원 이상 필수."],
      profile({
        performanceRecords: [
          {
            itemName: "사무용 가구",
            from: "2025-01-01",
            to: "2026-01-01",
            amount: "999999999",
          },
        ],
      }),
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNKNOWN,
    );
    expect(result.suitability).toBe(TenderSuitability.REVIEW);
  });

  it("ignores performance records outside the injected cutoff and current date", () => {
    const { result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      ["최근 3년 이내 LED 조명 납품실적 1억원 이상 필수."],
      profile({
        performanceRecords: [
          {
            itemName: "LED 조명",
            from: "2023-01-01",
            to: "2023-09-06",
            amount: "1000000000",
          },
          {
            itemName: "LED 조명",
            from: "2026-09-08",
            to: "2026-12-31",
            amount: "1000000000",
          },
          {
            itemName: "LED 조명",
            from: "2025-01-01",
            to: "2026-09-01",
            amount: "99999999",
          },
        ],
      }),
    );

    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.UNSATISFIED,
    );
  });

  it.each([
    { phrase: "1.5억원", amount: "150000000" },
    { phrase: "1.25만원", amount: "12500" },
  ])(
    "preserves decimal Korean amount $phrase end to end",
    ({ phrase, amount }) => {
      const { parsed } = parseAndAnalyze(emptyTenderEnrichment(), [
        `최근 3년 이내 LED 조명 납품실적 ${phrase} 이상 필수.`,
      ]);

      expect(parsed.participationConditions).toEqual([
        expect.objectContaining({
          kind: "PERFORMANCE",
          minimumAmount: amount,
        }),
      ]);
    },
  );

  it("applies an exact-value obligation after the unit", () => {
    const { parsed } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      [],
    );

    expect(parsed.items[0].specifications[0]).toEqual(
      expect.objectContaining({
        comparator: "EQ",
        value: "50",
        required: true,
      }),
    );
  });

  it("does not turn a negated certification obligation into a requirement", () => {
    const { parsed } = parseAndAnalyze(emptyTenderEnrichment(), [
      "KS 인증은 필수가 아닙니다.",
    ]);

    expect(parsed.certifications).toEqual([
      expect.objectContaining({ code: "KS", required: false }),
    ]);
  });

  it("lets a structured specification supersede the same document field with conflict evidence", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["소비전력 40W 필수"],
      profile(),
      [product("catalog-1", { power: [50] })],
    );

    expect(parsed.items[0].specifications).toEqual([
      expect.objectContaining({ kind: "POWER", value: "50" }),
    ]);
    expect(parsed.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "CONFLICT",
          conflictField: "SPECIFICATION:POWER",
          relatedEvidenceIds: expect.arrayContaining([
            parsed.items[0].evidenceIds[0],
            expect.any(String),
          ]),
        }),
      ]),
    );
    expect(result.specificationScore).toBe(100);
    expect(result.suitability).toBe(TenderSuitability.REVIEW);
  });

  it("detects structured reserve-bound conflicts beyond the lower-limit rate", () => {
    const formulaEvidence = {
      source: "G2B_API" as const,
      operation: "getBidPblancListInfoThngBsisAmount",
      field: "rsrvtnPrceRngBgnRate",
    };
    const { parsed } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        formulaVariables: [
          {
            key: "reservePriceMinimumRate",
            value: "99",
            evidence: formulaEvidence,
          },
          {
            key: "reservePriceMaximumRate",
            value: "101",
            evidence: { ...formulaEvidence, field: "rsrvtnPrceRngEndRate" },
          },
        ],
      },
      ["예정가격 범위는 기초금액의 -2% 이상 +2% 이하입니다."],
    );

    expect(parsed.bidFormula).toEqual(
      expect.objectContaining({
        reservePriceMinimumRate: "99",
        reservePriceMaximumRate: "101",
      }),
    );
    expect(
      parsed.evidence
        .filter((item) => item.kind === "CONFLICT")
        .map((item) => item.conflictField),
    ).toEqual(
      expect.arrayContaining([
        "RESERVE_PRICE_MINIMUM_RATE",
        "RESERVE_PRICE_MAXIMUM_RATE",
      ]),
    );
  });

  it("does not report a conflict for equivalent structured and document licenses", () => {
    const { parsed } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        licenses: [
          {
            code: "1234",
            name: "전기공사업",
            group: "1",
            required: true,
            evidence: source,
          },
        ],
      },
      ["업종코드 1234 전기공사업 면허 등록 필수."],
    );

    expect(
      parsed.evidence.some(
        (item) => item.kind === "CONFLICT" && item.conflictField === "LICENSE",
      ),
    ).toBe(false);
  });

  it("canonicalizes equivalent structured and document license alternatives", () => {
    const { parsed } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        licenses: [
          {
            code: "1234",
            name: "면허 A",
            group: "1",
            required: true,
            evidence: source,
          },
          {
            code: "5678",
            name: "면허 B",
            group: "1",
            required: true,
            evidence: source,
          },
        ],
      },
      ["업종코드 1234 또는 업종코드 5678 등록 필수."],
    );

    expect(
      parsed.evidence.some(
        (item) => item.kind === "CONFLICT" && item.conflictField === "LICENSE",
      ),
    ).toBe(false);
  });

  it("keeps unassigned multi-item document requirements UNKNOWN", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "item-40",
            name: "40W 등기구",
            specification: "소비전력 40W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
          {
            classificationCode: "item-60",
            name: "60W 등기구",
            specification: "소비전력 60W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["광효율 80lm/W 이상 필수"],
      profile(),
      [
        product("40w", { power: [40] }),
        product("60w", { power: [60] }),
        product("unrelated", {
          power: [20],
          luminanceEfficiency: 80,
        }),
      ],
    );

    expect(parsed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "document:general",
          assignment: "UNASSIGNED",
        }),
      ]),
    );
    expect(result).toEqual(
      expect.objectContaining({
        specificationScore: 100,
        satisfiedCount: 2,
        unsatisfiedCount: 0,
        unknownCount: 1,
        totalCount: 3,
        suitability: TenderSuitability.REVIEW,
      }),
    );
  });

  it.each([
    "소비전력 50W 이하이며 내진 구조 필수",
    "소비전력 50W 이하 및 KS 인증과 방폭 인증 필수",
  ])(
    "keeps an unsupported mandatory residual UNKNOWN after recognized content: %s",
    (text) => {
      const { parsed, result } = parseAndAnalyze(
        emptyTenderEnrichment(),
        [text],
        profile(),
        [product("catalog-1", { power: [50], certifications: ["KS"] })],
      );

      expect(parsed.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "UNSUPPORTED",
            state: "UNKNOWN",
            snippet: expect.stringMatching(/내진|방폭/),
          }),
        ]),
      );
      expect(result.specificationScore).toBe(100);
      expect(result.suitability).toBe(TenderSuitability.REVIEW);
    },
  );

  it("binds certification obligation and negation to each certification phrase", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["KS 인증은 필수가 아니며 KC 인증 필수"],
      profile(),
      [product("catalog-1", { power: [50], certifications: ["KS"] })],
    );

    expect(parsed.certifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "KS", required: false }),
        expect.objectContaining({ code: "KC", required: true }),
      ]),
    );
    expect(
      result.certifications.find(
        ({ requirementId }) =>
          requirementId ===
          parsed.certifications.find(({ code }) => code === "KC")?.id,
      )?.state,
    ).toBe(TenderRequirementState.UNSATISFIED);
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("keeps conjunctive license codes as separate required conditions", () => {
    const { parsed, result } = parseAndAnalyze(
      emptyTenderEnrichment(),
      ["업종코드 1234 및 업종코드 5678 등록 필수"],
      profile({
        licenses: [{ code: "1234", name: "면허 A", expiresAt: null }],
      }),
    );

    expect(
      parsed.participationConditions
        .filter(({ kind }) => kind === "LICENSE")
        .map(({ codes }) => codes)
        .sort(([left], [right]) => left.localeCompare(right)),
    ).toEqual([["1234"], ["5678"]]);
    expect(result.participationConditions.map(({ state }) => state)).toEqual(
      expect.arrayContaining([
        TenderRequirementState.SATISFIED,
        TenderRequirementState.UNSATISFIED,
      ]),
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it("matches an old structured province name through its canonical region code", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        regions: [
          {
            code: "51",
            name: "강원도",
            required: true,
            evidence: source,
          },
        ],
      },
      [],
      profile({
        headquarters: { sido: "강원특별자치도", sigungu: "원주시" },
      }),
    );

    expect(parsed.participationConditions).toEqual([
      expect.objectContaining({
        kind: "REGION",
        regionPaths: [{ codes: ["51"], values: ["강원도"] }],
      }),
    ]);
    expect(result.participationConditions[0].state).toBe(
      TenderRequirementState.SATISFIED,
    );
  });

  it("deduplicates repeated equivalent document specs before conflict comparison", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["소비전력 50W 필수", "소비전력 50.0W 필수"],
      profile(),
      [product("catalog-1", { power: [50] })],
    );

    expect(
      parsed.evidence.some(
        ({ kind, conflictField }) =>
          kind === "CONFLICT" && conflictField === "SPECIFICATION:POWER",
      ),
    ).toBe(false);
    expect(parsed.items[0].specifications).toEqual([
      expect.objectContaining({
        value: "50",
        evidenceIds: expect.arrayContaining([
          parsed.items[0].evidenceIds[0],
          expect.any(String),
        ]),
      }),
    ]);
    expect(result.suitability).toBe(TenderSuitability.RECOMMENDED);
  });

  it("compares numerically equivalent structured and document reserve bounds", () => {
    const formulaEvidence = {
      source: "G2B_API" as const,
      operation: "getBidPblancListInfoThngBsisAmount",
      field: "rsrvtnPrceRngBgnRate",
    };
    const { parsed } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        formulaVariables: [
          {
            key: "reservePriceMinimumRate",
            value: "98.0",
            evidence: formulaEvidence,
          },
          {
            key: "reservePriceMaximumRate",
            value: "102.0",
            evidence: { ...formulaEvidence, field: "rsrvtnPrceRngEndRate" },
          },
        ],
      },
      ["예정가격 범위는 기초금액의 -2% 이상 +2% 이하입니다."],
    );

    expect(
      parsed.evidence.filter(
        ({ kind, conflictField }) =>
          kind === "CONFLICT" && conflictField?.startsWith("RESERVE_PRICE_"),
      ),
    ).toEqual([]);
  });

  it("shares a trailing certification obligation across an explicit conjunction", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["KS 인증 및 KC 인증 필수"],
      profile(),
      [product("catalog-1", { power: [50], certifications: ["KC"] })],
    );

    expect(parsed.certifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "KS", required: true }),
        expect.objectContaining({ code: "KC", required: true }),
      ]),
    );
    expect(result.certifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: parsed.certifications.find(({ code }) => code === "KS")
            ?.id,
          state: TenderRequirementState.UNSATISFIED,
        }),
      ]),
    );
    expect(result.suitability).toBe(TenderSuitability.DIFFICULT);
  });

  it.each([
    "업종코드 1234 등록 필수이며 내진 구조 필수",
    "나라장터 등록 필수이며 내진 구조 필수",
  ])(
    "keeps an unsupported mandatory residual after a participation rule: %s",
    (text) => {
      const { parsed, result } = parseAndAnalyze(
        {
          ...emptyTenderEnrichment(),
          purchaseItems: [
            {
              classificationCode: "39112102",
              name: "LED 등기구",
              specification: "소비전력 50W 필수",
              quantity: "1",
              unit: "EA",
              evidence: source,
            },
          ],
        },
        [text],
        profile({
          licenses: [{ code: "1234", name: "면허 A", expiresAt: null }],
        }),
        [product("catalog-1", { power: [50] })],
      );

      expect(parsed.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "UNSUPPORTED",
            state: "UNKNOWN",
            snippet: expect.stringContaining("내진 구조 필수"),
          }),
        ]),
      );
      expect(result.specificationScore).toBe(100);
      expect(result.suitability).toBe(TenderSuitability.REVIEW);
    },
  );

  it("consumes supported certification obligation grammar without spurious UNKNOWN evidence", () => {
    const { parsed, result } = parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      ["KS 인증 보유 필수"],
      profile(),
      [
        product("catalog-1", {
          power: [50],
          certifications: ["KS"],
        }),
      ],
    );

    expect(parsed.certifications).toEqual([
      expect.objectContaining({ code: "KS", required: true }),
    ]);
    expect(parsed.evidence.some(({ state }) => state === "UNKNOWN")).toBe(
      false,
    );
    expect(result.suitability).toBe(TenderSuitability.RECOMMENDED);
  });
});

describe("participation semantic range residuals", () => {
  const analyzeParticipation = (text: string) =>
    parseAndAnalyze(
      {
        ...emptyTenderEnrichment(),
        purchaseItems: [
          {
            classificationCode: "39112102",
            name: "LED 등기구",
            specification: "소비전력 50W 필수",
            quantity: "1",
            unit: "EA",
            evidence: source,
          },
        ],
      },
      [text],
      profile({
        licenses: [
          { code: "1234", name: "전기공사업", expiresAt: null },
          { code: "5678", name: "면허 B", expiresAt: null },
        ],
        companyTypes: [{ code: "SME", name: "중소기업", expiresAt: null }],
        directProduction: [
          { code: "39112102", name: "LED 등기구", expiresAt: null },
        ],
        performanceRecords: [
          {
            itemName: "LED 조명",
            from: "2025-01-01",
            to: "2026-08-01",
            amount: "100000000",
          },
        ],
      }),
      [product("catalog-1", { power: [50] })],
    );

  it.each([
    "나라장터 등록과 내진 구조 필수",
    "업종코드 1234 등록과 내진 구조 필수",
    "나라장터 등록 / 내진 구조 필수",
    "업종코드 1234 등록 + 내진 구조 필수",
    "내진 구조 필수 (나라장터 등록 필수)",
    "본점 소재지가 경기도 화성시인 업체만 참가할 수 있습니다 / 내진 구조 필수",
    "중소기업 확인서 보유와 내진 구조 필수",
    "세부품명번호 39112102 직접생산확인증명서 제출과 내진 구조 필수",
    "최근 3년 이내 LED 조명 납품실적 1억원 이상과 내진 구조 필수",
    "내진 구조 필수 / 세부품명번호 39112102 직접생산확인증명서 제출 필수",
  ])(
    "retains substantive text outside recognized eligibility ranges: %s",
    (text) => {
      const { parsed, result } = analyzeParticipation(text);
      expect(parsed.participationConditions.length).toBeGreaterThan(0);
      expect(
        result.participationConditions.every(
          ({ state }) => state === TenderRequirementState.SATISFIED,
        ),
      ).toBe(true);
      expect(parsed.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "UNSUPPORTED",
            state: "UNKNOWN",
            snippet: expect.stringContaining("내진 구조 필수"),
          }),
        ]),
      );
      expect(result.specificationScore).toBe(100);
      expect(result.suitability).toBe(TenderSuitability.REVIEW);
    },
  );

  it.each([
    "나라장터 등록 필수",
    "나라장터 경쟁입찰참가자격 등록을 하여야 합니다",
    "업종코드 1234 전기공사업 면허 등록 필수",
    "업종코드 1234 및 업종코드 5678 등록 필수",
    "업종코드 1234 또는 업종코드 9999 등록 필수",
    "본점 소재지가 경기도 화성시 또는 서울특별시인 업체만 참가할 수 있습니다",
    "중소기업 또는 소상공인 확인서를 보유해야 합니다",
    "세부품명번호 39112102 직접생산확인증명서 제출 필수",
    "최근 3년 이내 LED 조명 납품실적 1억원 이상 필수",
    "나라장터 등록과 업종코드 1234 등록 필수",
    "나라장터 등록 / 업종코드 1234 등록 필수",
  ])(
    "consumes supported eligibility and its obligation grammar only: %s",
    (text) => {
      const { parsed, result } = analyzeParticipation(text);
      expect(parsed.participationConditions.length).toBeGreaterThan(0);
      expect(
        parsed.evidence.filter(({ state }) => state === "UNKNOWN"),
      ).toEqual([]);
      expect(result.unknownCount).toBe(0);
      expect(result.suitability).toBe(TenderSuitability.RECOMMENDED);
    },
  );
});
