import type { TenderPricingContext } from "./tender-price-analyzer";
import { NormalizedTender } from "./normalized-tender";

export const TENDER_ENRICHMENT_ADAPTERS = Symbol("TENDER_ENRICHMENT_ADAPTERS");
export const G2B_TENDER_ENRICHMENT_ADAPTER = Symbol(
  "G2B_TENDER_ENRICHMENT_ADAPTER",
);
export const KAPT_TENDER_ENRICHMENT_ADAPTER = Symbol(
  "KAPT_TENDER_ENRICHMENT_ADAPTER",
);
export const LH_TENDER_ENRICHMENT_ADAPTER = Symbol(
  "LH_TENDER_ENRICHMENT_ADAPTER",
);
export const TENDER_DOCUMENT_FETCHER = Symbol("TENDER_DOCUMENT_FETCHER");

export type TenderEnrichmentEvidenceSource =
  | "G2B_API"
  | "KAPT_PAGE"
  | "LH_PAGE";
export type TenderDocumentFormat =
  | "PDF"
  | "HWP"
  | "HWPX"
  | "DOCX"
  | "XLSX"
  | "ZIP";
export type TenderLawKind = "NATIONAL" | "LOCAL" | "OTHER";

export interface EvidenceRef {
  source: TenderEnrichmentEvidenceSource;
  operation: string;
  field: string;
}

export interface TenderEvidenceValue<T> {
  value: T;
  evidence: EvidenceRef;
}

export interface TenderFormulaVariable {
  key: string;
  value: string;
  evidence: EvidenceRef;
}

export interface TenderRegionRequirement {
  code: string;
  name: string;
  required: boolean;
  evidence: EvidenceRef;
}

export interface TenderLicenseRequirement {
  code: string;
  name: string;
  group: string | null;
  required: boolean;
  evidence: EvidenceRef;
}

export interface TenderPurchaseItem {
  classificationCode: string;
  name: string;
  specification: string | null;
  quantity: string | null;
  unit: string | null;
  evidence: EvidenceRef;
}

export interface TenderDocumentReference {
  identity: string;
  url: string;
  displayName: string;
  formatHint: TenderDocumentFormat | null;
  source: TenderEnrichmentEvidenceSource;
  sourceNoticeId: string;
  revision: string;
  evidence: EvidenceRef;
}

const issuedTenderDocumentReferences = new WeakSet<TenderDocumentReference>();

export const issueTenderDocumentReference = (
  reference: TenderDocumentReference,
): TenderDocumentReference => {
  const issued = Object.freeze({
    ...reference,
    evidence: Object.freeze({ ...reference.evidence }),
  });
  issuedTenderDocumentReferences.add(issued);
  return issued;
};

export const isIssuedTenderDocumentReference = (
  reference: TenderDocumentReference,
): boolean => issuedTenderDocumentReferences.has(reference);

export interface TenderEnrichmentOperationFailure {
  /** Bounded aggregate count, never rejected provider values. */
  rejectedCount?: number;
  operation: string;
  errorCode: string;
  pageNo: number | null;
  providerResultCode: string | null;
  httpStatus: number | null;
  attempts: number;
}

export interface TenderEnrichment {
  /** Verified adapter metadata only; never inferred from source or amount presence. */
  pricingContext?: Omit<TenderPricingContext, "source" | "now">;
  pricingEvidence?: TenderEvidenceValue<string>[];
  basisAmount: TenderEvidenceValue<string> | null;
  lowerLimitRate: TenderEvidenceValue<string> | null;
  lawKind: TenderEvidenceValue<TenderLawKind> | null;
  formulaVariables: TenderFormulaVariable[];
  regions: TenderRegionRequirement[];
  licenses: TenderLicenseRequirement[];
  purchaseItems: TenderPurchaseItem[];
  documents: TenderDocumentReference[];
  failures: TenderEnrichmentOperationFailure[];
}

export interface TenderEnrichmentAdapter {
  enrich(
    tender: NormalizedTender,
    signal: AbortSignal,
  ): Promise<TenderEnrichment>;
}

export interface TenderDocumentFetchResult {
  bytes: Uint8Array;
  detectedFormat: TenderDocumentFormat;
  sha256: string;
}

export interface TenderDocumentFetcherContract {
  fetch(
    document: TenderDocumentReference,
    signal: AbortSignal,
  ): Promise<TenderDocumentFetchResult>;
}

export const emptyTenderEnrichment = (): TenderEnrichment => ({
  basisAmount: null,
  lowerLimitRate: null,
  lawKind: null,
  formulaVariables: [],
  regions: [],
  licenses: [],
  purchaseItems: [],
  documents: [],
  failures: [],
});

export const toSafeProviderResultCode = (
  providerResultCode: string | null | undefined,
): string | null =>
  providerResultCode === null || providerResultCode === undefined
    ? null
    : "PROVIDER_CODE_REPORTED";

export class TenderEnrichmentError extends Error {
  constructor(readonly code: string) {
    super(`Tender enrichment error: ${code}`);
    this.name = "TenderEnrichmentError";
  }
}
