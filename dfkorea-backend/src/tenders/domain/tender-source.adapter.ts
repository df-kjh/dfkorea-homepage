import { TenderSource } from "./tender.enums";
import { NormalizedTender } from "./normalized-tender";

export interface TenderFetchWindow {
  from: Date;
  to: Date;
}

export interface TenderSourceAdapter {
  readonly source: TenderSource;

  fetchNotices(window: TenderFetchWindow): Promise<NormalizedTender[]>;
}
