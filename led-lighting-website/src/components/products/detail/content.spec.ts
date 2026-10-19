import { describe, expect, it } from 'vitest'
import type { Product, ProductDetailContent } from '@/types'

import { resolveProductDetail as resolve, safeDetailImage } from './content'
const safeImage = (url: string) => safeDetailImage({ url, alt: '사진' })
export const sampleProduct = (changes: Partial<Product> = {}): Product => ({
  id: 'other-product',
  name: '원형 센서등',
  category: '센서등',
  modelName: 'DF-ROUND',
  images: [{ image: 'https://example.com/round.webp', description: '원형 제품 실물' }],
  dimensions: '지름 300',
  power: [20],
  colorTemp: [4000],
  lifespan: 40000,
  ledChipManufacturer: '서울반도체',
  certifications: ['KS'],
  options: ['센서'],
  description: '## 기존 소개\n\n![기술 자료](https://example.com/diagram.webp)',
  createdAt: '',
  updatedAt: '',
  ...changes,
})

describe('product detail content defaults', () => {
  it('uses the first prose sentence for the hero without legacy headings, photos or tables', () => {
    const content = resolve(
      sampleProduct({
        description:
          '## 상시 점등 구역을 위한 주차장조명\n\n![제품](https://example.com/photo.webp)\n\n| 전력 | 값 |\n| --- | --- |\n| 50W | 선택 |\n\n- 먼저 확인할 옵션\n\n상시 점등 구역을 살펴보세요. 네 가지 소비전력 중 필요한 사양을 선택할 수 있습니다.\n\n### 기본 사양',
      }),
    )
    expect(content.heroDescription).toBe('상시 점등 구역을 살펴보세요.')
  })
  it('bounds long hero prose at a word boundary with an explicit ellipsis', () => {
    const content = resolve(
      sampleProduct({
        description: `## 제품 소개\n\n${'설치할 공간의 조건과 필요한 조명 수량을 함께 확인하고 '.repeat(10)}상담을 요청하세요.`,
      }),
    )
    expect(content.heroDescription.length).toBeLessThanOrEqual(150)
    expect(content.heroDescription).toMatch(
      /(?:설치할|공간의|조건과|필요한|조명|수량을|함께|확인하고)…$/,
    )
    expect(content.heroDescription).not.toContain('제품 소개')
    expect(
      resolve(
        sampleProduct({
          description: '## 소개\n\n![기술 이미지](https://example.com/diagram.webp)',
        }),
      ).heroDescription,
    ).toBe('')
  })
  it('uses actual fields automatically and never gives another product the moldbar preset', () => {
    const content = resolve(sampleProduct())
    expect(content?.heroTitle).toBe('공간을 따라,\n빛을 잇다.')
    expect(content?.heroImage?.url).toBe('https://example.com/round.webp')
    expect(content?.summary).toContainEqual(expect.objectContaining({ value: '20W' }))
    expect(content?.application?.image?.url).toBe('https://example.com/round.webp')
  })
  it('limits moldbar assets to the exact ID and uses registered specifications', () => {
    const content = resolve(
      sampleProduct({
        id: 'c2f1977b-3572-44c6-b6a7-d59a37b237f7',
        dimensions: '900*48*50',
        power: [25],
      }),
    )
    expect(content?.heroTitle).toBe('공간을 따라,\n빛을 잇다.')
    expect(content?.heroImage?.url).toContain('moldbar-studio')
    expect(JSON.stringify(content?.features)).not.toContain('1,200')
    expect(content?.summary).toContainEqual(expect.objectContaining({ value: '25W' }))
  })
  it('keeps missing data and PIPE electrical placeholders out of the detail', () => {
    const content = resolve(
      sampleProduct({
        modelName: 'PIPE',
        dimensions: '1200',
        options: ['센서'],
        images: [],
        power: [40],
        colorTemp: [5700],
      }),
    )
    expect(content?.summary).toEqual([{ label: '길이 규격', value: '1200 mm', icon: 'straighten' }])
    expect(content?.controls).toEqual([])
    expect(content?.heroImage).toBeUndefined()
    expect(content?.technicalSpecs?.some((entry: { value: string }) => entry.value === '40W')).toBe(
      false,
    )
  })
  it('applies optional content without accepting invalid images', () => {
    const product = sampleProduct({
      detailContent: {
        version: 1,
        heroTitle: '<b>직접 제목</b>',
        heroImage: { url: 'javascript:alert(1)', alt: '잘못된 사진' },
        storyTitle: '소개',
        features: [{ title: '선택 안내', body: '원문' }],
        showControl: false,
        showDimensions: false,
      },
    })
    const content = resolve(product)
    expect(content?.heroTitle).toBe('<b>직접 제목</b>')
    expect(content?.heroImage?.url).toBe(product.images[0]?.image)
    expect(content?.features).toEqual([{ title: '선택 안내', body: '원문' }])
    expect(content?.showControl).toBe(false)
    expect(content?.showDimensions).toBe(false)
  })
  it('drops wrong versions, caps arrays, and does not mutate the record', () => {
    const product = sampleProduct({
      detailContent: { version: 99, heroTitle: '무시' } as unknown as ProductDetailContent,
    })
    const before = JSON.stringify(product)
    expect(resolve(product)?.heroTitle).toBe('공간을 따라,\n빛을 잇다.')
    expect(JSON.stringify(product)).toBe(before)
    product.detailContent = {
      version: 1,
      features: Array.from({ length: 8 }, () => ({ title: '제목', body: '본문' })),
    }
    expect(resolve(product)?.features).toHaveLength(6)
  })
})
describe('detail image URL boundary', () => {
  it.each([
    'https://example.com/image.webp',
    'http://localhost:3000/uploads/a.webp',
    '/images/example.webp',
  ])('accepts %s', (url) => {
    expect(safeImage(url)).toEqual({ url, alt: '사진' })
  })
  it.each([
    '//evil.com/image',
    '/\\evil.com/image',
    'javascript:alert(1)',
    'data:image/png;base64,xxx',
    'https://example.com/\\image',
    'https://example.com/a\nb',
    'relative.webp',
    'https://',
    '/a b',
  ])('drops %s', (url) => {
    expect(safeImage(url)).toBeUndefined()
  })
})

import catalog from './__fixtures__/catalog.json'

const applicationImages: Record<string, string> = {
  moldbar: '/images/product-detail/moldbar/moldbar-application.png',
  'pipe-pendant': '/images/product-detail/applications/pipe-pendant-v2.png',
  classroom: '/images/product-detail/applications/classroom-v2.png',
  street: '/images/product-detail/applications/street-v2.png',
  'moisture-proof': '/images/product-detail/applications/moisture-proof-v1.png',
  'cob-retail': '/images/product-detail/applications/cob-retail-v1.png',
  'round-ceiling': '/images/product-detail/applications/round-ceiling-v1.png',
  downlight: '/images/product-detail/applications/downlight-v1.png',
  'stair-sign': '/images/product-detail/applications/stair-sign-v1.png',
  'parking-guidance': '/images/product-detail/applications/parking-guidance-v2.png',
  'wall-light': '/images/product-detail/applications/wall-light-v2.png',
  cleanroom: '/images/product-detail/applications/cleanroom-v2.png',
  'parking-linear': '/images/product-detail/applications/parking-linear-v1.png',
  'panel-square': '/images/product-detail/applications/panel-square-v1.png',
  'panel-linear': '/images/product-detail/applications/panel-linear-v1.png',
}

describe('consistent catalog detail defaults', () => {
  it.each(catalog)(
    'gives $product.name its own photos and mapped installation scene',
    ({ product, applicationKey }) => {
      const detail = resolve(product as Product)
      expect(detail.heroTitle).toBe('공간을 따라,\n빛을 잇다.')
      expect(detail.heroCaption).toBeUndefined()
      expect(detail.storyTitle).toBe(
        product.id === 'c2f1977b-3572-44c6-b6a7-d59a37b237f7'
          ? '빛이 필요한 곳에,\n길을 따라.'
          : '빛이 필요한 곳에,\n공간에 맞게.',
      )
      expect(detail.structureTitle).toBe('가까이 볼수록,\n선명해지는 디테일.')
      expect(detail.controlTitle).toBe('필요한 곳을,\n원하는 방식으로.')
      expect(detail.dimensionsTitle).toBe('설치 전,\n공간의 치수부터.')
      expect(detail.storyImage?.url).toBe(product.images[0]?.image)
      expect(detail.structureImages.length).toBeGreaterThan(0)
      for (const image of detail.structureImages) {
        expect(product.images.map((entry) => entry.image)).toContain(image.url)
      }
      for (const image of product.images)
        expect(detail.gallery.some((entry) => entry.url === image.image)).toBe(true)
      expect(detail.application?.title).toBe('공간에 맞춰,\n빛의 흐름을 계획합니다.')
      expect(detail.application?.caption).toBeUndefined()
      expect(detail.application?.image?.url).toBe(applicationImages[applicationKey])
      if (applicationKey !== 'moldbar') {
        expect(detail.heroImage?.url).toBe(detail.application?.image?.url)
        expect(detail.heroDescription).toContain(product.name)
        expect(JSON.stringify(detail.features)).not.toContain('몰드바')
      }
    },
  )

  it('keeps every explicit v1 editorial field ahead of common defaults and restores defaults on null', () => {
    const custom: ProductDetailContent = {
      version: 1,
      heroTitle: '관리자 히어로',
      heroDescription: '관리자 설명',
      heroImage: { url: '/images/custom-hero.png', alt: '직접 지정한 히어로' },
      storyTitle: '관리자 소개',
      storyImage: { url: '/images/custom-story.png', alt: '소개 사진' },
      features: [],
      structureTitle: '관리자 구조',
      structureImages: [],
      application: {
        title: '관리자 적용',
        description: '직접 입력한 적용 설명',
        image: { url: '/images/custom-application.png', alt: '관리자 적용 사진' },
        caption: '실제 사진에 대한 관리자 설명',
      },
      controlTitle: '관리자 제어',
      showControl: false,
      dimensionsTitle: '관리자 규격',
      showDimensions: false,
      dimensionImage: { url: '/images/custom-dimensions.png', alt: '규격 사진' },
    }
    const product = sampleProduct({ detailContent: custom })
    const before = JSON.stringify(product)
    expect(resolve(product)).toMatchObject(custom)
    expect(JSON.stringify(product)).toBe(before)
    expect(resolve({ ...product, detailContent: null }).heroTitle).toBe('공간을 따라,\n빛을 잇다.')
    expect(resolve({ ...product, detailContent: null }).structureImages).toHaveLength(1)
  })

  it('keeps an unclassified new product’s original photo in a neutral planning section', () => {
    const product = sampleProduct({
      category: '새 분류',
      name: '새로운 조명',
      modelName: 'NEW-1',
      dimensions: '',
    })
    const detail = resolve(product)
    expect(detail.application?.image?.url).toBe(product.images[0]?.image)
    expect(detail.application?.caption).toContain('제품 원본 사진')
    expect(detail.application?.caption).not.toContain('AI')
    expect(detail.application?.description).toContain('설치 조건')
    expect(detail.structureImages[0]?.url).toBe(product.images[0]?.image)
  })
})

it.each([
  ['598*598*22', 'DF-FP-1200', 'panel-square'],
  ['1280X640X22', 'DF-SQUARE', 'panel-linear'],
  ['640x180x22', 'DF-FP-3030', 'panel-linear'],
])(
  'classifies future flat panels by registered face dimensions %s, independent of model name',
  (dimensions, modelName, key) => {
    const detail = resolve(
      sampleProduct({ id: 'future-panel', category: '엣지평판', dimensions, modelName }),
    )
    expect(detail.application?.image?.url).toBe(`/images/product-detail/applications/${key}-v1.png`)
  },
)

it('does not guess an installation type from ambiguous panel dimensions', () => {
  const detail = resolve(
    sampleProduct({
      category: '엣지평판',
      dimensions: '600*600*22,1200*300*22',
      modelName: 'DF-FP-3030',
    }),
  )
  expect(detail.application?.image?.url).toBe('https://example.com/round.webp')
})
