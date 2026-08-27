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

  it('keeps only the top modal interactive and preserves scroll lock until the modal stack empties', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = '첫 모달 열기'
    document.body.append(trigger)
    trigger.focus()

    const first = mount(BaseModal, {
      props: { modelValue: true, title: '첫 모달' },
      slots: { default: '<button data-test="first-last">첫 모달 저장</button>' },
      attachTo: document.body,
    })
    await nextTick()
    const firstDialog = document.body.querySelectorAll<HTMLElement>('[role="dialog"]')[0]
    const firstClose = firstDialog?.querySelector<HTMLButtonElement>('[aria-label="모달 닫기"]')
    const firstLast = firstDialog?.querySelector<HTMLButtonElement>('[data-test="first-last"]')
    if (!firstDialog || !firstClose || !firstLast) throw new Error('Expected first modal controls')

    const second = mount(BaseModal, {
      props: { modelValue: true, title: '두 번째 모달' },
      slots: { default: '<button data-test="second-last">두 번째 모달 저장</button>' },
      attachTo: document.body,
    })
    await nextTick()
    const secondDialog = document.body.querySelectorAll<HTMLElement>('[role="dialog"]')[1]
    const secondClose = secondDialog?.querySelector<HTMLButtonElement>('[aria-label="모달 닫기"]')
    const secondLast = secondDialog?.querySelector<HTMLButtonElement>('[data-test="second-last"]')
    if (!secondDialog || !secondClose || !secondLast) throw new Error('Expected second modal controls')

    expect(document.body.style.overflow).toBe('hidden')
    firstLast.focus()
    firstLast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(firstLast)
    secondLast.focus()
    secondLast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(secondClose)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(second.emitted('update:modelValue')).toEqual([[false]])
    expect(first.emitted('update:modelValue')).toBeUndefined()
    await second.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(firstClose)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(first.emitted('update:modelValue')).toEqual([[false]])
    await first.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)

    first.unmount()
    second.unmount()
  })

  it('does not unlock or steal focus when a non-top modal closes programmatically', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = '열기'
    document.body.append(trigger)
    trigger.focus()

    const first = mount(BaseModal, { props: { modelValue: true, title: '첫 모달' }, attachTo: document.body })
    await nextTick()
    const second = mount(BaseModal, { props: { modelValue: true, title: '두 번째 모달' }, attachTo: document.body })
    await nextTick()
    const secondDialog = document.body.querySelectorAll<HTMLElement>('[role="dialog"]')[1]
    const secondClose = secondDialog?.querySelector<HTMLButtonElement>('[aria-label="모달 닫기"]')
    if (!secondClose) throw new Error('Expected top modal close control')
    secondClose.focus()

    await first.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(secondClose)

    await second.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)

    first.unmount()
    second.unmount()
  })
})
