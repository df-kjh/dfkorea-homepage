import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TenderDetailModal from './TenderDetailModal.vue'
import { analysis, tender, deferred } from './__fixtures__/analysis'
import type { TenderAnalysis } from '@/types'
const api = vi.hoisted(() => ({ getAnalysis: vi.fn(), reanalyze: vi.fn(), saveReview: vi.fn() }))
vi.mock('@/api/tenders', () => ({ tendersAPI: api }))
let wrapper: VueWrapper
const open = () =>
  (wrapper = mount(TenderDetailModal, {
    props: { modelValue: true, tender },
    attachTo: document.body,
  }))
const body = () => document.body.textContent ?? ''
const click = async (label: string) => {
  const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label),
  )
  expect(button, label).toBeTruthy()
  button!.click()
  await flushPromises()
}
beforeEach(() => {
  api.getAnalysis.mockReset().mockResolvedValue({ data: structuredClone(analysis) })
  api.reanalyze.mockReset()
  api.saveReview.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
describe('TenderDetailModal', () => {
  it('renders the real 1120px summary before evidence, counts, Korean conditions and precision-safe statistics', async () => {
    api.getAnalysis.mockResolvedValue({
      data: {
        ...analysis,
        matchedProducts: [{ name: 'SECRET PRODUCT' }],
        extractedText: 'FULL PRIVATE DOCUMENT',
      },
    })
    open()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('style')).toContain('1120px')
    expect(body()).toContain('2026. 9. 1. 00:30')
    expect(body()).toContain('2026. 9. 2. 00:30')
    expect(body().indexOf('82%')).toBeLessThan(body().indexOf('소비전력은'))
    for (const text of [
      '9개 중 7개 충족',
      'KC 인증',
      '확인 필요',
      '지역 제한',
      '15건',
      '신뢰도 낮음',
      '2024-09-01',
      '2026-09-01',
      '9,007,199,254,740,993,123,456,789.5원',
      '규격서.pdf',
      '2쪽',
    ])
      expect(body()).toContain(text)
    expect(body()).not.toContain('SECRET PRODUCT')
    expect(body()).not.toContain('FULL PRIVATE DOCUMENT')
    expect(document.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
  })
  it.each([
    ['PARTIAL', '부분 분석'],
    ['FAILED', '분석 실패'],
    ['PENDING', '분석 대기'],
    ['PROCESSING', '분석 중'],
  ] as const)(
    'handles %s without presenting old recommendation as current',
    async (status, label) => {
      api.getAnalysis.mockResolvedValue({
        data: { ...analysis, status, suitability: 'RECOMMENDED' },
      })
      open()
      await flushPromises()
      expect(body()).toContain(label)
      expect(body()).not.toContain('참여 추천')
      if (status !== 'PARTIAL') expect(body()).not.toContain('82%')
    },
  )
  it('shows loading, no-profile and stale-review explanations', async () => {
    const pending = deferred<{ data: TenderAnalysis }>()
    api.getAnalysis.mockReturnValue(pending.promise)
    open()
    expect(body()).toContain('분석을 불러오는 중')
    pending.resolve({
      data: {
        ...analysis,
        participationAnalysis: { profileMissing: true },
        review: {
          completed: true,
          note: '이전 검토',
          reviewerAdminId: 1,
          reviewedAt: '',
          analysisFingerprint: 'old',
        },
      },
    })
    await flushPromises()
    expect(body()).toContain('회사 자격은 선택 사항입니다')
    expect(body()).toContain('사양과 가격 분석 결과는 그대로 이용할 수 있습니다')
    expect(body()).toContain('이전 검토')
    expect(body()).toContain('다시 검토')
  })
  it('allows queuing a tender whose API returns the minimal no-job PENDING response', async () => {
    api.getAnalysis.mockResolvedValue({
      data: {
        tenderId: tender.id,
        status: 'PENDING',
        analysisFingerprint: null,
        documents: [],
        review: null,
        reviewed: false,
        priceAnalysis: null,
      },
    })
    api.reanalyze.mockResolvedValue({ data: { ...analysis, status: 'PENDING' } })
    open()
    await flushPromises()
    await click('다시 분석')
    expect(api.reanalyze).toHaveBeenCalledWith(tender.id)
  })

  it('isolates out-of-order tender responses and ignores a response after closing', async () => {
    const old = deferred<{ data: TenderAnalysis }>()
    api.getAnalysis.mockReturnValueOnce(old.promise)
    open()
    await wrapper.setProps({ tender: { ...tender, id: 'second', title: '두 번째 공고' } })
    await flushPromises()
    old.resolve({ data: { ...analysis, specificationScore: 13 } })
    await flushPromises()
    expect(body()).not.toContain('13%')
    const next = deferred<{ data: TenderAnalysis }>()
    api.getAnalysis.mockReturnValueOnce(next.promise)
    await wrapper.setProps({ tender: { ...tender, id: 'third' } })
    await wrapper.setProps({ modelValue: false })
    next.resolve({ data: analysis })
    await flushPromises()
    expect(wrapper.emitted('analysis-updated')?.at(-1)?.[0]).not.toMatchObject({
      tenderId: 'third',
    })
  })
  it('sends reanalysis and review, emits list updates and preserves notes when a save fails', async () => {
    open()
    await flushPromises()
    const textarea = document.querySelector('textarea')!
    textarea.value = '원문 확인'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    api.saveReview.mockRejectedValueOnce(new Error('offline'))
    await click('검토 완료')
    expect(body()).toContain('저장하지 못했습니다')
    expect(textarea.value).toBe('원문 확인')
    api.saveReview.mockResolvedValue({ data: { ...analysis, reviewed: true } })
    await click('검토 완료')
    expect(api.saveReview).toHaveBeenLastCalledWith(tender.id, {
      completed: true,
      analysisFingerprint: analysis.analysisFingerprint,
      note: '원문 확인',
    })
    api.reanalyze.mockResolvedValue({ data: { ...analysis, status: 'PENDING' } })
    await click('다시 분석')
    expect(wrapper.emitted('analysis-updated')?.at(-1)?.[0]).toMatchObject({ status: 'PENDING' })
  })
  it('polls only active analysis with a bounded budget and stops on close', async () => {
    vi.useFakeTimers()
    api.getAnalysis.mockResolvedValue({ data: { ...analysis, status: 'PENDING' } })
    open()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(api.getAnalysis).toHaveBeenCalledTimes(2)
    await wrapper.setProps({ modelValue: false })
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.getAnalysis).toHaveBeenCalledTimes(2)
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(400000)
    await flushPromises()
    expect(api.getAnalysis.mock.calls.length).toBeLessThanOrEqual(33)
    expect(body()).toContain('자동 갱신')
  })
  it('renders bounded evidence as text and maintains modal keyboard focus', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    api.getAnalysis.mockResolvedValue({
      data: {
        ...analysis,
        evidence: [{ id: 'e', snippet: '<img src=x onerror=alert(1)>' + '가'.repeat(1000) }],
      },
    })
    open()
    await flushPromises()
    expect(document.querySelector('img')).toBeNull()
    expect(body()).not.toContain('가'.repeat(321))
    const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    buttons[buttons.length - 1]!.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(buttons[0])
    await wrapper.setProps({ modelValue: false })
    expect(document.activeElement).toBe(opener)
  })
})
