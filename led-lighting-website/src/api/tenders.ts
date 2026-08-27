import apiClient from './client'
import type {
  PaginatedTenderResponse,
  Tender,
  TenderCalendarDay,
  TenderQuery,
  TenderSubscription,
  UpdateTenderSubscription,
} from '@/types'

const withoutUndefined = <T extends object>(query: T): Partial<T> =>
  Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Partial<T>

export const tendersAPI = {
  getCalendar: (month: string) =>
    apiClient.get<TenderCalendarDay[]>('/tenders/calendar', { params: { month } }),
  getAll: (query: TenderQuery = {}) =>
    apiClient.get<PaginatedTenderResponse>('/tenders', {
      params: withoutUndefined(query),
    }),
  getOne: (id: string) => apiClient.get<Tender>(`/tenders/${id}`),
  getSubscription: () => apiClient.get<TenderSubscription>('/tenders/subscription'),
  updateSubscription: (subscription: UpdateTenderSubscription) =>
    apiClient.put<TenderSubscription>('/tenders/subscription', subscription),
}
