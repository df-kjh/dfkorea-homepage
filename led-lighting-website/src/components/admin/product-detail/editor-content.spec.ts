import { describe, expect, it } from 'vitest'
import type { ProductDetailContent } from '@/types'
import {
  cloneDetailContent,
  detailImageUrls,
  prepareDetailContent,
  validateDetailContent,
} from './editor-content'

const unsafe = (value: unknown) => value as ProductDetailContent

describe('detail editor contract boundary', () => {
  it.each([
    { heroTitle: null },
    { heroDescription: 42 },
    { showControl: null },
    { showDimensions: 'false' },
    { heroImage: null },
    { storyImage: [] },
    { dimensionImage: 42 },
    { features: null },
    { structureImages: null },
    { application: null },
    { heroImage: { url: '/image.webp', alt: null } },
    { heroImage: { url: '/image.webp', alt: '사진', caption: null } },
    { features: [{ title: null, body: '내용' }] },
    { application: { title: '적용', image: null } },
    { version: 2 },
  ])('rejects malformed nested or scalar values %j', (fields) => {
    expect(validateDetailContent(unsafe({ version: 1, ...fields })).length).toBeGreaterThan(0)
  })

  it.each([
    { heroTitle: '가'.repeat(161) },
    { heroDescription: '가'.repeat(2001) },
    { storyImage: { url: '/image.webp', alt: '가'.repeat(301) } },
    { dimensionImage: { url: '/image.webp', alt: '도식', caption: '가'.repeat(501) } },
    { structureImages: Array.from({ length: 7 }, () => ({ url: '/a.webp', alt: '사진' })) },
    { features: Array.from({ length: 7 }, () => ({ title: '제목', body: '설명' })) },
  ])('rejects values beyond contract limits %j', (fields) => {
    expect(validateDetailContent(unsafe({ version: 1, ...fields })).length).toBeGreaterThan(0)
  })

  it('preserves valid maximum lengths, empty overrides and explicit false without duplicating product specifications', () => {
    const value = unsafe({
      version: 1,
      heroTitle: '가'.repeat(160),
      heroDescription: '가'.repeat(2000),
      heroImage: {
        url: 'https://example.com/image.webp',
        alt: '가'.repeat(300),
        caption: '가'.repeat(500),
      },
      features: [],
      structureImages: [],
      showControl: false,
      showDimensions: false,
      power: [30],
      dimensions: 'must never be copied',
      unknownField: 'not in contract',
    })
    const prepared = prepareDetailContent(value)!
    expect(validateDetailContent(value)).toEqual([])
    expect(prepared).toMatchObject({
      features: [],
      structureImages: [],
      showControl: false,
      showDimensions: false,
    })
    expect(prepared.heroTitle).toHaveLength(160)
    expect(prepared.heroImage?.caption).toHaveLength(500)
    expect(prepared).not.toHaveProperty('power')
    expect(prepared).not.toHaveProperty('dimensions')
    expect(prepared).not.toHaveProperty('unknownField')
  })

  it('drops empty or invalid optional nested blocks when preparing a preview', () => {
    expect(
      prepareDetailContent(
        unsafe({
          version: 1,
          heroTitle: '',
          heroImage: { url: '', alt: '' },
          storyImage: { url: 'javascript:bad', alt: '사진' },
          features: [
            { title: '', body: '' },
            { title: '제목', body: '' },
          ],
          structureImages: [{ url: '', alt: '' }],
          application: { title: '', image: { url: '/a.webp', alt: '사진' } },
        }),
      ),
    ).toEqual({ version: 1, features: [], structureImages: [] })
  })

  it('deep clones nested content and includes all retained image URLs for upload cleanup', () => {
    const value: ProductDetailContent = {
      version: 1,
      heroImage: { url: '/hero.webp', alt: '히어로' },
      storyImage: { url: '/story.webp', alt: '소개' },
      dimensionImage: { url: '/dimensions.webp', alt: '규격' },
      features: [{ title: '특징', body: '설명' }],
      structureImages: [{ url: '/structure.webp', alt: '구조' }],
      application: { title: '적용', image: { url: '/application.webp', alt: '공간' } },
    }
    const copy = cloneDetailContent(value)!
    copy.features![0]!.title = '변경'
    copy.structureImages![0]!.url = '/changed.webp'
    expect(value.features![0]!.title).toBe('특징')
    expect(value.structureImages![0]!.url).toBe('/structure.webp')
    expect(detailImageUrls(value)).toEqual([
      '/hero.webp',
      '/story.webp',
      '/dimensions.webp',
      '/application.webp',
      '/structure.webp',
    ])
    expect(cloneDetailContent(undefined)).toBeNull()
    expect(prepareDetailContent(null)).toBeNull()
    expect(detailImageUrls(null)).toEqual([])
  })
})
