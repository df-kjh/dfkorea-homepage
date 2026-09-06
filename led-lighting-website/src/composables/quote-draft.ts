import type { QuoteCompany, QuoteDraft, QuoteItem } from '@/types/quote'
export const emptyFilters = () => ({
  power: [] as number[],
  colorTemp: [] as number[],
  certifications: [] as string[],
  options: [] as string[],
})
export function createDraft(): QuoteDraft {
  return {
    open: false,
    step: 1,
    company: {
      companyName: '',
      businessNumber: '',
      representativeName: '',
      openingDate: '',
      contactName: '',
      email: '',
      phone: '',
    },
    items: [],
    photos: [],
    consent: false,
    session: null,
    verification: null,
    notes: '',
    requestedDeliveryDate: '',
    error: '',
    busy: false,
    idempotencyKey: '',
    pendingSubmission: null,
    reference: '',
  }
}
export function setOpen(draft: QuoteDraft, open: boolean) {
  draft.open = open
}
export function businessFingerprint(company: QuoteCompany) {
  return JSON.stringify([
    company.companyName,
    company.businessNumber,
    company.representativeName,
    company.openingDate,
  ])
}
export function updateCompany(draft: QuoteDraft, patch: Partial<QuoteCompany>) {
  const before = businessFingerprint(draft.company)
  Object.assign(draft.company, patch)
  if (before !== businessFingerprint(draft.company)) draft.verification = null
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validateCompany(c: QuoteCompany, businessOnly = false): string {
  if (!c.companyName.trim() || c.companyName.length > 100)
    return '회사명(상호)을 100자 이내로 입력해 주세요.'
  if (!/^\d{10}$/.test(c.businessNumber.replace(/-/g, '')))
    return '사업자등록번호 숫자 10자리를 입력해 주세요.'
  if (!c.representativeName.trim() || c.representativeName.length > 100)
    return '대표자명을 100자 이내로 입력해 주세요.'
  if (!validDate(c.openingDate) || c.openingDate > new Date().toISOString().slice(0, 10))
    return '사업자등록증의 개업일자를 확인해 주세요.'
  if (businessOnly) return ''
  if (!c.contactName.trim() || c.contactName.length > 50)
    return '담당자명을 50자 이내로 입력해 주세요.'
  if (c.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))
    return '회신받을 이메일 주소를 확인해 주세요.'
  if (c.phone?.trim() && !/^[+\d][\d ()-]{6,24}$/.test(c.phone.trim()))
    return '전화번호는 숫자 또는 +로 시작해 7~25자로 입력하거나 비워 주세요.'
  return ''
}
export function normalizeSpecValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ]
}
export function validateItem(item: QuoteItem): string {
  for (const [label, values] of [
    ['필요한 인증', item.certifications],
    ['옵션', item.options],
  ] as const) {
    if (values.length > 20) return `${label}은 최대 20개까지 입력해 주세요.`
    if (new Set(values).size !== values.length) return `${label}의 중복 항목을 제거해 주세요.`
    if (values.some((value) => !value.trim() || value.length > 100))
      return `${label}의 각 항목을 1~100자로 입력해 주세요.`
  }

  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999999)
    return '수량은 1~999,999 사이의 정수로 입력해 주세요.'
  if (item.kind === 'catalog' && !item.productId) return '제품을 다시 선택해 주세요.'
  if (item.kind === 'custom') {
    if (!item.name?.trim() || item.name.length > 100)
      return '직접 입력할 제품 이름을 100자 이내로 입력해 주세요.'
    if (!item.description?.trim() || item.description.length > 2000)
      return '요구 사양 설명을 2,000자 이내로 입력해 주세요.'
  }
  if (
    [item.power, item.colorTemp].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value <= 0 || value > 1000000),
    )
  )
    return '소비전력과 색온도는 1,000,000 이하의 양수로 입력하거나 비워 주세요.'
  return ''
}
function specificationKey(item: QuoteItem) {
  return JSON.stringify([
    item.productId,
    item.power ?? null,
    item.colorTemp ?? null,
    [...item.options].sort(),
    [...item.certifications].sort(),
  ])
}
export function addItem(items: QuoteItem[], item: QuoteItem): QuoteItem[] {
  const error = validateItem(item)
  if (error) throw new Error(error)
  const same =
    item.kind === 'catalog'
      ? items.findIndex(
          (existing) =>
            existing.kind === 'catalog' && specificationKey(existing) === specificationKey(item),
        )
      : -1
  if (same >= 0) {
    const combined = { ...items[same]!, quantity: items[same]!.quantity + item.quantity }
    const combinedError = validateItem(combined)
    if (combinedError) throw new Error(combinedError)
    return items.map((existing, index) => (index === same ? combined : existing))
  }
  if (items.length >= 20) throw new Error('한 번에 최대 20개 품목까지 담을 수 있습니다.')
  return [...items, item]
}
export function validatePhoto(file: File, currentCount: number): string {
  if (currentCount >= 3) return '사진은 견적 요청 전체에서 최대 3장까지 첨부할 수 있습니다.'
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    return 'JPEG, PNG, WebP 사진만 첨부할 수 있습니다.'
  if (file.size > 5 * 1024 * 1024) return '사진은 한 장당 5MB 이하로 선택해 주세요.'
  return ''
}
