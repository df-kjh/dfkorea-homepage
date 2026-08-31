export type TenderSource = 'G2B' | 'KAPT' | 'KEPCO'

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

// Calendar, list, and mail only receive tender opportunities eligible for delivery.
export type TenderOpportunityType = 'GOODS_SUPPLY' | 'MAS'

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
  opportunityType: TenderOpportunityType
  opportunityReasons: string[]
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
