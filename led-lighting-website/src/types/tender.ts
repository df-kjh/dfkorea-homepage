export type TenderSource = 'G2B' | 'KAPT' | 'KEPCO' | 'LH'

export type TenderCollectionSourceStatus = 'SUCCEEDED' | 'PARTIAL' | 'FAILED'

export interface TenderCollectionSourceResult {
  source: TenderSource
  status: TenderCollectionSourceStatus
  fetchedCount: number
  createdCount: number
  updatedCount: number
  excludedCount: number
  errorCode: string | null
}

export interface TenderCollectionResponse {
  lockAcquired: boolean
  collectedAt: string
  sources: TenderCollectionSourceResult[]
  failedSources: TenderSource[]
}

export type TenderProcurementType = 'GOODS' | 'CONSTRUCTION' | 'SERVICE' | 'OTHER'

export type TenderRelevance = 'DIRECT' | 'POTENTIAL'

export interface TenderRelevanceReason {
  field: string
  keyword: string
  score: number
}

export interface Tender {
  id: string
  source: TenderSource
  sourceNoticeId: string
  revision: string
  title: string
  orderingOrganization: string
  demandOrganization: string | null
  registeredAt: string
  bidStartedAt: string | null
  bidEndedAt: string | null
  openedAt: string | null
  region: string | null
  procurementType: TenderProcurementType
  contractMethod: string | null
  estimatedAmount: string | null
  sourceUrl: string
  relevance: TenderRelevance
  relevanceScore: number
  relevanceReasons: TenderRelevanceReason[]
  analysisSummary: TenderAnalysisSummary | null
}

export interface TenderCalendarDay {
  date: string
  total: number
  direct: number
  potential: number
}

export interface TenderCalendarCell extends TenderCalendarDay {
  inCurrentMonth: boolean
}

export interface TenderQuery {
  registeredDate?: string
  keyword?: string
  source?: TenderSource
  region?: string
  procurementType?: TenderProcurementType
  relevance?: TenderRelevance
  page?: number
  pageSize?: number
}

export type TenderCalendarQuery = Pick<
  TenderQuery,
  'keyword' | 'source' | 'region' | 'procurementType' | 'relevance'
>

export interface PaginatedTenderResponse {
  data: Tender[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TenderSubscription {
  enabled: boolean
  deliveryTime: string
  recipients: string[]
}

export type UpdateTenderSubscription = TenderSubscription

export interface TenderMailOAuthStatus {
  connected: boolean
  connectedAt: string | null
  accessTokenExpiresAt: string | null
}

export interface TenderMailOAuthAuthorization {
  authorizationUrl: string
}

export type TenderAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'
export type TenderSuitability = 'RECOMMENDED' | 'REVIEW' | 'DIFFICULT'
export type TenderRequirementState = 'SATISFIED' | 'UNSATISFIED' | 'UNKNOWN'
export type TenderDocumentStatus = 'PENDING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED' | 'UNSUPPORTED'
export interface TenderAnalysisSummary {
  status: TenderAnalysisStatus
  suitability: TenderSuitability | null
  specificationScore: number | null
  unknownCount: number
  analyzedAt: string | null
}
/** The API uses `analysis`; the client exposes one nullable summary consistently. */
export type TenderWire = Omit<Tender, 'analysisSummary'> & {
  analysis: TenderAnalysisSummary | null
}
export interface TenderQualification {
  code: string
  name: string
  expiresAt: string | null
}
export interface TenderPerformanceRecord {
  itemName: string
  from: string
  to: string
  amount: string
}
export interface ReplaceTenderCompanyProfile {
  companyName: string
  businessNumber: string
  headquarters: { sido: string; sigungu: string }
  g2bRegistered: boolean
  supplyProducts: TenderQualification[]
  licenses: TenderQualification[]
  companyTypes: TenderQualification[]
  directProduction: TenderQualification[]
  certifications: TenderQualification[]
  performanceRecords: TenderPerformanceRecord[]
}
export interface TenderCompanyProfile extends ReplaceTenderCompanyProfile {
  version: number
}
export interface TenderEvaluation {
  requirementId?: string | null
  state?: TenderRequirementState | null
  required?: boolean | null
  evidenceIds?: string[] | null
}
// Detailed normalized sections may omit fields after server display-budget projection.
// Absence is never interpreted as satisfaction or a zero-valued amount.
export interface TenderRequirement {
  id?: string | null
  required?: boolean | null
  evidenceIds?: string[] | null
  name?: string | null
  code?: string | null
  label?: string | null
  kind?:
    | 'POWER'
    | 'LUMINOUS_EFFICACY'
    | 'COLOR_TEMPERATURE'
    | 'IP_RATING'
    | 'CRI'
    | 'DIMENSIONS'
    | 'REGION'
    | 'LICENSE'
    | 'COMPANY_TYPE'
    | 'DIRECT_PRODUCTION'
    | 'G2B_REGISTRATION'
    | 'PERFORMANCE'
    | null
  comparator?: 'EQ' | 'GTE' | 'LTE' | 'GT' | 'LT' | null
  value?: string | null
  values?: string[] | null
  codes?: string[] | null
  unit?: 'W' | 'LM_PER_W' | 'K' | 'IP' | 'CRI' | 'MM' | null
  itemKey?: string | null
  itemKeys?: string[] | null
  sourcePriority?: 'STRUCTURED' | 'DOCUMENT' | null
  regionPaths?: { codes?: string[] | null; values?: string[] | null }[] | null
  periodYears?: number | null
  minimumAmount?: string | null
}
export interface TenderRequirementItem {
  key?: string | null
  classificationCode?: string | null
  specifications?: TenderRequirement[] | null
  evidenceIds?: string[] | null
  assignment?: 'ASSIGNED' | 'UNASSIGNED' | null
}
export interface TenderEvidence {
  id?: string
  kind?: 'SOURCE' | 'UNSUPPORTED' | 'CONFLICT'
  source?: 'STRUCTURED' | 'DOCUMENT' | 'ANALYSIS'
  state?: 'UNKNOWN' | null
  snippet?: string
  documentIdentity?: string
  location?: string
  revision?: string
  operation?: string
  field?: string
  conflictField?: string
  relatedEvidenceIds?: string[]
  diagnosticCategory?: string
  semanticId?: string
}
export interface TenderRateSummary {
  median?: string | null
  p25?: string | null
  p75?: string | null
}
export interface TenderPriceAnalysis {
  basisAmount?: string | null
  lowerLimitRate?: string | null
  formula?: {
    basisAmount?: string | null
    lowerLimitRate?: string | null
    lawKind?: 'NATIONAL' | 'LOCAL' | 'OTHER' | null
    reservePriceMinimumRate?: string | null
    reservePriceMaximumRate?: string | null
    evaluationBasisAmount?: string | null
    reservePriceMethod?: string | null
    plannedPriceMethod?: string | null
    evidenceIds?: string[] | null
  } | null
  official?: {
    status?: 'AVAILABLE' | 'FORMULA_REVIEW_REQUIRED' | null
    minimum?: string | null
    maximum?: string | null
    formulaKind?: string | null
  } | null
  statistics?: {
    status?: 'AVAILABLE' | 'INSUFFICIENT_SAMPLES' | 'INCOMPARABLE_CONTRACT' | null
    confidence?: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH' | null
    sampleCount?: number | null
    excludedCount?: number | null
    matchingLevel?: 'ITEM_METHOD_REGION' | 'ITEM_METHOD' | 'LED_GROUP_METHOD' | null
    period?: { start?: string | null; end?: string | null } | null
    estimatedPrice?: string | null
    minimum?: string | null
    maximum?: string | null
    adjustmentRate?: TenderRateSummary | null
    winningRate?: TenderRateSummary | null
  } | null
}
export interface TenderAnalysis extends Partial<Omit<TenderAnalysisSummary, 'status'>> {
  status: TenderAnalysisStatus
  tenderId: string
  id?: string
  analysisFingerprint: string | null
  comparableCount?: number
  satisfiedCount?: number
  unsatisfiedCount?: number
  requirements?: TenderRequirementItem[] | null
  certificationAnalysis?: {
    requirements?: TenderRequirement[] | null
    evaluations?: TenderEvaluation[] | null
  } | null
  participationAnalysis?: {
    requirements?: TenderRequirement[] | null
    evaluations?: TenderEvaluation[] | null
    profileMissing?: boolean | null
  } | null
  priceAnalysis: TenderPriceAnalysis | null
  evidence?: TenderEvidence[] | null
  errorCode?: string | null
  documents: {
    id: string
    sourceDocumentIdentity: string
    displayName: string
    format: string | null
    status: TenderDocumentStatus
    errorCode: string | null
    extractedAt: string | null
  }[]
  reviewed: boolean
  review: {
    completed: boolean
    note: string
    reviewerAdminId: number
    reviewedAt: string
    analysisFingerprint: string
  } | null
}
export interface TenderReviewInput {
  analysisFingerprint: string
  completed: boolean
  note?: string
}
