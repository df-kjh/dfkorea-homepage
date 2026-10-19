import type {
  Product,
  ProductDetailContent,
  ProductDetailImage,
  ProductDetailFeature,
} from '@/types'
import type { ProductGalleryImage } from '@/types/product-gallery'
import {
  isConnectionComponent,
  productSummary,
  productTechnicalSpecs,
  productCertificationLabels,
} from '../presentation'
import { stripMarkdown } from '@/utils/seo'
import { resolveApplicationProfile } from './application-profiles'

export const MOLDBAR_PRESET_ID = 'c2f1977b-3572-44c6-b6a7-d59a37b237f7'
const presetAsset = (file: string) => `/images/product-detail/moldbar/${file}`
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

function legacyHeroDescription(markdown: string): string {
  // The full Markdown remains below. Hero copy uses prose only, so headings,
  // specification tables, captions and option lists do not become a cut-off intro.
  const paragraph =
    markdown
      .replace(/```[\s\S]*?```/g, '')
      .split(/\n\s*\n/)
      .map((block) =>
        block
          .split('\n')
          .filter((line) => !/^\s*(?:#{1,6}(?:\s|$)|!\[|\||>|[-*+]\s|\d+[.)]\s)/.test(line))
          .join(' '),
      )
      .map((block) => stripMarkdown(block.replace(/\[([^\]]+)]\([^)]*\)/g, '$1')))
      .find(Boolean) || ''
  const sentence = paragraph.match(/^.*?[.!?。！？](?=\s|$)/u)?.[0] || paragraph
  if (sentence.length <= 150) return sentence
  const prefix = sentence.slice(0, 149)
  const boundary = prefix.lastIndexOf(' ')
  return `${(boundary > 0 ? prefix.slice(0, boundary) : prefix).trimEnd()}…`
}

/** Match the API's HTTP(S) / single-root-relative boundary, including backslash rejection. */
export function safeDetailUrl(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    /[\s\\\u0000-\u001f\u007f]/.test(value)
  )
    return
  if (/^\/(?!\/)/.test(value)) return value
  if (!/^https?:\/\//i.test(value)) return
  try {
    const url = new URL(value)
    return url.hostname ? value : undefined
  } catch {
    return undefined
  }
}
export function safeDetailImage(value: unknown): ProductDetailImage | undefined {
  const source = object(value)
  const url = safeDetailUrl(source.url)
  if (!url || typeof source.alt !== 'string' || source.alt.length > 300) return
  const caption = text(source.caption, 500)
  return { url, alt: source.alt, ...(caption ? { caption } : {}) }
}
const images = (value: unknown): ProductDetailImage[] | undefined =>
  Array.isArray(value)
    ? value
        .slice(0, 6)
        .map(safeDetailImage)
        .filter((image): image is ProductDetailImage => !!image)
    : undefined
const features = (value: unknown): ProductDetailFeature[] | undefined =>
  Array.isArray(value)
    ? value.slice(0, 6).flatMap((item) => {
        const source = object(item)
        const title = text(source.title, 160),
          body = text(source.body, 2000)
        return title && body ? [{ title, body }] : []
      })
    : undefined

/** Read defensively: malformed old/external records cannot inject HTML, images or specifications. */
export function sanitizeDetailContent(value: unknown): Partial<ProductDetailContent> {
  const source = object(value)
  if (source.version !== 1) return {}
  const result: Partial<ProductDetailContent> = { version: 1 }
  for (const key of [
    'heroTitle',
    'storyTitle',
    'structureTitle',
    'controlTitle',
    'dimensionsTitle',
  ] as const) {
    const value = text(source[key], 160)
    if (value) result[key] = value
  }
  const description = text(source.heroDescription, 2000)
  if (description) result.heroDescription = description
  for (const key of ['heroImage', 'storyImage', 'dimensionImage'] as const) {
    const image = safeDetailImage(source[key])
    if (image) result[key] = image
  }
  for (const key of ['showControl', 'showDimensions'] as const) {
    if (typeof source[key] === 'boolean') result[key] = source[key]
  }
  const editorialFeatures = features(source.features)
  if (editorialFeatures) result.features = editorialFeatures
  const structure = images(source.structureImages)
  if (structure) result.structureImages = structure
  const app = object(source.application)
  const appTitle = text(app.title, 160),
    appImage = safeDetailImage(app.image)
  if (appTitle && appImage) {
    result.application = { title: appTitle, image: appImage }
    const description = text(app.description, 2000),
      caption = text(app.caption, 500)
    if (description) result.application.description = description
    if (caption) result.application.caption = caption
  }
  return result
}

export function resolveProductDetail(product: Product) {
  const isMoldbar = product.id === MOLDBAR_PRESET_ID
  const connection = isConnectionComponent(product)
  const summary = productSummary(product)
  const technicalSpecs = productTechnicalSpecs(product)
  const registeredImages = (product.images || []).flatMap((image, index) => {
    const url = safeDetailUrl(image.image)
    return url
      ? [
          {
            url,
            alt: `${product.name} 제품 이미지 ${index + 1}`,
            ...(image.description ? { caption: image.description } : {}),
          },
        ]
      : []
  })
  const controls = connection
    ? []
    : (product.options || []).filter((option) => typeof option === 'string' && option.trim())
  const dimensionSpec = summary.find(
    (entry) => entry.label === '제품 규격' || entry.label === '길이 규격',
  )
  const applicationProfile = isMoldbar ? undefined : resolveApplicationProfile(product)
  const legacyIntroduction = legacyHeroDescription(product.description || '')
  const originalOverview = registeredImages[0]
  const defaultStructureImages =
    registeredImages.length > 1
      ? registeredImages.slice(1)
      : registeredImages.map((image) => ({
          ...image,
          caption: image.caption || '등록된 제품 원본 사진 · 전체 형태를 확대해 살펴보세요.',
        }))
  const defaultApplication = {
    title: '공간에 맞춰,\n빛의 흐름을 계획합니다.',
    description:
      applicationProfile?.description ||
      `${product.name}의 설치 조건과 필요한 수량을 함께 확인합니다.\n현장 사진과 설치 위치를 바탕으로 적용 가능한 구성을 상담해 주세요.`,
    image: applicationProfile?.image || originalOverview,
    caption: applicationProfile
      ? undefined
      : originalOverview
        ? '등록된 제품 원본 사진입니다. 설치 공간은 현장 조건에 맞춰 상담해 주세요.'
        : '등록된 제품 사진이 없습니다. 설치 조건과 제품 자료를 상담해 주세요.',
  }
  const defaultFeatures = [
    {
      title: connection ? '연결 구성에 맞춰 고르는 길이' : '공간에 맞춰 살펴보는 크기',
      body: dimensionSpec?.value || '설치할 자리의 치수와 제품 규격을 상담해 주세요.',
    },
    {
      title: connection ? '연결할 조명과 함께 확인' : '환경에 맞춰 고르는 사양',
      body: connection
        ? `${product.name}의 연결 방식과 사용할 조명의 구성을 함께 확인합니다.`
        : summary
            .filter((entry) => ['소비전력', '색온도'].includes(entry.label))
            .map((entry) => `${entry.label} ${entry.value}`)
            .join(' · ') || '희망 사양을 상담해 주세요.',
    },
    {
      title: connection ? '설치 조건에 맞춰 계획' : '운영에 맞춰 정하는 제어',
      body: connection
        ? '천장 높이와 고정 위치, 필요한 길이를 함께 알려주세요.'
        : controls.join(' · ') ||
          '등록된 제어 옵션이 없습니다. 필요한 구성은 상담 시 확인해 주세요.',
    },
  ]
  const approved: Partial<ProductDetailContent> = isMoldbar
    ? {
        heroTitle: '공간을 따라,\n빛을 잇다.',
        heroDescription:
          '길게 이어지는 공간의 조명 계획.\n실물 사진과 등록 사양으로 몰드바를 살펴보세요.',
        heroImage: {
          url: presetAsset('moldbar-studio.png'),
          alt: '몰드바 조명을 원본 제품 사진 기반으로 제작한 스튜디오 연출 이미지',
        },
        storyTitle: '빛이 필요한 곳에,\n길을 따라.',
        structureImages: defaultStructureImages.map((image, index) => ({
          ...image,
          caption:
            image.caption ||
            ['곧게 이어지는 선형 바디 · 측면 디테일', '끝단에서 살펴보는 구조 · 단면 디테일'][
              index
            ],
        })),
        structureTitle: '가까이 볼수록,\n선명해지는 디테일.',
        features: [
          {
            title: '공간을 따라 배치하는 길이',
            body:
              dimensionSpec?.value ||
              '등록 규격을 확인하고 설치 구간과 필요한 수량을 함께 계획합니다.',
          },
          {
            title: '환경에 맞춰 고르는 사양',
            body:
              summary
                .filter((entry) => ['소비전력', '색온도'].includes(entry.label))
                .map((entry) => entry.value)
                .join(' · ') || '희망 사양을 상담해 주세요.',
          },
          {
            title: '운영에 맞춰 정하는 제어',
            body: controls.join(' · ') || '제어 구성은 상담 시 확인해 주세요.',
          },
        ],
        application: {
          title: '공간에 맞춰,\n빛의 흐름을 계획합니다.',
          description:
            '설치 구간의 길이와 배치, 원하는 제어 범위까지.\n공간의 조건에 맞는 구성을 함께 살펴봅니다.',
          image: {
            url: presetAsset('moldbar-application.png'),
            alt: '몰드바 형태 조명을 배치한 주차 공간 적용 연출 예시',
          },
        },
        controlTitle: '필요한 곳을,\n원하는 방식으로.',
        dimensionsTitle: '설치 전,\n공간의 치수부터.',
      }
    : {}
  const custom = sanitizeDetailContent(product.detailContent)
  const content = {
    heroTitle: '공간을 따라,\n빛을 잇다.',
    heroDescription: applicationProfile
      ? `${product.name}의 조명 계획.\n${applicationProfile.description}`
      : legacyIntroduction,
    heroImage: applicationProfile?.image || originalOverview,
    storyTitle: '빛이 필요한 곳에,\n공간에 맞게.',
    storyImage: registeredImages[0],
    features: defaultFeatures,
    structureTitle: '가까이 볼수록,\n선명해지는 디테일.',
    structureImages: defaultStructureImages,
    application: defaultApplication,
    controlTitle: '필요한 곳을,\n원하는 방식으로.',
    showControl: true,
    dimensionsTitle: '설치 전,\n공간의 치수부터.',
    showDimensions: true,
    ...approved,
    ...custom,
  }
  const heroPresentation =
    !custom.heroImage && (isMoldbar || applicationProfile) ? 'cover' : 'product'
  // Keep the approved hero free of automatic notes; only an explicit admin caption opts in.
  const heroCaption = custom.heroImage?.caption
  const applicationPresentation =
    custom.application || isMoldbar || applicationProfile ? 'scene' : 'reference'
  const allImages = [
    ...registeredImages,
    content.heroImage,
    content.storyImage,
    ...(content.structureImages || []),
    content.application?.image,
    content.dimensionImage,
  ]
  const gallery: ProductGalleryImage[] = []
  for (const image of allImages) {
    if (image && !gallery.some((entry) => entry.url === image.url))
      gallery.push({ url: image.url, alt: image.alt, description: image.caption })
  }
  return {
    ...content,
    heroPresentation,
    heroCaption,
    applicationPresentation,
    summary,
    technicalSpecs,
    certifications: productCertificationLabels(product),
    registeredImages,
    controls,
    dimensionSpec,
    gallery,
    connection,
    isMoldbar,
  }
}
