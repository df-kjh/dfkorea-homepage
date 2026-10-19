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
    expect(wrapper.find('[data-section="dimensions"] svg').exists()).toBe(true)
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

it('omits the automatic application note and keeps diagram attribution and structure captions', () => {
  const wrapper = render(true, {
    id: 'c2f1977b-3572-44c6-b6a7-d59a37b237f7',
    dimensions: '1200*58*60',
    images: [
      { image: 'https://example.com/one.webp', description: '' },
      { image: 'https://example.com/two.webp', description: '' },
      { image: 'https://example.com/three.webp', description: '' },
    ],
  })
  expect(wrapper.find('.detail-application-note').exists()).toBe(false)
  expect(wrapper.text()).toContain('실제 비율·설치 도면과 다릅니다.')
  expect(wrapper.text()).toContain('곧게 이어지는 선형 바디')
  expect(wrapper.text()).toContain('끝단에서 살펴보는 구조')
  expect(wrapper.text()).toContain('등록 규격을 확인해')
})

it('keeps story, one-photo structure, planning and original-image zoom in the common section order', async () => {
  const wrapper = render(false, { category: '새 분류', dimensions: '' })
  expect(
    wrapper.findAll('[data-section]').map((section) => section.attributes('data-section')),
  ).toEqual([
    'story',
    'structure',
    'application',
    'control',
    'description',
    'specifications',
    'inquiry',
  ])
  expect(wrapper.get('[data-section="story"] h2').text()).toBe('빛이 필요한 곳에,\n공간에 맞게.')
  expect(wrapper.get('[data-section="structure"] h2').text()).toBe(
    '가까이 볼수록,\n선명해지는 디테일.',
  )
  expect(wrapper.get('[data-section="structure"] [data-image] img').attributes('src')).toBe(
    'https://example.com/round.webp',
  )
  expect(wrapper.get('[data-section="application"]').text()).toContain('제품 원본 사진')
  await wrapper.get('.detail-thumbnails button').trigger('click')
  expect(wrapper.emitted('image-click')?.[0]).toEqual(['https://example.com/round.webp', 0])
})

import catalog from './__fixtures__/catalog.json'

it.each(catalog)('renders the reviewed section flow for $product.name', ({ product }) => {
  const wrapper = render(true, product as Product)
  const sections = wrapper
    .findAll('[data-section]')
    .map((section) => section.attributes('data-section'))
  expect(sections).toEqual([
    'story',
    'structure',
    'application',
    ...(product.modelName !== 'PIPE' && product.options.length ? ['control'] : []),
    'dimensions',
    'description',
    'specifications',
    'inquiry',
  ])
  expect(wrapper.get('[data-section="application"] img').attributes('src')).toMatch(
    /^\/images\/product-detail\//,
  )
  expect(wrapper.find('.detail-application-note').exists()).toBe(false)
  expect(wrapper.findAll('.detail-thumbnails button')).toHaveLength(product.images.length)
  if (product.images.length === 1)
    expect(wrapper.findAll('.detail-structure-grid--single [data-image]')).toHaveLength(1)
  if (product.id !== 'c2f1977b-3572-44c6-b6a7-d59a37b237f7') {
    expect(wrapper.get('.detail-hero').classes()).toContain('detail-hero--cover')
    expect(wrapper.find('.detail-hero-note').exists()).toBe(false)
    expect(wrapper.get('.detail-hero-art').attributes('alt')).toContain('AI 설치 연출 예시')
  }
  wrapper.unmount()
})

it('keeps accessible product identity in the slogan heading and the existing hero footer', () => {
  const wrapper = render(true)
  expect(wrapper.get('h1 .detail-visually-hidden').text()).toBe('원형 센서등')
  expect(wrapper.get('h1').text()).toContain('공간을 따라,\n빛을 잇다.')
  expect(wrapper.find('h1 .detail-model').exists()).toBe(false)
  expect(wrapper.get('.detail-hero-bottom').text()).toContain('원형 센서등')
  expect(wrapper.get('.detail-hero-bottom').text()).toContain('DF-ROUND')
  expect(wrapper.find('.detail-hero button:not([data-quote])').exists()).toBe(false)
})

it('preserves an explicit admin hero-image caption without generating a default note', () => {
  const wrapper = render(true, {
    detailContent: {
      version: 1,
      heroImage: {
        url: '/images/custom-hero.png',
        alt: '관리자가 지정한 사진',
        caption: '관리자가 직접 입력한 사진 설명',
      },
    },
  })
  expect(wrapper.get('.detail-hero-note').text()).toBe('관리자가 직접 입력한 사진 설명')
  expect(wrapper.get('.detail-hero-art').attributes('alt')).toBe('관리자가 지정한 사진')
  expect(wrapper.get('.detail-application-note').text()).toContain('제품 원본 사진')
})
