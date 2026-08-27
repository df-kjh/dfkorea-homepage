import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import BaseModal from './BaseModal.vue'

describe('BaseModal keyboard focus management', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses the first action, cycles Tab in both directions, and restores the trigger after Escape', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = '열기'
    document.body.append(trigger)
    trigger.focus()

    const wrapper = mount(BaseModal, {
      props: { modelValue: true, title: '접근성 테스트' },
      slots: { default: '<input data-test="first-field" /><button data-test="last-action">저장</button>' },
      attachTo: document.body,
    })
    await nextTick()

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="모달 닫기"]')
    const firstField = document.body.querySelector<HTMLInputElement>('[data-test="first-field"]')
    const lastAction = document.body.querySelector<HTMLButtonElement>('[data-test="last-action"]')
    if (!dialog || !close || !firstField || !lastAction) throw new Error('Expected modal focus controls')

    expect(document.activeElement).toBe(close)
    lastAction.focus()
    lastAction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(close)

    close.focus()
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(lastAction)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    await wrapper.setProps({ modelValue: false })
    expect(document.activeElement).toBe(trigger)
  })

  it('falls back to the dialog when no enabled focusable element exists', async () => {
    const wrapper = mount(BaseModal, {
      props: { modelValue: true, showCloseButton: false },
      slots: { default: '<button disabled>비활성</button>' },
      attachTo: document.body,
    })
    await nextTick()

    expect(document.activeElement).toBe(document.body.querySelector('[role="dialog"]'))
    wrapper.unmount()
  })
})
