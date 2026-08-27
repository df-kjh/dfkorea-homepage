import { TenderSource } from "./tender.enums";
import { NormalizedTender } from "./normalized-tender";

export const TENDER_SOURCE_ADAPTERS = Symbol("TENDER_SOURCE_ADAPTERS");

export interface TenderFetchWindow {
  from: Date;
  to: Date;
}

export interface TenderSourceAdapter {
  readonly source: TenderSource;

  fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]>;
}
