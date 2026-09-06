import { TenderAnalysis } from "../entities/tender-analysis.entity";
import { canonicalJson } from "../domain/tender-requirement";

export const TENDER_EVIDENCE_LIMITS = {
  snippetCharacters: 320,
  perRequirement: 4,
  perItem: 12,
  totalItems: 80,
  jsonBytes: 48 * 1024,
} as const;

type RecordValue = Record<string, unknown>;
type EvidenceInput = Partial<
  Pick<
    TenderAnalysis,
    | "requirements"
    | "certificationAnalysis"
    | "participationAnalysis"
    | "priceAnalysis"
    | "evidence"
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
const clean = (value: unknown): string =>
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
  Array.from(clean(value)).slice(0, length).join("");
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
  return typeof value === "string" ? clean(value) : value;
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
      ? { condition: clean(value.snippet).replace(/\s+/g, "") }
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
  const text = clean(value);
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
      .filter((id) => byId.has(id))
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
      select(
        strings(requirement.evidenceIds),
        strings(requirement.itemKeys)[0] ?? name,
        requirementHints(requirement),
      );
    }
  }
  select(
    strings(record(record(input.priceAnalysis).formula).evidenceIds),
    "formula",
    ["기초금액", "낙찰하한", "예정가격", "사정률"],
  );
  // Unsupported/conflicting conditions are themselves meaningful requirements
  // even when the parser could not produce a comparable numeric condition.
  for (const value of [...byId.values()].sort((a, b) =>
    evidenceOrder(a).localeCompare(evidenceOrder(b)),
  )) {
    if (value.kind === "UNSUPPORTED" || value.kind === "CONFLICT") {
      select([String(value.id)], "diagnostics", []);
    }
  }
  const output: RecordValue[] = [];
  for (const [id, { value, hints }] of selected) {
    if (
      !["SOURCE", "UNSUPPORTED", "CONFLICT"].includes(String(value.kind)) ||
      !["STRUCTURED", "DOCUMENT"].includes(String(value.source))
    )
      continue;
    const citation: RecordValue = {
      id: bounded(id, 128),
      kind: value.kind,
      source: value.source,
      state: value.state === "UNKNOWN" ? "UNKNOWN" : null,
      snippet: excerpt(value.snippet, hints),
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
        citation[key] = bounded(value[key], limit);
    }
    const related = strings(value.relatedEvidenceIds)
      .slice(0, TENDER_EVIDENCE_LIMITS.perRequirement)
      .map((id) => bounded(id, 128));
    if (related.length) citation.relatedEvidenceIds = related;
    if (
      Buffer.byteLength(JSON.stringify([...output, citation]), "utf8") >
      TENDER_EVIDENCE_LIMITS.jsonBytes
    )
      break;
    output.push(citation);
  }
  return output;
}

/** Canonical reviewed facts and their bounded source anchors. Parser IDs hash
 * raw snippets, so treating those IDs as facts would make cosmetic formatting
 * revoke reviews while failing to capture item/specification associations. */
export function analysisReviewSemantics(input: EvidenceInput): unknown {
  const evidence = compactAnalysisEvidence(input);
  const anchor = (value: RecordValue): RecordValue => {
    const {
      id: _id,
      snippet: _snippet,
      relatedEvidenceIds: _related,
      ...identity
    } = value;
    return value.kind === "UNSUPPORTED"
      ? {
          ...identity,
          unparsedCondition: clean(value.snippet).replace(/\s+/g, ""),
        }
      : identity;
  };
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
      // Dimension coordinates are ordered tuples; requirement sets, codes,
      // regions and evidence references have no meaningful list order.
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
    return typeof value === "string" ? clean(value) : value;
  };
  return {
    requirements: semantic(input.requirements),
    certifications: semantic(input.certificationAnalysis),
    participation: semantic(input.participationAnalysis),
    price: semantic(input.priceAnalysis),
    evidence: stableSet(evidence.map(anchor)),
  };
}
