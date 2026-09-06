export interface QuoteCompany {
  companyName: string
  businessNumber: string
  representativeName: string
  openingDate: string
  contactName: string
  email: string
  phone?: string
}
export interface QuoteItem {
  clientId: string
  kind: 'catalog' | 'custom'
  productId?: string
  name?: string
  modelName?: string
  quantity: number
  power?: number
  colorTemp?: number
  dimensions?: string
  certifications: string[]
  options: string[]
  description?: string
  attachmentIds: string[]
}
export interface QuotePhoto {
  clientId: string
  itemId: string
  file: File
  preview: string
  attachmentId?: string
  error?: string
}
export interface QuoteSession {
  sessionToken: string
  expiresAt: string
  privacy: { version: string; retentionDays: number }
}
export interface QuoteVerification {
  verificationToken: string
  expiresAt: string
}
export interface QuoteSubmission {
  idempotencyKey: string
  verificationToken: string
  company: QuoteCompany
  items: QuoteItem[]
  notes?: string
  requestedDeliveryDate?: string
  consentVersion: string
}
export interface ProductFilters {
  power: number[]
  colorTemp: number[]
  certifications: string[]
  options: string[]
}
export interface ProductFilterOptions extends ProductFilters {
  categories: string[]
}
export interface QuoteDraft {
  open: boolean
  step: 1 | 2 | 3
  company: QuoteCompany
  items: QuoteItem[]
  photos: QuotePhoto[]
  consent: boolean
  session: QuoteSession | null
  verification: QuoteVerification | null
  notes: string
  requestedDeliveryDate: string
  error: string
  busy: boolean
  idempotencyKey: string
  pendingSubmission: QuoteSubmission | null
  reference: string
}
