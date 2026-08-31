import apiClient from './client'
import type {
  PaginatedTenderResponse,
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

export const tendersAPI = {
  collect: () => apiClient.post<TenderCollectionResponse>('/tenders/collect'),
  getCalendar: (month: string, query: TenderCalendarQuery = {}) =>
    apiClient.get<TenderCalendarDay[]>('/tenders/calendar', {
      params: withoutUndefined({ month, ...query }),
    }),
  getAll: (query: TenderQuery = {}) =>
    apiClient.get<PaginatedTenderResponse>('/tenders', {
      params: withoutUndefined(query),
    }),
  getOne: (id: string) => apiClient.get<Tender>(`/tenders/${id}`),
  getSubscription: () => apiClient.get<TenderSubscription>('/tenders/subscription'),
  updateSubscription: (subscription: UpdateTenderSubscription) =>
    apiClient.put<TenderSubscription>('/tenders/subscription', subscription),
  getMailOAuthStatus: () =>
    apiClient.get<TenderMailOAuthStatus>('/tenders/mail/oauth/status'),
  authorizeMailOAuth: () =>
    apiClient.post<TenderMailOAuthAuthorization>('/tenders/mail/oauth/authorize'),
}
