// Keep this rule aligned with the backend sitemap for existing/API-supplied data.
export function normalizeCertificateCategory(category?: string | null): string {
  return category?.trim() || '기타'
}
