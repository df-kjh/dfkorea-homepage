export enum TenderAnalysisStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}

export enum TenderSuitability {
  RECOMMENDED = "RECOMMENDED",
  REVIEW = "REVIEW",
  DIFFICULT = "DIFFICULT",
}

export enum TenderRequirementState {
  SATISFIED = "SATISFIED",
  UNSATISFIED = "UNSATISFIED",
  UNKNOWN = "UNKNOWN",
}

export enum TenderDocumentStatus {
  PENDING = "PENDING",
  EXTRACTED = "EXTRACTED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
  UNSUPPORTED = "UNSUPPORTED",
}

export enum TenderAwardSyncStatus {
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}
