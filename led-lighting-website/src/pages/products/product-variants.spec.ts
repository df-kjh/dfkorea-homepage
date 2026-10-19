import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref, Suspense, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { Product } from '@/types'
import ProductPage from './[id].vue'
import ProductDetailTemplate from '@/components/products/detail/ProductDetailTemplate.vue'

const addProduct = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useQuoteDraft', () => ({ useQuoteDraft: () => ({ addProduct }) }))

const base: Product = {
  id: '',
  name: '',
  category: '원형직부',
  modelName: '',
  dimensions: '240*62',
  images: [],
  power: [15],
  colorTemp: [5700],
  lifespan: 40000,
  ledChipManufacturer: '서울반도체',
  certifications: ['KS', '고효율'],
  description: '',
  options: [],
  createdAt: '',
  updatedAt: '',
}
const general = {
  ...base,
  id: 'd4705d1d-7dab-4381-b83c-9c9026efa896',
  name: '원형직부',
  modelName: 'DF-CI-15',
  images: [{ image: '/uploads/general.webp', description: '일반형 사진' }],
}
const sensor = {
  ...base,
  id: 'bc46e6f3-2dd0-4c17-bf5b-0ee5b681b538',
  name: '원형센서',
  category: '원형센서',
  modelName: 'DF-CIS-15',
  options: ['발전기 비상', '밧데리 비상'],
  images: [{ image: '/uploads/sensor.webp', description: '센서형 사진' }],
}
const parking = {
  ...base,
  category: '주차장조명',
  dimensions: '1200*60*45',
  power: [40, 22, 18],
  colorTemp: [5700, 4000, 3000],
  options: ['개별디밍', '그룹디밍', '센서', '발전기 비상', '밧데리 비상'],
}
const alwaysOn = {
  ...parking,
  id: '492784ba-6318-4687-b877-9edde0b96b32',
  name: '주차장조명 상시',
  modelName: 'DF-REA-40',
  power: [40, 22, 18, 50],
  certifications: ['KS', '고효율', '친환경'],
  images: [{ image: '/uploads/always-on.webp', description: '상시형 사진' }],
}
const dimming = {
  ...parking,
  id: 'f6bfbddf-a3b8-4127-b352-6ba9c703e252',
  name: '주차장조명 디밍',
  modelName: 'DF-RES-40',
  images: [{ image: '/uploads/dimming.webp', description: '디밍형 사진' }],
}
const families = [
  {
    id: 'round-ceiling',
    name: '원형 조명',
    primaryProductId: general.id,
    variants: [
      { label: '일반형', product: general },
      { label: '센서형', product: sensor },
    ],
  },
  {
    id: 'parking-linear',
    name: '주차장 조명',
    primaryProductId: alwaysOn.id,
    variants: [
      { label: '상시형', product: alwaysOn },
      { label: '디밍형', product: dimming },
    ],
  },
]
const products = Object.fromEntries(
  families.flatMap((family) =>
    family.variants.map(({ product }) => [product.id, { ...product, variantGroup: family }]),
  ),
)
const route = reactive({ params: { id: general.id }, query: {} as Record<string, string> })
const push = vi.fn(({ query }: { query: Record<string, string> }) => {
  route.query = query
})
const replace = vi.fn(({ query }: { query: Record<string, string> }) => {
  route.query = query
})
const back = vi.fn()
const seo = vi.fn(),
  head = vi.fn()
let wrapper: ReturnType<typeof mount>

const NuxtLink = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        'a',
        {
          ...attrs,
          href: props.to,
          onClick: (event: MouseEvent) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            )
              return
            event.preventDefault()
            route.query = {}
            route.params.id = props.to.split('/').at(-1)!
          },
        },
        slots.default?.(),
      )
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params.id = general.id
  route.query = {}
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push, replace, back }))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBaseUrl: 'http://localhost:3000', siteUrl: 'https://dfkorealed.com' },
  }))
  // HTTP is the external boundary. Preserve Nuxt's reactive request behavior so
  // a nonreactive route request cannot pass a same-page SKU navigation test.
  vi.stubGlobal('useFetch', async (request: MaybeRefOrGetter<string>) => {
    const data = ref<Product>()
    watch(
      () => toValue(request),
      (url) => {
        data.value = products[url.split('/').at(-1)!]
      },
      { immediate: true },
    )
    return { data, error: ref(null) }
  })
  vi.stubGlobal('useSeoMeta', seo)
  vi.stubGlobal('useHead', head)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
const render = async (id = general.id) => {
  route.params.id = id
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(ProductPage) }) }),
    {
      attachTo: document.body,
      global: { stubs: { NuxtLink } },
    },
  )
  await flushPromises()
  return wrapper
}
const canonical = () => head.mock.calls.map(([value]) => value).find((value) => value.link)

describe('public product family detail', () => {
  it('keeps family choices and quote actions inert inside the admin preview', () => {
    wrapper = mount(ProductDetailTemplate, {
      props: { product: products[alwaysOn.id]!, preview: true },
    })
    expect(wrapper.get('nav[aria-label="제품 구성 선택"]').text()).toContain('상시형')
    expect(wrapper.find('a[href]').exists()).toBe(false)
    expect(
      wrapper
        .findAll('[data-quote]')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
    expect(wrapper.emitted('quote')).toBeUndefined()
  })
  it.each([
    { record: general, label: '일반형', family: '원형 조명' },
    { record: sensor, label: '센서형', family: '원형 조명' },
    { record: alwaysOn, label: '상시형', family: '주차장 조명' },
    { record: dimming, label: '디밍형', family: '주차장 조명' },
  ])(
    'keeps the old $label URL selected with its own specification and quote SKU',
    async ({ record, label, family }) => {
      const page = await render(record.id)
      const choices = page.get('nav[aria-label="제품 구성 선택"]')
      expect(choices.text()).toContain(family)
      expect(choices.get('[aria-current="page"]').text()).toContain(label)
      expect(choices.get('[aria-current="page"]').attributes('href')).toBe(`/products/${record.id}`)
      expect(page.get('h1').text()).toBe(record.name)
      expect(page.get('.detail-spec-table').text()).toContain(record.modelName)
      expect(page.get('.detail-hero-art').attributes('src')).toBe(
        `http://localhost:3000${record.images[0]!.image}`,
      )
      expect(canonical().link[0].href.value).toBe(`https://dfkorealed.com/products/${record.id}`)
      await page.get('[data-quote]').trigger('click')
      expect(addProduct).toHaveBeenCalledWith(products[record.id], expect.any(MouseEvent))
      expect(addProduct.mock.calls[0]?.[0].name).toBe(record.name)
      if (record === general) expect(page.text()).not.toMatch(/발전기 비상|밧데리 비상/)
      if (record === dimming) expect(page.text()).not.toMatch(/50W|친환경/)
    },
  )

  it('navigates within the detail page with current content, SEO and independent image history', async () => {
    const page = await render(alwaysOn.id)
    await page.get('[data-image]').trigger('click')
    expect(route.query.image).toBe('0')
    // Browser navigation dismisses the old image and carries no old image index.
    await page.get(`nav a[href="/products/${dimming.id}"]`).trigger('click')
    await flushPromises()
    expect(route.query).toEqual({})
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(page.get('h1').text()).toBe('주차장조명 디밍')
    expect(page.get('nav [aria-current="page"]').text()).toContain('디밍형')
    expect(page.get('.detail-spec-table').text()).toContain('DF-RES-40')
    expect(page.text()).not.toMatch(/50W|친환경/)
    expect(seo.mock.calls[0]?.[0].title()).toContain('주차장조명 디밍')
    expect(canonical().link[0].href.value).toBe(`https://dfkorealed.com/products/${dimming.id}`)
    const schema = JSON.parse(canonical().script[0].innerHTML.value)
    expect(schema.sku).toBe('DF-RES-40')
    expect(schema.url).toBe(`https://dfkorealed.com/products/${dimming.id}`)
    expect(schema.image).toEqual(['http://localhost:3000/uploads/dimming.webp'])
    await page.get('[data-quote]').trigger('click')
    expect(addProduct.mock.calls.at(-1)?.[0].id).toBe(dimming.id)
    // A direct image URL on the new SKU closes with replace, never back into the old SKU.
    route.query = { image: '0' }
    await flushPromises()
    ;(document.querySelector('[aria-label="이미지 상세보기 닫기"]') as HTMLButtonElement).click()
    expect(replace).toHaveBeenLastCalledWith({ query: {} })
    expect(back).not.toHaveBeenCalled()
  })
})
