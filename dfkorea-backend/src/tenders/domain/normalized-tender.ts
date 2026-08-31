import { ProcurementType, TenderSource } from "./tender.enums";

export interface TenderLicenseLimit {
  name: string;
  permittedIndustries: string;
}

/**
 * A provider-neutral notice shape. Source adapters preserve their response in
 * rawData while exposing only fields the ingestion and query layers need.
 */
export interface NormalizedTender {
  source: TenderSource;
  sourceNoticeId: string;
  revision: string;
  title: string;
  orderingOrganization: string;
  demandOrganization: string | null;
  registeredAt: Date;
  bidStartedAt: Date | null;
  bidEndedAt: Date | null;
  openedAt: Date | null;
  region: string | null;
  procurementType: ProcurementType;
  contractMethod: string | null;
  estimatedAmount: string | null;
  sourceUrl: string;
  itemName: string;
  description: string;
  attachmentNames: string[];
  licenseLimits: TenderLicenseLimit[];
  rawData: Record<string, unknown>;
}
