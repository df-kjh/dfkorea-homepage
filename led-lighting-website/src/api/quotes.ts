import axios from 'axios'
import { getApiBaseUrl } from '@/utils/api-base'
import type { QuoteCompany, QuoteSession, QuoteSubmission, QuoteVerification } from '@/types/quote'
// 익명 견적 세션에는 관리자 토큰/401 로그인 이동 인터셉터를 적용하지 않는다.
const client = axios.create({ baseURL: getApiBaseUrl(), timeout: 30000 })
const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
export const quotesAPI = {
  session: () => client.post<QuoteSession>('/quotes/sessions', {}),
  verify: (token: string, company: QuoteCompany, consentVersion: string, signal?: AbortSignal) =>
    client.post<QuoteVerification>(
      '/quotes/business-verifications',
      {
        companyName: company.companyName.trim(),
        businessNumber: company.businessNumber.replace(/\D/g, ''),
        representativeName: company.representativeName.trim(),
        openingDate: company.openingDate,
        consentVersion,
      },
      { ...auth(token), signal },
    ),
  upload: (token: string, file: File, clientAttachmentId: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('clientAttachmentId', clientAttachmentId)
    return client.post<{ id: string; name: string; mimeType: string; size: number }>(
      '/quotes/attachments',
      body,
      auth(token),
    )
  },
  remove: (token: string, id: string) =>
    client.delete(`/quotes/attachments/${encodeURIComponent(id)}`, auth(token)),
  submit: (token: string, body: QuoteSubmission) =>
    client.post<{ reference: string; status: 'RECEIVED' }>('/quotes', body, auth(token)),
}
export function quoteError(error: unknown): string {
  if (!axios.isAxiosError(error))
    return error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.'
  const code = error.response?.data?.code as string | undefined
  if (code?.includes('MISMATCH'))
    return '사업자등록증과 상호·대표자명·개업일자가 일치하는지 확인해 주세요.'
  if (code?.includes('CLOSED') || code?.includes('INACTIVE'))
    return '정상 영업 중인 사업자만 온라인 견적을 요청할 수 있습니다.'
  if (code?.includes('NOT_FOUND') || code?.includes('UNREGISTERED'))
    return '등록정보를 찾지 못했습니다. 신규 개업 정보는 반영까지 시간이 걸릴 수 있습니다.'
  switch (error.response?.status) {
    case 401:
    case 410:
      return '사업자 정보 확인 시간이 지났습니다. 입력은 보관되어 있으니 다시 확인해 주세요.'
    case 429:
      return '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
    case 503:
      return '현재 확인 서비스를 이용할 수 없습니다. 잠시 후 재시도하거나 전화·이메일로 문의해 주세요.'
    case 400:
    case 422:
      return '입력 정보 또는 사진을 확인해 주세요. 사업자 정보는 등록증과 정확히 일치해야 합니다.'
    case 409:
      return '이 요청의 처리 상태를 확인하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.'
    default:
      return '연결이 원활하지 않습니다. 입력은 보관되어 있으니 다시 시도해 주세요.'
  }
}
export function isExpiredQuoteError(error: unknown) {
  return axios.isAxiosError(error) && [401, 410].includes(error.response?.status ?? 0)
}
