export enum TenderSource {
  G2B = 'G2B',
  KAPT = 'KAPT',
  KEPCO = 'KEPCO',
}

export enum ProcurementType {
  GOODS = 'GOODS',
  CONSTRUCTION = 'CONSTRUCTION',
  SERVICE = 'SERVICE',
  OTHER = 'OTHER',
}

export enum TenderRelevance {
  DIRECT = 'DIRECT',
  POTENTIAL = 'POTENTIAL',
}

export enum SyncRunStatus {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum MailDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  RETRY_SCHEDULED = 'RETRY_SCHEDULED',
  SKIPPED = 'SKIPPED',
}

export enum MailItemStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
}
