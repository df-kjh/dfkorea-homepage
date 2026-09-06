import { TenderAnalysis } from "../entities/tender-analysis.entity";
import {
  analysisReviewDigest,
  cleanAnalysisString,
  boundedAnalysisIdentity,
  compactAnalysisEvidence,
  EvidenceInput,
} from "./tender-analysis-evidence";

export const TENDER_DETAIL_LIMITS = {
  textCharacters: 320,
  identifierCharacters: 128,
  decimalCharacters: 64,
  arrayItems: 80,
  sectionJsonBytes: 16 * 1024,
} as const;

type Scalar = "text" | "identifier" | "decimal" | "boolean" | "number";
type Shape = Scalar | { [key: string]: Shape } | readonly [Shape];
const ids = ["identifier"] as const;
const evaluation: Shape = {
  requirementId: "identifier",
  state: "identifier",
  required: "boolean",
  evidenceIds: ids,
};
const requirement: Shape = {
  id: "identifier",
  kind: "identifier",
  required: "boolean",
  evidenceIds: ids,
  sourcePriority: "identifier",
};
const specification: Shape = {
  ...requirement,
  itemKey: "identifier",
  comparator: "identifier",
  value: "decimal",
  values: ["decimal"],
  unit: "identifier",
};
const participation: Shape = {
  ...requirement,
  label: "text",
  codes: ids,
  values: ["text"],
  regionPaths: [{ codes: ids, values: ["text"] }],
  periodYears: "number",
  minimumAmount: "decimal",
};
const formula: Shape = {
  basisAmount: "decimal",
  lowerLimitRate: "decimal",
  lawKind: "identifier",
  reservePriceMinimumRate: "decimal",
  reservePriceMaximumRate: "decimal",
  evaluationBasisAmount: "decimal",
  reservePriceMethod: "text",
  plannedPriceMethod: "text",
  evidenceIds: ids,
};
const rateSummary: Shape = {
  median: "decimal",
  p25: "decimal",
  p75: "decimal",
};
const sections: Record<string, Shape> = {
  requirements: [
    {
      key: "identifier",
      classificationCode: "identifier",
      specifications: [specification],
      evidenceIds: ids,
      assignment: "identifier",
    },
  ],
  certificationAnalysis: {
    evaluations: [evaluation],
    requirements: [
      { ...requirement, code: "identifier", name: "text", itemKeys: ids },
    ],
  },
  participationAnalysis: {
    evaluations: [evaluation],
    requirements: [participation],
    profileMissing: "boolean",
  },
  priceAnalysis: {
    official: {
      status: "identifier",
      minimum: "decimal",
      maximum: "decimal",
      formulaKind: "identifier",
    },
    statistics: {
      status: "identifier",
      confidence: "identifier",
      sampleCount: "number",
      excludedCount: "number",
      matchingLevel: "identifier",
      period: { start: "identifier", end: "identifier" },
      estimatedPrice: "decimal",
      minimum: "decimal",
      maximum: "decimal",
      adjustmentRate: rateSummary,
      winningRate: rateSummary,
    },
    basisAmount: "decimal",
    lowerLimitRate: "decimal",
    formula,
  },
};

/** Long identities use an opaque stable token, avoiding collisions between
 * clipped prefixes. Decimal strings are withheld rather than showing a
 * different numeric value. Text explicitly ends in an ellipsis when clipped. */
export function boundedAnalysisDisplay(
  value: unknown,
  limit: number = TENDER_DETAIL_LIMITS.textCharacters,
  identity = false,
): string {
  const text = cleanAnalysisString(value);
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  return identity
    ? boundedAnalysisIdentity(text, limit)
    : `${chars.slice(0, limit - 1).join("")}…`;
}

/** Only the documented normalized fields cross the persistence/API boundary.
 * Limits apply after analysis so clipping cannot change a comparison result.
 * A per-section budget prevents many individually short fields leaking bulk
 * content; omitted fields/arrays are explicitly marked with safe diagnostics. */
export function compactAnalysisDetail(
  input: EvidenceInput,
): Partial<TenderAnalysis> {
  const reviewSemanticDigest =
    input.reviewSemanticDigest ?? analysisReviewDigest(input);
  const diagnostics: Record<string, unknown>[] = [];
  const omittedPaths = new Set<string>();
  const mark = (path: string) => omittedPaths.add(path);
  const result: Record<string, unknown> = {};
  for (const [section, shape] of Object.entries(sections)) {
    let bytes = 2;
    const charge = (value: unknown, path: string): boolean => {
      const size = Buffer.byteLength(JSON.stringify(value)) + 1;
      if (bytes + size > TENDER_DETAIL_LIMITS.sectionJsonBytes) {
        mark(path);
        return false;
      }
      bytes += size;
      return true;
    };
    const project = (value: unknown, shape: Shape, path: string): unknown => {
      if (value === undefined) return undefined;
      if (value === null) return charge(null, path) ? null : undefined;
      if (typeof shape === "string") {
        let output: unknown;
        if (shape === "boolean" || shape === "number") {
          output =
            typeof value === shape &&
            (shape !== "number" || Number.isFinite(value))
              ? value
              : null;
          if (output === null) mark(path);
        } else if (typeof value !== "string") {
          mark(path);
          output = null;
        } else {
          const cleaned = cleanAnalysisString(value);
          const limit =
            shape === "text"
              ? TENDER_DETAIL_LIMITS.textCharacters
              : shape === "decimal"
                ? TENDER_DETAIL_LIMITS.decimalCharacters
                : TENDER_DETAIL_LIMITS.identifierCharacters;
          const exceeded = Array.from(cleaned).length > limit;
          if (exceeded || cleaned !== value) mark(path);
          output =
            shape === "decimal" && exceeded
              ? null
              : boundedAnalysisDisplay(cleaned, limit, shape === "identifier");
        }
        return charge(output, path) ? output : undefined;
      }
      if (Array.isArray(shape)) {
        if (!Array.isArray(value)) {
          mark(path);
          return charge(null, path) ? null : undefined;
        }
        if (value.length > TENDER_DETAIL_LIMITS.arrayItems) mark(path);
        if (!charge([], path)) return undefined;
        const output: unknown[] = [];
        const items = path.endsWith(".itemKeys")
          ? [
              ...new Set(
                value
                  .filter((item): item is string => typeof item === "string")
                  .map(cleanAnalysisString),
              ),
            ].sort()
          : value;
        for (const item of items.slice(0, TENDER_DETAIL_LIMITS.arrayItems)) {
          const child = project(item, shape[0], `${path}[]`);
          if (child !== undefined) output.push(child);
        }
        return output;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        mark(path);
        return charge(null, path) ? null : undefined;
      }
      const fields = shape as Record<string, Shape>;
      const source = value as Record<string, unknown>;
      if (Object.keys(source).some((key) => !(key in fields)))
        mark(`${path}.*`);
      if (!charge({}, path)) return undefined;
      const output: Record<string, unknown> = {};
      for (const [key, childShape] of Object.entries(fields)) {
        if (source[key] === undefined || !charge(key, path)) continue;
        const child = project(source[key], childShape, `${path}.${key}`);
        if (child !== undefined) output[key] = child;
      }
      return output;
    };
    result[section] =
      project(input[section as keyof EvidenceInput], shape, section) ?? null;
  }
  // Paths consist solely of schema keys, never provider object keys or values.
  // One aggregate diagnostic is sufficient; the complete original semantic
  // digest below captures all changes, including every undisplayed tail.
  if (omittedPaths.size)
    diagnostics.push({
      id: "analysis-display-truncation",
      kind: "UNSUPPORTED",
      source: "ANALYSIS",
      state: "UNKNOWN",
      diagnosticCategory: "TRUNCATION",
      operation: "display-projection",
      field: "normalizedDetail",
      snippet:
        "상세 표시 한도로 일부 값이 축약되거나 생략되었습니다. 전체 조건은 원문에서 확인해야 합니다.",
    });
  result.evidence = compactAnalysisEvidence({
    ...input,
    evidence: [...(input.evidence ?? []), ...diagnostics],
  });
  result.reviewSemanticDigest = reviewSemanticDigest;
  return result;
}
