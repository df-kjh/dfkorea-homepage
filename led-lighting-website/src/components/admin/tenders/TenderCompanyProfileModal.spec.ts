import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import Modal from './TenderCompanyProfileModal.vue'
import { profile, deferred } from './__fixtures__/analysis'
import type { TenderCompanyProfile } from '@/types'
const api = vi.hoisted(() => ({ getCompanyProfile: vi.fn(), replaceCompanyProfile: vi.fn() }))
vi.mock('@/api/tenders', () => ({ tendersAPI: api }))
let wrapper: VueWrapper
const open = () =>
  (wrapper = mount(Modal, { props: { modelValue: true }, attachTo: document.body }))
const input = async (selector: string, value: string) => {
  const el = document.querySelector<HTMLInputElement>(selector)!
  expect(el).toBeTruthy()
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
const click = async (selector: string) => {
  const el = document.querySelector<HTMLButtonElement>(selector)!
  expect(el).toBeTruthy()
  el.click()
  await flushPromises()
}
const save = async () => {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
}
beforeEach(() => {
  api.getCompanyProfile.mockReset().mockResolvedValue({ data: structuredClone(profile) })
  api.replaceCompanyProfile.mockReset().mockResolvedValue({ data: { ...profile, version: 2 } })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
describe('TenderCompanyProfileModal', () => {
  it('presents profile setup as optional and keeps advanced qualifications collapsed by default', async () => {
    api.getCompanyProfile.mockResolvedValueOnce({ data: null })
    open()
    await flushPromises()

    expect(document.body.textContent).toContain('선택 사항')
    expect(document.body.textContent).toContain(
      '등록하지 않아도 사양과 가격 분석을 이용할 수 있습니다',
    )
    const toggle = document.querySelector<HTMLButtonElement>('[data-test="toggle-profile-details"]')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-test="add-licenses"]')).toBeNull()
    expect(document.querySelector('[data-test="add-supplyProducts"]')).toBeNull()

    toggle?.click()
    await flushPromises()
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-test="add-licenses"]')).toBeTruthy()
    expect(document.querySelector('[data-test="add-performance"]')).toBeTruthy()
    expect(document.querySelector('[data-test="add-supplyProducts"]')).toBeNull()
  })

  it('preserves legacy supply products when saving without exposing a new input control', async () => {
    const legacySupplyProducts = [{ code: '39112102', name: 'LED 보안등기구', expiresAt: null }]
    api.getCompanyProfile.mockResolvedValueOnce({
      data: { ...structuredClone(profile), supplyProducts: legacySupplyProducts },
    })
    open()
    await flushPromises()

    expect(document.querySelector('[data-test="add-supplyProducts"]')).toBeNull()
    await save()
    expect(api.replaceCompanyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ supplyProducts: legacySupplyProducts }),
    )
  })

  it('edits repeated qualification rows locally, validates expiry/duplicates, and PUTs the complete profile', async () => {
    open()
    await flushPromises()
    expect(document.body.textContent).toContain('회사 자격 설정')
    await click('[data-test="toggle-profile-details"]')
    for (const group of ['licenses', 'companyTypes', 'directProduction', 'certifications'])
      expect(document.querySelector(`[data-test="add-${group}"]`)).toBeTruthy()
    await click('[data-test="add-licenses"]')
    await input('[data-test="licenses-0-code"]', 'led')
    await input('[data-test="licenses-0-name"]', '전기 면허')
    await input('[data-test="licenses-0-expiry"]', '2000-01-01')
    await save()
    expect(document.body.textContent).toContain('만료')
    expect(api.replaceCompanyProfile).not.toHaveBeenCalled()
    await input('[data-test="licenses-0-expiry"]', '2099-01-01')
    await click('[data-test="add-licenses"]')
    await input('[data-test="licenses-1-code"]', ' LED ')
    await input('[data-test="licenses-1-name"]', '다른 면허')
    await save()
    expect(document.body.textContent).toContain('중복')
    expect(api.replaceCompanyProfile).not.toHaveBeenCalled()
    await click('[data-test="remove-licenses-1"]')
    await save()
    const full = Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'version'))
    expect(api.replaceCompanyProfile).toHaveBeenCalledWith({
      ...full,
      licenses: [{ code: 'LED', name: '전기 면허', expiresAt: '2099-01-01' }],
    })
    expect(profile.licenses).toEqual([])
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ version: 2 })
  })
  it('requires explicit expiry choice, validates duplicate names, and preserves draft on failed PUT', async () => {
    open()
    await flushPromises()
    await click('[data-test="toggle-profile-details"]')
    await click('[data-test="add-certifications"]')
    await input('[data-test="certifications-0-code"]', 'kc')
    await input('[data-test="certifications-0-name"]', 'KC 인증')
    await save()
    expect(document.body.textContent).toContain('유효기간')
    expect(api.replaceCompanyProfile).not.toHaveBeenCalled()
    await click('[data-test="certifications-0-no-expiry"]')
    await click('[data-test="add-certifications"]')
    await input('[data-test="certifications-1-code"]', 'other')
    await input('[data-test="certifications-1-name"]', 'KC 인증')
    await click('[data-test="certifications-1-no-expiry"]')
    await save()
    expect(document.body.textContent).toContain('중복')
    await click('[data-test="remove-certifications-1"]')
    api.replaceCompanyProfile.mockRejectedValue(new Error('offline'))
    await save()
    expect(document.body.textContent).toContain('저장하지 못했습니다')
    expect(
      document.querySelector<HTMLInputElement>('[data-test="certifications-0-name"]')?.value,
    ).toBe('KC 인증')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('validates delivery period and decimal amounts without losing precision', async () => {
    open()
    await flushPromises()
    await click('[data-test="toggle-profile-details"]')
    await click('[data-test="add-performance"]')
    await input('[data-test="performance-0-name"]', 'LED 납품')
    await input('[data-test="performance-0-from"]', '2026-01-01')
    await input('[data-test="performance-0-to"]', '2025-01-01')
    await input('[data-test="performance-0-amount"]', '9007199254740993123.50')
    await save()
    expect(document.body.textContent).toContain('실적 기간')
    expect(api.replaceCompanyProfile).not.toHaveBeenCalled()
    await input('[data-test="performance-0-to"]', '2026-08-01')
    await save()
    expect(api.replaceCompanyProfile.mock.calls[0]?.[0].performanceRecords[0].amount).toBe(
      '9007199254740993123.50',
    )
  })
  it('isolates old GET and PUT completions after close/reopen and disables save during load', async () => {
    const old = deferred<{ data: TenderCompanyProfile }>()
    api.getCompanyProfile.mockReturnValueOnce(old.promise)
    open()
    expect(document.querySelector<HTMLButtonElement>('[data-test="save-profile"]')?.disabled).toBe(
      true,
    )
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    old.resolve({ data: { ...profile, companyName: 'STALE GET' } })
    await flushPromises()
    expect(document.querySelector<HTMLInputElement>('[data-test="profile-company"]')?.value).toBe(
      profile.companyName,
    )
    const saving = deferred<{ data: TenderCompanyProfile }>()
    api.replaceCompanyProfile.mockReturnValueOnce(saving.promise)
    await save()
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    await input('[data-test="profile-company"]', '새 초안')
    saving.resolve({ data: { ...profile, companyName: 'STALE PUT' } })
    await flushPromises()
    expect(document.querySelector<HTMLInputElement>('[data-test="profile-company"]')?.value).toBe(
      '새 초안',
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('allows creating a missing profile but preserves load errors until retried', async () => {
    api.getCompanyProfile.mockRejectedValueOnce(new Error('network'))
    open()
    await flushPromises()
    expect(document.body.textContent).toContain('불러오지 못했습니다')
    expect(document.querySelector<HTMLButtonElement>('[data-test="save-profile"]')?.disabled).toBe(
      true,
    )
    api.getCompanyProfile.mockResolvedValueOnce({ data: null })
    await click('[data-test="retry-profile"]')
    expect(document.body.textContent).toContain(
      '등록하지 않아도 사양과 가격 분석을 이용할 수 있습니다',
    )
  })
})
