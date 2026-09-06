import type { Tender, TenderAnalysis, TenderCompanyProfile } from '@/types'
export const tender: Tender = {
  id: 'tender-1',
  source: 'G2B',
  sourceNoticeId: 'N-1',
  revision: '000',
  title: 'LED 조명',
  orderingOrganization: '서울시',
  demandOrganization: null,
  registeredAt: '2026-08-31T15:30:00.000Z',
  bidStartedAt: null,
  bidEndedAt: '2026-09-01T15:30:00.000Z',
  openedAt: null,
  region: '서울',
  procurementType: 'GOODS',
  contractMethod: null,
  estimatedAmount: null,
  sourceUrl: 'https://example.go.kr/1',
  relevance: 'DIRECT',
  relevanceScore: 100,
  relevanceReasons: [{ field: 'title', keyword: 'LED', score: 100 }],
  analysisSummary: null,
}
export const analysis: TenderAnalysis = {
  tenderId: tender.id,
  status: 'COMPLETED',
  suitability: 'REVIEW',
  specificationScore: 82,
  unknownCount: 4,
  analyzedAt: '2026-09-01T12:00:00Z',
  analysisFingerprint: 'fp-1',
  comparableCount: 8,
  satisfiedCount: 7,
  unsatisfiedCount: 1,
  requirements: [
    {
      key: 'item-1',
      classificationCode: '391116',
      specifications: Array.from({ length: 9 }, (_, i) => ({
        id: `s${i}`,
        kind: 'POWER',
        comparator: 'LTE',
        value: '40',
        unit: 'W',
        required: true,
        evidenceIds: ['e1'],
      })),
    },
  ],
  certificationAnalysis: {
    requirements: [{ id: 'c1', name: 'KC 인증', code: 'KC', required: true }],
    evaluations: [{ requirementId: 'c1', state: 'UNKNOWN', required: true }],
  },
  participationAnalysis: {
    requirements: [{ id: 'p1', label: '지역 제한', values: ['서울'], required: true }],
    evaluations: [{ requirementId: 'p1', state: 'SATISFIED' }],
    profileMissing: false,
  },
  priceAnalysis: {
    basisAmount: '100000000',
    lowerLimitRate: '87.745',
    official: { status: 'AVAILABLE', minimum: '85990100', maximum: '89509900' },
    statistics: {
      status: 'AVAILABLE',
      confidence: 'LOW',
      sampleCount: 15,
      excludedCount: 2,
      matchingLevel: 'ITEM_METHOD_REGION',
      period: { start: '2024-09-01', end: '2026-09-01' },
      estimatedPrice: '88700052',
      minimum: '87000000.25',
      maximum: '9007199254740993123456789.5',
      adjustmentRate: { median: '0.9982' },
      winningRate: { median: '0.8886' },
    },
  },
  evidence: [
    {
      id: 'e1',
      source: 'DOCUMENT',
      snippet: '소비전력은 40W 이하이어야 한다.',
      documentIdentity: '규격서.pdf',
      location: '2쪽',
      revision: '000',
    },
  ],
  documents: [
    {
      id: 'doc-1',
      sourceDocumentIdentity: 'doc-1',
      displayName: '규격서.pdf',
      format: 'PDF',
      status: 'EXTRACTED',
      errorCode: null,
      extractedAt: null,
    },
  ],
  reviewed: false,
  review: null,
}
export const profile: TenderCompanyProfile = {
  version: 1,
  companyName: '테스트 회사',
  businessNumber: '1234567890',
  headquarters: { sido: '서울특별시', sigungu: '강남구' },
  g2bRegistered: true,
  supplyProducts: [],
  licenses: [],
  companyTypes: [],
  directProduction: [],
  certifications: [],
  performanceRecords: [],
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
