import type { TenderSource } from '@/types'

export const TENDER_SOURCE_LABELS = {
  G2B: '나라장터',
  KAPT: 'K-apt',
  KEPCO: '한전',
  LH: 'LH',
} as const satisfies Record<TenderSource, string>

export const TENDER_SOURCE_OPTIONS = Object.entries(TENDER_SOURCE_LABELS).map(([value, label]) => ({
  value: value as TenderSource,
  label,
}))
