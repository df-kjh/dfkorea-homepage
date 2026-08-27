import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import TenderSubscriptionModal from './TenderSubscriptionModal.vue'

describe('TenderSubscriptionModal', () => {
  const subscription = {
    enabled: true,
    deliveryTime: '09:00',
    recipients: ['sales@dfkorea.co.kr'],
  }

  const modalElement = <T extends Element>(selector: string): T => {
    const element = document.body.querySelector<T>(selector)
    if (!element) throw new Error(`Expected modal element ${selector}`)
    return element
  }

  const setInput = async (selector: string, value: string) => {
    const input = modalElement<HTMLInputElement>(selector)
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }

  const click = async (selector: string) => {
    modalElement<HTMLButtonElement>(selector).click()
    await nextTick()
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('normalizes recipients and emits the shared settings payload only', async () => {
    const wrapper = mount(TenderSubscriptionModal, {
      props: { modelValue: true, subscription },
      attachTo: document.body,
    })

    await setInput('[data-test="recipient-email"]', ' BID@DFKOREA.CO.KR ')
    await click('[data-test="add-recipient"]')
    await setInput('[data-test="delivery-time"]', '14:30')
    await click('[data-test="save-subscription"]')

    expect(wrapper.emitted('save')).toEqual([
      [
        {
          enabled: true,
          deliveryTime: '14:30',
          recipients: ['sales@dfkorea.co.kr', 'bid@dfkorea.co.kr'],
        },
      ],
    ])
  })

  it('rejects duplicate and invalid email addresses without adding them', async () => {
    const wrapper = mount(TenderSubscriptionModal, {
      props: { modelValue: true, subscription },
      attachTo: document.body,
    })

    await setInput('[data-test="recipient-email"]', 'sales@dfkorea.co.kr')
    await click('[data-test="add-recipient"]')
    expect(modalElement('[data-test="recipient-error"]').textContent).toContain('이미 등록된 이메일')

    await setInput('[data-test="recipient-email"]', 'not-an-email')
    await click('[data-test="add-recipient"]')
    expect(modalElement('[data-test="recipient-error"]').textContent).toContain('올바른 이메일')
    expect(document.body.querySelectorAll('[data-test="recipient-chip"]')).toHaveLength(1)
  })

  it('caps recipient addresses at twenty and rejects an invalid shared delivery time', async () => {
    const recipients = Array.from({ length: 20 }, (_, index) => `sales-${index}@dfkorea.co.kr`)
    const wrapper = mount(TenderSubscriptionModal, {
      props: { modelValue: true, subscription: { enabled: true, deliveryTime: '09:00', recipients } },
      attachTo: document.body,
    })

    await setInput('[data-test="recipient-email"]', 'more@dfkorea.co.kr')
    await click('[data-test="add-recipient"]')
    expect(modalElement('[data-test="recipient-error"]').textContent).toContain('최대 20개')

    await setInput('[data-test="delivery-time"]', '')
    await click('[data-test="save-subscription"]')
    expect(document.body.textContent).toContain('HH:mm 형식')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('keeps the settings dialog accessible and leaves calendar filters out of the form', () => {
    const wrapper = mount(TenderSubscriptionModal, {
      props: { modelValue: true, subscription },
      attachTo: document.body,
    })

    expect(modalElement('[role="dialog"]').getAttribute('aria-modal')).toBe('true')
    expect(document.body.textContent).toContain('캘린더 필터와 무관하게 모든 신규 관련 공고가 발송됩니다.')
    expect(document.body.querySelector('[data-test="filter-keyword"]')).toBeNull()
    expect(document.body.querySelector('[data-test="subscription-source"]')).toBeNull()
  })
})
