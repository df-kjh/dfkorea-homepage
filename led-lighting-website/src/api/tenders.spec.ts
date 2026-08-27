import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, put } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./client', () => ({
  default: { get, put },
}))

import { tendersAPI } from './tenders'

describe('tendersAPI', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
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
})
