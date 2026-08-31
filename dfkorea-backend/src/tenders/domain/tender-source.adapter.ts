import { SyncRunStatus, TenderSource } from "./tender.enums";
import { NormalizedTender } from "./normalized-tender";

export const TENDER_SOURCE_ADAPTERS = Symbol("TENDER_SOURCE_ADAPTERS");
export const LICENSE_LIMIT_UNAVAILABLE_ERROR_CODE =
  "LICENSE_LIMIT_UNAVAILABLE";

export interface TenderFetchWindow {
  from: Date;
  to: Date;
}

export interface TenderSourceFetchResult {
  notices: NormalizedTender[];
  status: SyncRunStatus.SUCCEEDED | SyncRunStatus.PARTIAL;
  errorCode: string | null;
}

export interface TenderSourceAdapter {
  readonly source: TenderSource;

  fetchNotices(window: TenderFetchWindow): Promise<TenderSourceFetchResult>;
}
