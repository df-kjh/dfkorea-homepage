import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Product } from '@/types'
const product: Product = {
  id: 'other',
  name: '원형 센서등',
  modelName: 'DF-ROUND',
  category: '센서등',
  images: [{ image: 'https://example.com/round.webp', description: '' }],
  dimensions: '지름 300',
  power: [20],
  colorTemp: [4000],
  lifespan: 40000,
  ledChipManufacturer: '',
  certifications: ['KS'],
  options: ['센서'],
  description: '## 기존 소개\n\n![기술 자료](https://example.com/diagram.webp)',
  createdAt: '',
  updatedAt: '',
}
import component from './ProductDetailTemplate.vue'
const render = (preview = false, changes: Partial<Product> = {}) =>
  mount(component, {
    props: { product: { ...product, ...changes }, preview },
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  })
describe('shared product detail renderer', () => {
  it('renders existing Markdown and technical images with the common design', () => {
    const wrapper = render()
    expect(wrapper.find('h1').exists()).toBe(true)
    expect(wrapper.find('.detail-markdown h2').exists()).toBe(true)
    expect(wrapper.find('.detail-markdown img').exists()).toBe(true)
    expect(wrapper.find('[data-section="dimensions"] svg').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('몰드바')
    expect(wrapper.find('nav.section-nav').exists()).toBe(false)
  })
  it('emits original quote click and registered image index for zoom', async () => {
    const wrapper = render()
    expect(wrapper.find('[data-quote]').exists()).toBe(true)
    if (!wrapper.find('[data-quote]').exists()) return
    await wrapper.get('[data-quote]').trigger('click')
    expect(wrapper.emitted('quote')?.[0]?.[0]).toBeInstanceOf(MouseEvent)
    await wrapper.get('[data-image]').trigger('click')
    expect(wrapper.emitted('image-click')?.[0]).toEqual(['https://example.com/round.webp', 0])
  })
  it('disables navigation, image and quote side effects in admin preview', async () => {
    const wrapper = render(true)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('[data-quote]').exists()).toBe(true)
    if (!wrapper.find('[data-quote]').exists()) return
    expect(wrapper.get('[data-quote]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-quote]').trigger('click')
    expect(wrapper.emitted('quote')).toBeUndefined()
    expect(wrapper.get('[data-image]').attributes('disabled')).toBeDefined()
  })
  it('renders editable fields as text and hides opted out sections', () => {
    const wrapper = render(true, {
      detailContent: {
        version: 1,
        heroTitle: '<img src=x onerror=alert(1)>제목',
        showControl: false,
        showDimensions: false,
      },
    })
    expect(wrapper.find('h1').exists()).toBe(true)
    if (!wrapper.find('h1').exists()) return
    expect(wrapper.find('h1 img').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toContain('<img')
    expect(wrapper.find('[data-section="control"]').exists()).toBe(false)
    expect(wrapper.find('[data-section="dimensions"]').exists()).toBe(false)
  })
})

it('keeps the approved application and diagram attribution and structure captions', () => {
  const wrapper = render(true, {
    id: 'c2f1977b-3572-44c6-b6a7-d59a37b237f7',
    dimensions: '1200*58*60',
    images: [
      { image: 'https://example.com/one.webp', description: '' },
      { image: 'https://example.com/two.webp', description: '' },
      { image: 'https://example.com/three.webp', description: '' },
    ],
  })
  expect(wrapper.text()).toContain('AI로 제작한 적용 공간 예시입니다.')
  expect(wrapper.text()).toContain('실제 비율·설치 도면과 다릅니다.')
  expect(wrapper.text()).toContain('곧게 이어지는 선형 바디')
  expect(wrapper.text()).toContain('끝단에서 살펴보는 구조')
  expect(wrapper.text()).toContain('길이와 폭, 높이를 확인해')
})
