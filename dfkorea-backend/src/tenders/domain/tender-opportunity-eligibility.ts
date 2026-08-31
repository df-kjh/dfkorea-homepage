import { TenderOpportunityType } from "./tender.enums";

/**
 * This is the single delivery/display policy. Both the admin opportunity
 * views and recipient selection use it so a reclassified tender disappears
 * consistently, including from a previously queued pending mail item.
 */
export const ELIGIBLE_TENDER_OPPORTUNITY_TYPES = [
  TenderOpportunityType.GOODS_SUPPLY,
  TenderOpportunityType.MAS,
] as const;

export const isEligibleTenderOpportunityType = (
  opportunityType: TenderOpportunityType,
): boolean =>
  (ELIGIBLE_TENDER_OPPORTUNITY_TYPES as readonly TenderOpportunityType[]).includes(
    opportunityType,
  );
