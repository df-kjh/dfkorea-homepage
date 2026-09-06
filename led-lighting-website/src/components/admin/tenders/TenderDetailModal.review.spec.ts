import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import TenderDetailModal from './TenderDetailModal.vue'
import { analysis, tender } from './__fixtures__/analysis'

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
// Only the HTTP boundary is stubbed: exercise the actual modal and tenders API.
vi.mock('@/api/client', () => ({ default: transport }))
afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})
it('sends the displayed fingerprint and refreshes on 409 while preserving the note and conflict message', async () => {
  const displayed = { ...analysis, analysisFingerprint: 'a'.repeat(64) }
  const current = {
    ...analysis,
    analysisFingerprint: 'b'.repeat(64),
    specificationScore: 60,
    suitability: 'REVIEW',
  }
  transport.get.mockResolvedValueOnce({ data: displayed }).mockResolvedValueOnce({ data: current })
  transport.post
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({ data: { ...current, reviewed: true } })
  const wrapper = mount(TenderDetailModal, {
    props: { modelValue: true, tender },
    attachTo: document.body,
  })
  try {
    await flushPromises()
    const textarea = document.querySelector('textarea')!
    textarea.value = '작성 중인 메모'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    const review = () =>
      Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('검토 완료'),
      )!
    review().click()
    await flushPromises()
    expect(transport.post).toHaveBeenCalledWith(`/tenders/${tender.id}/review`, {
      completed: true,
      note: '작성 중인 메모',
      analysisFingerprint: displayed.analysisFingerprint,
    })
    expect(transport.get).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('analysis-updated')?.at(-1)?.[0]).toMatchObject({
      analysisFingerprint: current.analysisFingerprint,
    })
    expect(textarea.value).toBe('작성 중인 메모')
    expect(document.body.textContent).toContain('분석 결과가 변경되었습니다')
    review().click()
    await flushPromises()
    expect(transport.post).toHaveBeenLastCalledWith(`/tenders/${tender.id}/review`, {
      completed: true,
      note: '작성 중인 메모',
      analysisFingerprint: current.analysisFingerprint,
    })
  } finally {
    wrapper.unmount()
  }
})
