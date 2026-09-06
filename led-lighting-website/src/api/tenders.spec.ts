import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./client', () => ({
  default: { get, post, put },
}))

import { tendersAPI } from './tenders'

describe('tendersAPI', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: [] } })
    post.mockReset()
    put.mockReset()
  })

  it('uses protected analysis/profile/review routes with full replacement', async () => {
    get.mockResolvedValue({ data: { data: [], total: 0 } })
    const profile = {
      companyName: '회사',
      businessNumber: '1234567890',
      headquarters: { sido: '서울', sigungu: '강남구' },
      g2bRegistered: true,
      supplyProducts: [],
      licenses: [],
      companyTypes: [],
      directProduction: [],
      certifications: [],
      performanceRecords: [],
    }
    tendersAPI.getAnalysis('one')
    tendersAPI.reanalyze('one')
    tendersAPI.saveReview('one', { completed: true, note: '확인' })
    tendersAPI.getCompanyProfile()
    tendersAPI.replaceCompanyProfile(profile)
    expect(get).toHaveBeenCalledWith('/tenders/one/analysis')
    expect(post).toHaveBeenCalledWith('/tenders/one/analysis')
    expect(post).toHaveBeenCalledWith('/tenders/one/review', { completed: true, note: '확인' })
    expect(get).toHaveBeenCalledWith('/tenders/company-profile')
    expect(put).toHaveBeenCalledWith('/tenders/company-profile', profile)
  })

  it('normalizes the backend analysis field to a nullable analysisSummary', async () => {
    const summary = {
      status: 'COMPLETED',
      suitability: 'RECOMMENDED',
      specificationScore: 82,
      unknownCount: 0,
      analyzedAt: null,
    }
    get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'one', analysis: summary },
          { id: 'two', analysis: null },
        ],
      },
    })
    const response = await tendersAPI.getAll()
    expect(response.data.data[0]?.analysisSummary).toEqual(summary)
    expect(response.data.data[1]?.analysisSummary).toBeNull()
    get.mockResolvedValueOnce({ data: { id: 'one' } })
    expect((await tendersAPI.getOne('one')).data.analysisSummary).toBeNull()
  })

  it('requests an immediate collection without a request body', () => {
    tendersAPI.collect()

    expect(post).toHaveBeenCalledWith('/tenders/collect')
  })

  it('sends the backend list query names including pageSize', () => {
    tendersAPI.getAll({
      registeredDate: '2026-08-27',
      keyword: 'LED',
      source: 'G2B',
      region: '서울',
      procurementType: 'GOODS',
      relevance: 'DIRECT',
      page: 2,
      pageSize: 30,
    })

    expect(get).toHaveBeenCalledWith('/tenders', {
      params: {
        registeredDate: '2026-08-27',
        keyword: 'LED',
        source: 'G2B',
        region: '서울',
        procurementType: 'GOODS',
        relevance: 'DIRECT',
        page: 2,
        pageSize: 30,
      },
    })
  })

  it('sends only shared email settings when replacing the subscription', () => {
    tendersAPI.updateSubscription({
      enabled: true,
      deliveryTime: '09:00',
      recipients: ['sales@example.com', 'bid@example.com'],
    })

    expect(put).toHaveBeenCalledWith('/tenders/subscription', {
      enabled: true,
      deliveryTime: '09:00',
      recipients: ['sales@example.com', 'bid@example.com'],
    })
  })

  it('uses the protected tender calendar, detail, and subscription routes', () => {
    tendersAPI.getCalendar('2026-08', { keyword: 'LED', source: 'G2B', relevance: 'DIRECT' })
    tendersAPI.getOne('a4d643b6-6448-4cad-9096-a82ba8cd2d60')
    tendersAPI.getSubscription()

    expect(get).toHaveBeenNthCalledWith(1, '/tenders/calendar', {
      params: { month: '2026-08', keyword: 'LED', source: 'G2B', relevance: 'DIRECT' },
    })
    expect(get).toHaveBeenNthCalledWith(2, '/tenders/a4d643b6-6448-4cad-9096-a82ba8cd2d60')
    expect(get).toHaveBeenNthCalledWith(3, '/tenders/subscription')
  })

  it('uses the protected NAVER WORKS OAuth status and authorization routes', () => {
    tendersAPI.getMailOAuthStatus()
    tendersAPI.authorizeMailOAuth()

    expect(get).toHaveBeenCalledWith('/tenders/mail/oauth/status')
    expect(post).toHaveBeenCalledWith('/tenders/mail/oauth/authorize')
  })
})
