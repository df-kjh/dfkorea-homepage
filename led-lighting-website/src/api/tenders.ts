import apiClient from './client'
import type {
  PaginatedTenderResponse,
  TenderWire,
  TenderAnalysis,
  TenderCompanyProfile,
  ReplaceTenderCompanyProfile,
  TenderReviewInput,
  Tender,
  TenderCalendarDay,
  TenderCalendarQuery,
  TenderCollectionResponse,
  TenderMailOAuthAuthorization,
  TenderMailOAuthStatus,
  TenderQuery,
  TenderSubscription,
  UpdateTenderSubscription,
} from '@/types'

const withoutUndefined = <T extends object>(query: T): Partial<T> =>
  Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Partial<T>

const normalizeTender = ({ analysis, ...tender }: TenderWire): Tender => ({
  ...tender,
  analysisSummary: analysis ?? null,
})

export const tendersAPI = {
  getAnalysis: (id: string) => apiClient.get<TenderAnalysis>(`/tenders/${id}/analysis`),
  reanalyze: (id: string) => apiClient.post<TenderAnalysis>(`/tenders/${id}/analysis`),
  saveReview: (id: string, input: TenderReviewInput) =>
    apiClient.post<TenderAnalysis>(`/tenders/${id}/review`, input),
  getCompanyProfile: () => apiClient.get<TenderCompanyProfile | null>('/tenders/company-profile'),
  replaceCompanyProfile: (input: ReplaceTenderCompanyProfile) =>
    apiClient.put<TenderCompanyProfile>('/tenders/company-profile', input),
  collect: () => apiClient.post<TenderCollectionResponse>('/tenders/collect'),
  getCalendar: (month: string, query: TenderCalendarQuery = {}) =>
    apiClient.get<TenderCalendarDay[]>('/tenders/calendar', {
      params: withoutUndefined({ month, ...query }),
    }),
  getAll: async (query: TenderQuery = {}) => {
    const response = await apiClient.get<
      Omit<PaginatedTenderResponse, 'data'> & { data: TenderWire[] }
    >('/tenders', { params: withoutUndefined(query) })
    return {
      ...response,
      data: { ...response.data, data: response.data.data.map(normalizeTender) },
    }
  },
  getOne: async (id: string) => {
    const response = await apiClient.get<Omit<Tender, 'analysisSummary'>>(`/tenders/${id}`)
    // The detail notice endpoint has no analysis field; analysis uses its dedicated route.
    return { ...response, data: { ...response.data, analysisSummary: null } }
  },
  getSubscription: () => apiClient.get<TenderSubscription>('/tenders/subscription'),
  updateSubscription: (subscription: UpdateTenderSubscription) =>
    apiClient.put<TenderSubscription>('/tenders/subscription', subscription),
  getMailOAuthStatus: () => apiClient.get<TenderMailOAuthStatus>('/tenders/mail/oauth/status'),
  authorizeMailOAuth: () =>
    apiClient.post<TenderMailOAuthAuthorization>('/tenders/mail/oauth/authorize'),
}
