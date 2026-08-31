export enum TenderSource {
  G2B = "G2B",
  KAPT = "KAPT",
  KEPCO = "KEPCO",
}

export enum ProcurementType {
  GOODS = "GOODS",
  CONSTRUCTION = "CONSTRUCTION",
  SERVICE = "SERVICE",
  OTHER = "OTHER",
}

export enum TenderOpportunityType {
  GOODS_SUPPLY = "GOODS_SUPPLY",
  MAS = "MAS",
  EXCLUDED_CONSTRUCTION = "EXCLUDED_CONSTRUCTION",
  EXCLUDED_NON_SUPPLY = "EXCLUDED_NON_SUPPLY",
}

export enum TenderRelevance {
  DIRECT = "DIRECT",
  POTENTIAL = "POTENTIAL",
}

export enum SyncRunStatus {
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}

export enum MailDeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  RETRY_SCHEDULED = "RETRY_SCHEDULED",
  SKIPPED = "SKIPPED",
  CANCELLED = "CANCELLED",
  DELIVERY_UNCERTAIN = "DELIVERY_UNCERTAIN",
}

export enum MailItemStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERY_UNCERTAIN = "DELIVERY_UNCERTAIN",
}

export enum DailyDispatchStatus {
  CLAIMED = "CLAIMED",
  COMPLETED = "COMPLETED",
}
