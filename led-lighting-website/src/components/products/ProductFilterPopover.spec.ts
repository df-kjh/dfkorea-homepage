import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ProductFilterPopover from './ProductFilterPopover.vue'

const empty = () => ({ power: [], colorTemp: [], certifications: [], options: [] })
const options = {
  categories: ['주차장 조명'],
  power: [20, 40],
  colorTemp: [4000, 5700],
  certifications: ['KS', '고효율'],
  options: ['센서'],
}

afterEach(() => document.body.replaceChildren())

describe('product filter popover', () => {
  it('keeps checkbox changes in a draft until the user applies them', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: empty(), options },
    })

    const trigger = wrapper.get('button[aria-label="제품 필터 열기"]')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('제품 필터')

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('apply')).toBeUndefined()

    await wrapper.get('button[data-test="apply-product-filters"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([
      [{ power: [20], colorTemp: [], certifications: [], options: [] }],
    ])
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('discards unapplied changes on Escape and restores focus to the trigger', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: {
        modelValue: { ...empty(), certifications: ['KS'] },
        options,
      },
    })

    const trigger = wrapper.get('button[aria-label="제품 필터 열기"]')
    await trigger.trigger('click')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes
      .find((node) => node.element.parentElement?.textContent?.includes('고효율'))!
      .setValue(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    const reopened = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(
      reopened.find((node) => node.element.parentElement?.textContent?.includes('KS'))?.element
        .checked,
    ).toBe(true)
    expect(
      reopened.find((node) => node.element.parentElement?.textContent?.includes('고효율'))?.element
        .checked,
    ).toBe(false)
  })

  it('closes on an outside press without applying the draft', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: empty(), options },
    })
    await wrapper.get('button[aria-label="제품 필터 열기"]').trigger('click')
    await wrapper.get('input[type="checkbox"]').setValue(true)

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('clears the draft and waits for apply before changing the product filters', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: { ...empty(), power: [40] }, options },
    })
    await wrapper.get('button[aria-label="제품 필터 열기"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((node) => node.text() === '초기화')!
      .trigger('click')

    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)

    await wrapper.get('button[data-test="apply-product-filters"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([
      [{ power: [], colorTemp: [], certifications: [], options: [] }],
    ])
  })
})
