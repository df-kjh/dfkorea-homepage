import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@/types'
import ProductCard from './ProductCard.vue'

const product: Product = {
  id: 'product-1',
  name: '주차장 LED 조명',
  category: 'outdoor',
  images: [{ image: '/images/product-1.jpg', description: '제품 이미지' }],
  modelName: 'DF-P1',
  dimensions: '100 x 100 mm',
  power: [40],
  lifespan: 50000,
  colorTemp: [5700],
  ledChipManufacturer: 'DF Korea',
  certifications: [],
  description: '제품 설명',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mountProductCard = (record: Product = product) => {
  const navigate = vi.fn()
  const NuxtLink = defineComponent({
    props: {
      to: { type: String, required: true },
      custom: Boolean,
    },
    setup(props, { attrs, slots }) {
      return () => {
        if (props.custom) return slots.default?.({ href: props.to, navigate })

        const { onClick, ...linkAttributes } = attrs
        return h(
          'a',
          {
            ...linkAttributes,
            href: props.to,
            onClick: (event: MouseEvent) => {
              navigate()
              if (typeof onClick === 'function') onClick(event)
              if (Array.isArray(onClick)) onClick.forEach((listener) => listener(event))
            },
          },
          slots.default?.(),
        )
      }
    },
  })

  return {
    wrapper: mount(ProductCard, {
      props: { product: record },
      global: { stubs: { NuxtLink } },
    }),
    navigate,
  }
}

describe('ProductCard', () => {
  it('keeps PIPE component length visible without placeholder electrical/certification claims', () => {
    const { wrapper } = mountProductCard({
      ...product,
      name: '연결 파이프',
      modelName: 'PIPE',
      dimensions: '1200,900',
      power: [1],
      colorTemp: [5700],
      certifications: ['KS'],
    })
    expect(wrapper.text()).toContain('1200')
    expect(wrapper.text()).not.toMatch(/1W|5700|KS/)
    wrapper.unmount()
  })
  it('renders a crawlable link to the product detail page', () => {
    const { wrapper } = mountProductCard()

    expect(wrapper.find('a[href="/products/product-1"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('emits the selected product when its link is clicked', async () => {
    const { navigate, wrapper } = mountProductCard()

    await wrapper.get('a[href="/products/product-1"]').trigger('click')

    expect(navigate).not.toHaveBeenCalled()
    expect(wrapper.emitted('click')).toEqual([[product]])
    wrapper.unmount()
  })
})

for (const modified of [
  { metaKey: true },
  { ctrlKey: true },
  { shiftKey: true },
  { altKey: true },
  { button: 1 },
]) {
  it(`preserves native modified link activation ${JSON.stringify(modified)}`, () => {
    const { wrapper } = mountProductCard()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...modified })
    wrapper.get('a[href="/products/product-1"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('click')).toBeUndefined()
    wrapper.unmount()
  })
}
