import {
  compactAnalysisDetail,
  TENDER_DETAIL_LIMITS,
} from "./tender-analysis-detail";
import {
  compactAnalysisEvidence,
  TENDER_EVIDENCE_LIMITS,
} from "./tender-analysis-evidence";
import { analysisFingerprint } from "./tender-analysis-queue";
import { TenderAnalysis } from "../entities/tender-analysis.entity";

it("caps every normalized field and nested container within each section byte budget", () => {
  const bulk = "\u202e비공개 공급자 본문\u0000".repeat(14000);
  const input = {
    requirements: Array.from({ length: 90 }, (_, i) => ({
      key: `item-${i}`,
      specifications: Array.from({ length: 90 }, () => ({
        id: `r-${i}`,
        itemKey: `item-${i}`,
        kind: "POWER",
        value: "30",
        values: ["30"],
        unit: "W",
        evidenceIds: Array(90).fill("source"),
        required: true,
      })),
    })),
    certificationAnalysis: {
      requirements: [{ id: bulk, name: bulk, code: bulk, itemKeys: [bulk] }],
      evaluations: [{ requirementId: bulk, state: bulk }],
    },
    participationAnalysis: {
      requirements: [
        {
          label: bulk,
          values: [bulk],
          regionPaths: [{ codes: [bulk], values: [bulk] }],
        },
      ],
      providerPayload: bulk,
    },
    priceAnalysis: {
      formula: {
        plannedPriceMethod: bulk,
        reservePriceMethod: bulk,
        lowerLimitRate: "9".repeat(1000),
      },
    },
    evidence: [],
  };
  const result = compactAnalysisDetail(input);
  for (const key of [
    "requirements",
    "certificationAnalysis",
    "participationAnalysis",
    "priceAnalysis",
  ] as const)
    expect(Buffer.byteLength(JSON.stringify(result[key]))).toBeLessThanOrEqual(
      TENDER_DETAIL_LIMITS.sectionJsonBytes,
    );
  expect((result.priceAnalysis.formula as any).lowerLimitRate).toBeNull();
  expect(JSON.stringify(result)).not.toContain("providerPayload");
  expect(JSON.stringify(result)).not.toMatch(/\u202e|\u0000/);
  expect(
    result.evidence.some((value) => value.diagnosticCategory === "TRUNCATION"),
  ).toBe(true);
});

it("keeps the full semantic digest after storage and changes it for an omitted requirement or string tail", () => {
  const input = {
    requirements: Array.from({ length: 90 }, (_, i) => ({
      key: `item-${i}`,
      specifications: [
        {
          id: `r-${i}`,
          itemKey: `item-${i}`,
          kind: "POWER",
          value: "30",
          required: true,
        },
      ],
    })),
    evidence: [],
  };
  const before = compactAnalysisDetail(input);
  input.requirements[89].specifications[0].value = "40";
  const after = compactAnalysisDetail(input);
  expect(after.requirements).toEqual(before.requirements);
  expect(after.reviewSemanticDigest).not.toBe(before.reviewSemanticDigest);
  expect(analysisFingerprint(after as TenderAnalysis)).not.toBe(
    analysisFingerprint(before as TenderAnalysis),
  );
  expect(
    compactAnalysisDetail(JSON.parse(JSON.stringify(after)))
      .reviewSemanticDigest,
  ).toBe(after.reviewSemanticDigest);
});

it("reserves category byte/count quotas even with long diagnostic anchors and 100 source citations", () => {
  const diagnostics = Object.keys(
    TENDER_EVIDENCE_LIMITS.diagnosticQuotas,
  ).flatMap((category) =>
    Array.from({ length: 100 }, (_, i) => ({
      id: `${category}-${i}`,
      kind: category === "CONFLICT" ? "CONFLICT" : "UNSUPPORTED",
      source: "DOCUMENT",
      diagnosticCategory: category,
      snippet: "긴필수조건".repeat(300),
      documentIdentity: "문서".repeat(256),
      location: `p${i}`,
      operation: "연산".repeat(128),
      field: "필드".repeat(128),
    })),
  );
  const input = {
    requirements: Array.from({ length: 100 }, (_, i) => ({
      key: `item-${i}`,
      specifications: [{ evidenceIds: [`source-${i}`] }],
    })),
    evidence: [
      ...diagnostics,
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `source-${i}`,
        kind: "SOURCE",
        source: "DOCUMENT",
        location: `p${i}`,
        snippet: "조건",
      })),
    ],
  };
  const result = compactAnalysisEvidence(input);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
    TENDER_EVIDENCE_LIMITS.jsonBytes,
  );
  expect(result.length).toBeLessThanOrEqual(TENDER_EVIDENCE_LIMITS.totalItems);
  for (const [category, quota] of Object.entries(
    TENDER_EVIDENCE_LIMITS.diagnosticQuotas,
  )) {
    const selected = result.filter(
      (value) => value.diagnosticCategory === category,
    );
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(quota);
    expect(
      selected.reduce(
        (sum, item) => sum + Buffer.byteLength(JSON.stringify(item)),
        0,
      ),
    ).toBeLessThanOrEqual(TENDER_EVIDENCE_LIMITS.diagnosticCategoryBytes);
  }
  expect(
    compactAnalysisEvidence({
      ...input,
      evidence: [...input.evidence].reverse(),
      requirements: [...input.requirements].reverse(),
    }),
  ).toEqual(result);
});
