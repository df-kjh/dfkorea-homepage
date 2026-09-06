import { createHash } from "crypto";
import { ExtractedDocument } from "../documents/tender-document-extraction.types";
import {
  TenderRequirementState,
  TenderSuitability,
} from "./tender-analysis.enums";

export type TenderSpecificationKind =
  | "POWER"
  | "LUMINOUS_EFFICACY"
  | "COLOR_TEMPERATURE"
  | "IP_RATING"
  | "CRI"
  | "DIMENSIONS";

export type TenderSpecificationUnit =
  | "W"
  | "LM_PER_W"
  | "K"
  | "IP"
  | "CRI"
  | "MM";

export type TenderComparator = "EQ" | "GTE" | "LTE" | "GT" | "LT";
export type TenderRequirementSourcePriority = "STRUCTURED" | "DOCUMENT";

export interface TenderSpecificationRequirement {
  id: string;
  itemKey: string;
  kind: TenderSpecificationKind;
  comparator: TenderComparator;
  value?: string;
  values?: string[];
  unit: TenderSpecificationUnit;
  required: boolean;
  evidenceIds: string[];
  sourcePriority?: TenderRequirementSourcePriority;
}

export interface TenderProcurementItemRequirements {
  key: string;
  classificationCode: string | null;
  specifications: TenderSpecificationRequirement[];
  evidenceIds: string[];
  assignment?: "ASSIGNED" | "UNASSIGNED";
}

export interface TenderCertificationRequirement {
  id: string;
  code: string;
  name: string;
  required: boolean;
  itemKeys: string[];
  evidenceIds: string[];
}

export type TenderParticipationKind =
  | "REGION"
  | "LICENSE"
  | "COMPANY_TYPE"
  | "DIRECT_PRODUCTION"
  | "G2B_REGISTRATION"
  | "PERFORMANCE";

export interface TenderRegionPath {
  codes: string[];
  values: string[];
}

export interface TenderParticipationRequirement {
  id: string;
  kind: TenderParticipationKind;
  label: string;
  codes: string[];
  values: string[];
  required: boolean;
  sourcePriority: TenderRequirementSourcePriority;
  evidenceIds: string[];
  regionPaths?: TenderRegionPath[];
  periodYears?: number;
  minimumAmount?: string;
}

export interface TenderBidFormula {
  basisAmount?: string;
  lowerLimitRate?: string;
  lawKind?: "NATIONAL" | "LOCAL" | "OTHER";
  /** Absolute percentages of basis amount (97 means 0.97), never offsets. */
  reservePriceMinimumRate?: string;
  reservePriceMaximumRate?: string;
  evaluationBasisAmount?: string;
  reservePriceMethod?: string;
  plannedPriceMethod?: string;
  evidenceIds?: string[];
}

export interface TenderRequirementEvidence {
  id: string;
  kind: "SOURCE" | "UNSUPPORTED" | "CONFLICT";
  source: "STRUCTURED" | "DOCUMENT";
  state: "UNKNOWN" | null;
  snippet: string;
  operation?: string;
  field?: string;
  documentIdentity?: string;
  revision?: string;
  location?: string;
  conflictField?: string;
  relatedEvidenceIds?: string[];
}

export interface ParsedTenderRequirements {
  items: TenderProcurementItemRequirements[];
  certifications: TenderCertificationRequirement[];
  participationConditions: TenderParticipationRequirement[];
  bidFormula: TenderBidFormula;
  evidence: TenderRequirementEvidence[];
  fingerprint: string;
}

export interface TenderRequirementDocument extends ExtractedDocument {
  identity: string;
  revision: string;
}

// This deliberately excludes catalog names and descriptions. Analysis results
// may fingerprint a product's relevant capabilities but must never expose its
// commercial identity as a match or recommendation.
export interface TenderProductSnapshot {
  id: string;
  dimensions: string;
  power: number[];
  colorTemp: number[];
  certifications: string[];
  luminanceEfficiency?: number;
  colorRendering?: string;
  ipRating?: string;
}

export interface TenderRequirementEvaluation {
  requirementId: string;
  state: TenderRequirementState;
  required: boolean;
  evidenceIds: string[];
}

export interface TenderSuitabilityResult {
  suitability: TenderSuitability;
  specificationScore: number | null;
  satisfiedCount: number;
  unsatisfiedCount: number;
  unknownCount: number;
  totalCount: number;
  certifications: TenderRequirementEvaluation[];
  participationConditions: TenderRequirementEvaluation[];
  evidence: TenderRequirementEvidence[];
  inputFingerprints: {
    requirements: string;
    profile: string;
    products: string;
  };
}

export const TENDER_REGION_CODE_BY_NAME: Readonly<Record<string, string>> = {
  서울특별시: "11",
  부산광역시: "26",
  대구광역시: "27",
  인천광역시: "28",
  광주광역시: "29",
  대전광역시: "30",
  울산광역시: "31",
  세종특별자치시: "36",
  경기도: "41",
  충청북도: "43",
  충청남도: "44",
  전라북도: "45",
  전북특별자치도: "45",
  전라남도: "46",
  경상북도: "47",
  경상남도: "48",
  제주특별자치도: "50",
  강원도: "51",
  강원특별자치도: "51",
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

export const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
