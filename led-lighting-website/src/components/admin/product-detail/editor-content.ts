import type { ProductDetailContent, ProductDetailImage, ProductDetailFeature } from '@/types'
import { safeDetailUrl } from '@/components/products/detail/content'

const titles = [
  'heroTitle',
  'storyTitle',
  'structureTitle',
  'controlTitle',
  'dimensionsTitle',
] as const
const imageFields = ['heroImage', 'storyImage', 'dimensionImage'] as const
const switches = ['showControl', 'showDimensions'] as const
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const blankImage = (value: unknown): boolean => {
  const image = object(value)
  return (
    image.url === '' && image.alt === '' && (image.caption === undefined || image.caption === '')
  )
}

/** API JSON contains plain data; clone rather than sharing reactive arrays with fetched records. */
export function cloneDetailContent(
  value: ProductDetailContent | null | undefined,
): ProductDetailContent | null {
  return value == null ? null : (JSON.parse(JSON.stringify(value)) as ProductDetailContent)
}

export interface DetailEditorError {
  field: string
  message: string
}

/** Empty optional placeholders are omitted. Partially filled blocks must be fixed before saving. */
export function validateDetailContent(value: ProductDetailContent | null): DetailEditorError[] {
  if (value === null) return []
  const source = object(value)
  const errors: DetailEditorError[] = []
  const fail = (field: string, message: string) => {
    errors.push({ field, message })
  }
  const text = (item: unknown, field: string, label: string, max: number, required = false) => {
    if (item === undefined && !required) return
    if (typeof item !== 'string') fail(field, `${label}: 문자열을 입력해주세요.`)
    else if (item.length > max) fail(field, `${label}: ${max}자 이내로 입력해주세요.`)
    else if (required && !item.trim()) fail(field, `${label}: 내용을 입력해주세요.`)
  }
  const image = (item: unknown, field: string, label: string, required = false) => {
    if (!required && (item === undefined || blankImage(item))) return
    const source = object(item)
    if (!safeDetailUrl(source.url))
      fail(
        `${field}.url`,
        `${label}: 이미지 주소는 2048자 이내의 HTTP(S) 또는 /로 시작하는 경로여야 합니다. 공백·역슬래시는 사용할 수 없습니다.`,
      )
    text(source.alt, `${field}.alt`, `${label} 대체텍스트`, 300, true)
    text(source.caption, `${field}.caption`, `${label} 캡션`, 500)
  }
  if (source.version !== 1) fail('version', '상세 콘텐츠 버전을 확인해주세요.')
  for (const key of titles) text(source[key], key, '섹션 제목', 160)
  text(source.heroDescription, 'heroDescription', '히어로 설명', 2000)
  for (const key of switches) {
    if (source[key] !== undefined && typeof source[key] !== 'boolean')
      fail(key, '표시 여부를 선택해주세요.')
  }
  for (const key of imageFields) image(source[key], key, '상세 이미지')
  if (source.features !== undefined) {
    if (!Array.isArray(source.features)) fail('features', '특징 목록을 확인해주세요.')
    else {
      if (source.features.length > 6) fail('features', '특징은 최대 6개까지 등록할 수 있습니다.')
      source.features.forEach((item, index) => {
        const feature = object(item)
        if (feature.title === '' && feature.body === '') return
        text(feature.title, `features.${index}.title`, `특징 ${index + 1} 제목`, 160, true)
        text(feature.body, `features.${index}.body`, `특징 ${index + 1} 설명`, 2000, true)
      })
    }
  }
  if (source.structureImages !== undefined) {
    if (!Array.isArray(source.structureImages))
      fail('structureImages', '구조 이미지 목록을 확인해주세요.')
    else {
      if (source.structureImages.length > 6)
        fail('structureImages', '구조 이미지는 최대 6장까지 등록할 수 있습니다.')
      source.structureImages.forEach((item, index) =>
        image(item, `structureImages.${index}`, `구조 이미지 ${index + 1}`),
      )
    }
  }
  if (source.application !== undefined) {
    const app = object(source.application)
    text(app.title, 'application.title', '적용 이미지 제목', 160, true)
    text(app.description, 'application.description', '적용 이미지 설명', 2000)
    text(app.caption, 'application.caption', '적용 이미지 출처·캡션', 500)
    image(app.image, 'application.image', '적용 이미지', true)
  }
  return errors
}

/** Whitelist contract fields; never copy specifications, UI state or empty nested image blocks. */
export function prepareDetailContent(
  value: ProductDetailContent | null,
): ProductDetailContent | null {
  if (value === null) return null
  const source = object(value)
  const result: ProductDetailContent = { version: 1 }
  const text = (item: unknown, max: number) =>
    typeof item === 'string' && item.trim() && item.length <= max ? item : undefined
  const image = (item: unknown): ProductDetailImage | undefined => {
    const source = object(item)
    const url = safeDetailUrl(source.url)
    if (!url || typeof source.alt !== 'string' || !source.alt.trim() || source.alt.length > 300)
      return
    const caption = text(source.caption, 500)
    return { url, alt: source.alt, ...(caption ? { caption } : {}) }
  }
  for (const key of titles) {
    const value = text(source[key], 160)
    if (value !== undefined) result[key] = value
  }
  const description = text(source.heroDescription, 2000)
  if (description !== undefined) result.heroDescription = description
  for (const key of switches) if (typeof source[key] === 'boolean') result[key] = source[key]
  for (const key of imageFields) {
    const value = image(source[key])
    if (value) result[key] = value
  }
  if (Array.isArray(source.features)) {
    result.features = source.features.slice(0, 6).flatMap((item): ProductDetailFeature[] => {
      const feature = object(item)
      const title = text(feature.title, 160),
        body = text(feature.body, 2000)
      return title && body ? [{ title, body }] : []
    })
  }
  if (Array.isArray(source.structureImages)) {
    result.structureImages = source.structureImages.slice(0, 6).flatMap((item) => {
      const value = image(item)
      return value ? [value] : []
    })
  }
  const app = object(source.application)
  const title = text(app.title, 160),
    appImage = image(app.image)
  if (title && appImage) {
    result.application = { title, image: appImage }
    const description = text(app.description, 2000),
      caption = text(app.caption, 500)
    if (description) result.application.description = description
    if (caption) result.application.caption = caption
  }
  return result
}

export function detailImageUrls(value: ProductDetailContent | null): string[] {
  if (!value) return []
  return [
    value.heroImage,
    value.storyImage,
    value.dimensionImage,
    value.application?.image,
    ...(value.structureImages || []),
  ].flatMap((image) => (image ? [image.url] : []))
}
