import { SyncRunStatus, TenderSource } from "./tender.enums";
import { NormalizedTender } from "./normalized-tender";

export const TENDER_SOURCE_ADAPTERS = Symbol("TENDER_SOURCE_ADAPTERS");

export interface TenderFetchWindow {
  from: Date;
  to: Date;
}

export interface TenderOperationFailure {
  operation: string;
  errorCode: string;
  pageNo: number | null;
  providerResultCode: string | null;
  httpStatus: number | null;
  attempts: number;
}

export interface TenderSourceFetchResult {
  notices: NormalizedTender[];
  status:
    | SyncRunStatus.SUCCEEDED
    | SyncRunStatus.PARTIAL
    | SyncRunStatus.FAILED;
  errorCode: string | null;
  failures: TenderOperationFailure[];
}

export interface TenderSourceAdapter {
  readonly source: TenderSource;

  fetchNotices(window: TenderFetchWindow): Promise<TenderSourceFetchResult>;
}
