import type { TenderAnalysis, TenderAnalysisSummary, TenderRequirement } from '@/types'
export const isAnalysisActive = (status?: string) => status === 'PENDING' || status === 'PROCESSING'
export const isAnalysisReady = (status?: string) => status === 'COMPLETED' || status === 'PARTIAL'
export const analysisSummary = (analysis: TenderAnalysis): TenderAnalysisSummary => ({
  status: analysis.status,
  suitability: analysis.suitability ?? null,
  specificationScore: analysis.specificationScore ?? null,
  unknownCount: analysis.unknownCount ?? 0,
  analyzedAt: analysis.analyzedAt ?? null,
})
export const boundedEvidence = (text?: string | null) => {
  const chars = Array.from(text ?? '')
  return chars.length > 320 ? `${chars.slice(0, 319).join('')}…` : chars.join('')
}
/** Keep decimal amounts as strings, including digits beyond Number's precision. */
export const analysisAmount = (value?: string | null) => {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return '확인 필요'
  const [whole = '', fraction] = value.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}원`
}
/** The backend's historical rates are ratios; display percent without float conversion. */
export const analysisRate = (value?: string | null) => {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return '확인 필요'
  const [whole = '', fraction = ''] = value.split('.')
  const decimal = fraction.padEnd(2, '0')
  const integer = (whole + decimal.slice(0, 2)).replace(/^0+(?=\d)/, '')
  const tail = decimal.slice(2).replace(/0+$/, '')
  return `${integer}${tail ? `.${tail}` : ''}%`
}
export const requirementLabel = (requirement: TenderRequirement) => {
  const kinds = {
    POWER: '소비전력',
    LUMINOUS_EFFICACY: '광효율',
    COLOR_TEMPERATURE: '색온도',
    IP_RATING: '방수·방진',
    CRI: '연색성',
    DIMENSIONS: '크기',
    REGION: '지역',
    LICENSE: '업종·면허',
    COMPANY_TYPE: '기업구분',
    DIRECT_PRODUCTION: '직접생산',
    G2B_REGISTRATION: '나라장터 등록',
    PERFORMANCE: '납품실적',
  }
  return boundedEvidence(
    requirement.name ||
      requirement.label ||
      (requirement.kind ? kinds[requirement.kind] : '') ||
      '조건 확인 필요',
  )
}
export const requirementValue = (r: TenderRequirement) => {
  if (r.kind === 'PERFORMANCE') {
    const period =
      r.periodYears != null && Number.isFinite(r.periodYears) && r.periodYears > 0
        ? `최근 ${r.periodYears}년 이내`
        : ''
    const item = boundedEvidence(r.value || r.values?.join(' · ') || r.codes?.join(' · ') || r.code)
    const amount = analysisAmount(r.minimumAmount)
    const minimum =
      r.minimumAmount == null
        ? ''
        : amount === '확인 필요'
          ? '최소 금액 확인 필요'
          : `${amount} 이상`
    // Bound the item independently so clipping a long description cannot erase
    // the period or turn a minimum amount into an unqualified exact amount.
    return [period, item, minimum].filter(Boolean).join(' · ') || '원문 확인 필요'
  }
  const operators = { EQ: '=', GTE: '≥', LTE: '≤', GT: '>', LT: '<' }
  const units = { W: 'W', LM_PER_W: 'lm/W', K: 'K', IP: 'IP', CRI: 'Ra', MM: 'mm' }
  return (
    boundedEvidence(
      [
        r.comparator ? operators[r.comparator] : '',
        r.value ?? r.values?.join(' · ') ?? r.codes?.join(' · ') ?? r.code,
        r.unit ? units[r.unit] : '',
        r.minimumAmount ? analysisAmount(r.minimumAmount) : '',
      ]
        .filter(Boolean)
        .join(' '),
    ) || '원문 확인 필요'
  )
}
