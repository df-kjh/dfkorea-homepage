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

const mountProductCard = () => {
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
      props: { product },
      global: { stubs: { NuxtLink } },
    }),
    navigate,
  }
}

describe('ProductCard', () => {
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
