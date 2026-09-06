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

it.each(["resolved", "stale", "absent", "same-anchor"])(
  "selects identical capped same-field conflicts with %s related evidence in either input order",
  (mode) => {
    const sources = Array.from({ length: 12 }, (_, index) => ({
      id: `source-${index}`,
      kind: "SOURCE",
      source: "DOCUMENT",
      documentIdentity: "doc",
      location: `p${index}`,
      snippet: "본문".repeat(70000),
    }));
    const conflicts = sources.map((source, index) => ({
      id: `conflict-${index}`,
      kind: "CONFLICT",
      source: "STRUCTURED",
      state: "UNKNOWN",
      conflictField: "POWER",
      snippet:
        mode === "absent" ? `소비전력 조건${index} 충돌` : "소비전력 조건 충돌",
      relatedEvidenceIds:
        mode === "absent"
          ? []
          : mode === "same-anchor"
            ? ["source-0"]
            : [source.id, "stale-common"],
    }));
    const evidence = mode === "stale" ? conflicts : [...sources, ...conflicts];
    const forward = compactAnalysisDetail({ evidence });
    const backward = compactAnalysisDetail({
      evidence: [...evidence].reverse().map((value) => ({
        ...value,
        ...("relatedEvidenceIds" in value
          ? { relatedEvidenceIds: [...value.relatedEvidenceIds].reverse() }
          : {}),
      })),
    });
    expect(
      forward.evidence.filter((value) => value.kind === "CONFLICT"),
    ).toHaveLength(8);
    expect(backward.evidence).toEqual(forward.evidence);
    expect(backward.reviewSemanticDigest).toBe(forward.reviewSemanticDigest);
    expect(analysisFingerprint(backward as TenderAnalysis)).toBe(
      analysisFingerprint(forward as TenderAnalysis),
    );
    // Source citations may be absent after persistence: re-projection must
    // keep the same chosen diagnostics and their order with stale references.
    expect(
      compactAnalysisDetail(JSON.parse(JSON.stringify(forward))).evidence,
    ).toEqual(forward.evidence);
    expect(JSON.stringify(forward.evidence)).not.toContain(sources[0].snippet);
  },
);

it("orders conflicts by resolved semantic anchors instead of source IDs or bulk snippets", () => {
  const sources = Array.from({ length: 12 }, (_, index) => ({
    id: `source-${index}`,
    kind: "SOURCE",
    source: "DOCUMENT",
    documentIdentity: "doc",
    location: `p${index}`,
    snippet: "원문 전체".repeat(30000),
  }));
  const conflicts = sources.map((source, index) => ({
    id: `conflict-${index}`,
    kind: "CONFLICT",
    source: "STRUCTURED",
    state: "UNKNOWN",
    conflictField: "POWER",
    snippet: "소비전력 조건 충돌",
    relatedEvidenceIds: [source.id],
  }));
  const before = compactAnalysisDetail({
    evidence: [...sources, ...conflicts],
  });
  const after = compactAnalysisDetail({
    evidence: [
      ...sources.map((source, index) => ({
        ...source,
        id: `relabeled-${11 - index}`,
        snippet: "완전히 다른 관련 없는 원문".repeat(20000),
      })),
      ...conflicts.map((conflict, index) => ({
        ...conflict,
        id: `derived-${11 - index}`,
        relatedEvidenceIds: [`relabeled-${11 - index}`],
      })),
    ].reverse(),
  });
  const selected = (result: typeof before) =>
    result.evidence.map((value) => value.semanticId);
  before.evidence.forEach((value) =>
    expect(value.semanticId).toMatch(/^[a-f0-9]{64}$/),
  );
  expect(selected(after)).toEqual(selected(before));
  expect(after.reviewSemanticDigest).toBe(before.reviewSemanticDigest);
});

it("retains capped identical conflicts with long IDs through JSON persistence and repeated projection", () => {
  const evidence = Array.from({ length: 12 }, (_, index) => ({
    id: `${"diagnostic-".repeat(17)}${index}`,
    kind: "CONFLICT",
    source: "STRUCTURED",
    state: "UNKNOWN",
    conflictField: "POWER",
    snippet: "소비전력 조건 충돌",
  }));
  const forward = compactAnalysisDetail({ evidence });
  expect(forward.evidence).toHaveLength(8);
  expect(new Set(forward.evidence.map((value) => value.id)).size).toBe(8);
  forward.evidence.forEach((value) =>
    expect(value.id).toMatch(/^sha256:[a-f0-9]{64}$/),
  );
  expect(compactAnalysisDetail({ evidence: [...evidence].reverse() })).toEqual(
    forward,
  );
  let projected = forward;
  for (let pass = 0; pass < 3; pass++) {
    projected = compactAnalysisDetail(JSON.parse(JSON.stringify(projected)));
    expect(projected).toEqual(forward);
  }
});

it("preserves canonical and malformed hash-looking IDs without collapsing distinct diagnostics", () => {
  const canonicalId = `sha256:${"a".repeat(64)}`;
  const shortIds = [
    canonicalId,
    `sha256:${"a".repeat(63)}`,
    `sha256:${"a".repeat(65)}`,
    `sha256:${"g".repeat(64)}`,
    `sha256:${"A".repeat(64)}`,
    `${canonicalId}:suffix`,
  ];
  const longIds = [
    `${canonicalId}${"x".repeat(100)}`,
    `${canonicalId}${"x".repeat(99)}y`,
  ];
  const evidence = [...shortIds, ...longIds].map((id) => ({
    id,
    kind: "CONFLICT",
    source: "STRUCTURED",
    conflictField: "POWER",
    snippet: "소비전력 조건 충돌",
  }));
  const compact = compactAnalysisDetail({ evidence });
  const outputIds = compact.evidence.map((value) => value.id);
  expect(outputIds).toEqual(expect.arrayContaining(shortIds));
  expect(new Set(outputIds).size).toBe(8);
  expect(outputIds).not.toEqual(expect.arrayContaining(longIds));
  outputIds
    .filter((id) => !shortIds.includes(String(id)))
    .forEach((id) => expect(id).toMatch(/^sha256:[a-f0-9]{64}$/));
  expect(compactAnalysisDetail({ evidence: [...evidence].reverse() })).toEqual(
    compact,
  );
  expect(compactAnalysisDetail(JSON.parse(JSON.stringify(compact)))).toEqual(
    compact,
  );
});
