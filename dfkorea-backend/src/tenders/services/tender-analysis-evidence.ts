import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { canonicalJson, fingerprint } from "../domain/tender-requirement";

export const TENDER_EVIDENCE_LIMITS = {
  snippetCharacters: 320,
  perRequirement: 4,
  perItem: 12,
  totalItems: 80,
  jsonBytes: 48 * 1024,
  // Each category owns its quota before ordinary sources. Diagnostic entries
  // have their own byte quota so one category cannot hide another category.
  diagnosticQuotas: {
    SOURCE_FAILURE: 4,
    CONFLICT: 8,
    UNSUPPORTED: 12,
    TRUNCATION: 4,
  },
  diagnosticCategoryBytes: 6 * 1024,
} as const;

type RecordValue = Record<string, unknown>;
export type EvidenceInput = Partial<
  Pick<
    TenderAnalysis,
    | "requirements"
    | "certificationAnalysis"
    | "participationAnalysis"
    | "priceAnalysis"
    | "evidence"
    | "errorCode"
    | "reviewSemanticDigest"
  >
>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(record) : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
export const cleanAnalysisString = (value: unknown): string =>
  typeof value === "string"
    ? value
        .replace(
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim()
    : "";
const bounded = (value: unknown, length: number): string =>
  Array.from(cleanAnalysisString(value)).slice(0, length).join("");
export const boundedAnalysisIdentity = (
  value: unknown,
  limit: number,
): string => {
  const text = cleanAnalysisString(value);
  return Array.from(text).length > limit ? `sha256:${fingerprint(text)}` : text;
};
const stableSet = (values: unknown[]): unknown[] =>
  [...new Map(values.map((value) => [canonicalJson(value), value])).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);

// Sort candidate sets by their meaning/anchor before applying caps. Parser
// hashes and input list order are presentation details, not review semantics.
const orderingValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return stableSet(value.map(orderingValue));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(record(value))
        .filter(
          ([key]) =>
            !["id", "evidenceIds", "relatedEvidenceIds", "snippet"].includes(
              key,
            ),
        )
        .map(([key, child]) => [key, orderingValue(child)]),
    );
  return typeof value === "string" ? cleanAnalysisString(value) : value;
};
const orderedRecords = (value: unknown): RecordValue[] =>
  records(value).sort((a, b) =>
    canonicalJson(orderingValue(a)).localeCompare(
      canonicalJson(orderingValue(b)),
    ),
  );
const evidenceOrder = (value: RecordValue): string =>
  canonicalJson({
    ...record(orderingValue(value)),
    ...(value.kind === "UNSUPPORTED"
      ? { condition: cleanAnalysisString(value.snippet).replace(/\s+/g, "") }
      : {}),
  });

const SPECIFICATION_HINTS: Record<string, string[]> = {
  POWER: ["소비전력", "소비 전력", "정격전력", "정격 전력"],
  COLOR_TEMPERATURE: ["색온도", "색 온도", "상관"],
  LUMINOUS_EFFICACY: ["광효율", "발광"],
  IP_RATING: ["IP", "보호등급"],
  CRI: ["연색", "CRI", "Ra"],
  DIMENSIONS: ["치수", "크기", "규격"],
};
const requirementHints = (value: RecordValue): string[] =>
  [
    ...(SPECIFICATION_HINTS[String(value.kind)] ?? []),
    ...[value.label, value.name, value.code, value.value].map((value) =>
      bounded(value, 80),
    ),
    ...strings(value.codes).slice(0, 8),
    ...strings(value.values).slice(0, 8),
  ].filter((value) => value.length >= 2);

const excerpt = (value: unknown, hints: string[]): string => {
  const text = cleanAnalysisString(value);
  // Search within the complete in-memory source so a condition at the end of
  // a large block remains citable. Never return the surrounding whole block.
  let index =
    hints.map((hint) => text.indexOf(hint)).find((index) => index >= 0) ?? -1;
  if (index < 0)
    index = text.search(
      /소비\s*전력|색\s*온도|광효율|연색|치수|인증|필수|하여야|해야|제출|등록|보유|제한|기초금액|낙찰하한/,
    );
  const start = Math.max(0, index - 50);
  return bounded(
    text.slice(start, start + TENDER_EVIDENCE_LIMITS.snippetCharacters * 2),
    TENDER_EVIDENCE_LIMITS.snippetCharacters,
  );
};

/** Only requirement-linked sources and explicit unknown/conflict diagnostics
 * cross this boundary. Apply it before persistence AND to older stored rows. */
export function compactAnalysisEvidence(input: EvidenceInput): RecordValue[] {
  const byId = new Map(
    records(input.evidence)
      .filter((value) => typeof value.id === "string")
      .map((value) => [String(value.id), value]),
  );
  const selected = new Map<string, { value: RecordValue; hints: string[] }>();
  const itemCounts = new Map<string, number>();
  const select = (ids: string[], bucket: string, hints: string[]) => {
    for (const id of [...new Set(ids)]
      .filter((id) => byId.get(id)?.kind === "SOURCE")
      .sort((a, b) =>
        evidenceOrder(byId.get(a)!).localeCompare(evidenceOrder(byId.get(b)!)),
      )
      .slice(0, TENDER_EVIDENCE_LIMITS.perRequirement)) {
      const existing = selected.get(id);
      if (existing) {
        existing.hints.push(...hints.slice(0, 8));
        continue;
      }
      if (
        (itemCounts.get(bucket) ?? 0) >= TENDER_EVIDENCE_LIMITS.perItem ||
        selected.size >= TENDER_EVIDENCE_LIMITS.totalItems
      )
        break;
      const value = byId.get(id);
      if (!value) continue;
      selected.set(id, { value, hints: hints.slice(0, 16) });
      itemCounts.set(bucket, (itemCounts.get(bucket) ?? 0) + 1);
    }
  };
  for (const item of orderedRecords(input.requirements)) {
    const bucket = String(item.key ?? "specifications");
    for (const requirement of orderedRecords(item.specifications))
      select(
        strings(requirement.evidenceIds),
        bucket,
        requirementHints(requirement),
      );
  }
  for (const [name, analysis] of [
    ["certifications", input.certificationAnalysis],
    ["participation", input.participationAnalysis],
  ] as const) {
    for (const requirement of orderedRecords(record(analysis).requirements)) {
      // Shared requirements charge the lexicographically first canonical
      // item exactly once; input order/duplicates cannot change the bucket.
      select(
        strings(requirement.evidenceIds),
        [
          ...new Set(strings(requirement.itemKeys).map(cleanAnalysisString)),
        ].sort()[0] ?? name,
        requirementHints(requirement),
      );
    }
  }
  select(
    strings(record(record(input.priceAnalysis).formula).evidenceIds),
    "formula",
    ["기초금액", "낙찰하한", "예정가격", "사정률"],
  );
  const output: RecordValue[] = [];
  const diagnosticBytes = new Map<string, number>();
  const diagnostics = analysisDiagnostics(input);
  const diagnosticSelections = Object.entries(
    TENDER_EVIDENCE_LIMITS.diagnosticQuotas,
  ).flatMap(([category, limit]) =>
    diagnostics
      .filter((value) => value.diagnosticCategory === category)
      .sort((a, b) => evidenceOrder(a).localeCompare(evidenceOrder(b)))
      .slice(0, limit)
      .map(
        (value) =>
          [String(value.id), { value, hints: [] as string[] }] as const,
      ),
  );
  for (const [id, { value, hints }] of [...diagnosticSelections, ...selected]) {
    if (output.some((value) => value.id === boundedAnalysisIdentity(id, 128)))
      continue;
    if (output.length >= TENDER_EVIDENCE_LIMITS.totalItems) break;
    if (
      !["SOURCE", "UNSUPPORTED", "CONFLICT"].includes(String(value.kind)) ||
      !["STRUCTURED", "DOCUMENT", "ANALYSIS"].includes(String(value.source))
    )
      continue;
    const citation: RecordValue = {
      id: boundedAnalysisIdentity(id, 128),
      kind: value.kind,
      source: value.source,
      state: value.state === "UNKNOWN" ? "UNKNOWN" : null,
      snippet: excerpt(value.snippet, hints),
      ...(Object.prototype.hasOwnProperty.call(
        TENDER_EVIDENCE_LIMITS.diagnosticQuotas,
        String(value.diagnosticCategory),
      )
        ? { diagnosticCategory: value.diagnosticCategory }
        : {}),
    };
    for (const [key, limit] of Object.entries({
      documentIdentity: 256,
      revision: 32,
      location: 128,
      operation: 128,
      field: 128,
      conflictField: 128,
    })) {
      if (typeof value[key] === "string")
        citation[key] =
          key === "documentIdentity"
            ? boundedAnalysisIdentity(value[key], limit)
            : bounded(value[key], limit);
    }
    const related = [...new Set(strings(value.relatedEvidenceIds))]
      .sort()
      .slice(0, TENDER_EVIDENCE_LIMITS.perRequirement)
      .map((id) => boundedAnalysisIdentity(id, 128));
    if (related.length) citation.relatedEvidenceIds = related;
    if (value.diagnosticCategory) {
      const category = String(value.diagnosticCategory);
      const bytes =
        (diagnosticBytes.get(category) ?? 0) +
        Buffer.byteLength(JSON.stringify(citation));
      if (bytes > TENDER_EVIDENCE_LIMITS.diagnosticCategoryBytes) continue;
      diagnosticBytes.set(category, bytes);
    }
    if (
      Buffer.byteLength(JSON.stringify([...output, citation]), "utf8") >
      TENDER_EVIDENCE_LIMITS.jsonBytes
    )
      continue;
    output.push(citation);
  }
  return output;
}

/** Safe synthetic diagnostics contain no provider message/body. Full source
 * failure details stay in the document status, never in analysis snippets. */
function analysisDiagnostics(input: EvidenceInput): RecordValue[] {
  const diagnostics: RecordValue[] = records(input.evidence).flatMap(
    (value) => {
      const category =
        value.diagnosticCategory === "TRUNCATION"
          ? "TRUNCATION"
          : value.diagnosticCategory === "SOURCE_FAILURE"
            ? "SOURCE_FAILURE"
            : ["CONFLICT", "UNSUPPORTED"].includes(String(value.kind))
              ? String(value.kind)
              : null;
      return category ? [{ ...value, diagnosticCategory: category }] : [];
    },
  );
  if (
    input.errorCode &&
    !diagnostics.some((value) => value.diagnosticCategory === "SOURCE_FAILURE")
  )
    diagnostics.push({
      id: "analysis-source-failure",
      kind: "UNSUPPORTED",
      source: "ANALYSIS",
      state: "UNKNOWN",
      diagnosticCategory: "SOURCE_FAILURE",
      operation: "analysis",
      field: "errorCode",
      snippet: "분석 자료 처리에 실패했습니다. 문서 상태를 확인해야 합니다.",
    });
  return diagnostics;
}

/** Hash complete reviewed facts BEFORE display quotas. Each textual semantic
 * field is reduced to a SHA-256 value in memory; no raw diagnostic text or
 * provider blocks are persisted in this digest. All diagnostic records count,
 * including those omitted from display. Source snippets are presentation only. */
export function analysisReviewDigest(input: EvidenceInput): string {
  const evidence = records(input.evidence);
  const anchor = (value: RecordValue): RecordValue =>
    Object.fromEntries(
      [
        "kind",
        "source",
        "state",
        "documentIdentity",
        "revision",
        "location",
        "operation",
        "field",
        "conflictField",
        "diagnosticCategory",
      ]
        .filter((key) => value[key] !== undefined)
        .map((key) => [
          key,
          typeof value[key] === "string"
            ? fingerprint(cleanAnalysisString(value[key]))
            : value[key],
        ])
        .concat(
          ["UNSUPPORTED", "CONFLICT"].includes(String(value.kind))
            ? [
                [
                  "conditionDigest",
                  fingerprint(
                    cleanAnalysisString(value.snippet).replace(/\s+/g, ""),
                  ),
                ],
              ]
            : [],
        ),
    );
  const evidenceById = new Map(
    evidence.map((value) => [String(value.id), anchor(value)]),
  );
  const definitions = [
    ...records(input.requirements).flatMap((item) =>
      records(item.specifications),
    ),
    ...records(record(input.certificationAnalysis).requirements),
    ...records(record(input.participationAnalysis).requirements),
  ];
  const byId = new Map(definitions.map((value) => [String(value.id), value]));
  const semantic = (
    value: unknown,
    key = "",
    parent: RecordValue = {},
    regionPath = false,
  ): unknown => {
    if (key === "evidenceIds" || key === "relatedEvidenceIds")
      return stableSet(
        strings(value).flatMap((id) =>
          evidenceById.has(id) ? [evidenceById.get(id)] : [],
        ),
      );
    if (key === "requirementId")
      return byId.has(String(value)) ? semantic(byId.get(String(value))) : null;
    if (Array.isArray(value)) {
      const values = value.map((item) =>
        semantic(item, "", {}, regionPath || key === "regionPaths"),
      );
      return (key === "values" && parent.kind === "DIMENSIONS") ||
        (regionPath && ["values", "codes"].includes(key))
        ? values
        : stableSet(values);
    }
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(record(value))
          .filter(
            ([field]) => !["id", "fingerprint", "snippet"].includes(field),
          )
          .map(([field, child]) => [
            field,
            semantic(child, field, record(value), regionPath),
          ]),
      );
    return typeof value === "string"
      ? fingerprint(cleanAnalysisString(value))
      : value;
  };
  return fingerprint({
    version: "full-semantics-2",
    requirements: semantic(input.requirements),
    certifications: semantic(input.certificationAnalysis),
    participation: semantic(input.participationAnalysis),
    price: semantic(input.priceAnalysis),
    diagnostics: stableSet(
      analysisDiagnostics(input).map((value) => ({
        ...anchor(value),
        related: semantic(value.relatedEvidenceIds, "relatedEvidenceIds"),
      })),
    ),
    error: semantic(input.errorCode ?? null),
  });
}

/** New rows retain the pre-projection digest. Legacy rows without it use all
 * available stored facts until the analyzer-version sweep rebuilds them. */
export function analysisReviewSemantics(input: EvidenceInput): unknown {
  return {
    semanticDigest: input.reviewSemanticDigest ?? analysisReviewDigest(input),
  };
}
