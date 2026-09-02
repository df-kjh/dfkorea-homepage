import { ProcurementType, TenderSource } from "./tender.enums";

export interface TenderVisibilityFields {
  source: TenderSource;
  procurementType: ProcurementType;
}

/**
 * G2B is intentionally restricted to goods because the company cannot
 * participate in electrical-construction tenders. Other providers, including
 * K-apt, retain their existing coverage.
 */
export const isTenderVisible = (tender: TenderVisibilityFields): boolean =>
  tender.source !== TenderSource.G2B ||
  tender.procurementType === ProcurementType.GOODS;
