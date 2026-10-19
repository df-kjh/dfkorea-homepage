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
    expect(content?.heroTitle).toBe('원형 센서등')
    expect(content?.heroImage?.url).toBe('https://example.com/round.webp')
    expect(content?.summary).toContainEqual(expect.objectContaining({ value: '20W' }))
    expect(content?.application).toBeUndefined()
    expect(content?.linearDimensions).toBeNull()
  })
  it('limits preset to the exact ID and derives dimensions from registered fields', () => {
    const content = resolve(
      sampleProduct({
        id: 'c2f1977b-3572-44c6-b6a7-d59a37b237f7',
        dimensions: '900*48*50',
        power: [25],
      }),
    )
    expect(content?.heroTitle).toBe('공간을 따라,\n빛을 잇다.')
    expect(content?.heroImage?.url).toContain('moldbar-studio')
    expect(content?.linearDimensions).toEqual(['900', '48', '50'])
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
    expect(content?.linearDimensions).toBeNull()
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
    expect(resolve(product)?.heroTitle).toBe(product.name)
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
