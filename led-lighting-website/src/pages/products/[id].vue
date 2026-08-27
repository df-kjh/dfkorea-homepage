<template>
  <div class="product-detail bg-background font-inter min-h-screen">
    <main v-if="product" class="pt-20">
      <section class="max-w-[1400px] mx-auto px-10 py-12 lg:py-20">
        <div class="grid lg:grid-cols-12 gap-16 items-start">
          <ProductImageGallery
            :main-image="mainImage"
            :images="galleryImages"
            :product-name="product.name"
            @image-click="handleImageClick"
          />

          <ProductInfo
            :series="product.modelName || 'LED Series'"
            :product-name="product.name"
            :price="0"
            :specs="productSpecs"
            :is-new="product.isNew"
            :is-featured="product.isFeatured"
          />
        </div>
      </section>

      <section v-if="product.description" class="py-24 bg-white border-t border-gray-100">
        <div class="max-w-4xl mx-auto px-10">
          <h2 class="text-text-main text-4xl lg:text-5xl font-bold mb-10 leading-tight">
            {{ product.name }}
          </h2>
          <div class="product-description-content mb-12" v-html="renderedDescription"></div>
        </div>
      </section>

      <TechnicalSpecs :specs="technicalSpecs" />
    </main>

    <ProductImageLightbox
      :image="selectedImage"
      :title="product?.name || '제품'"
      @close="closeImageViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Product } from '@/types'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import ProductImageLightbox from '@/components/products/ProductImageLightbox.vue'
import ProductInfo from '@/components/products/ProductInfo.vue'
import TechnicalSpecs from '@/components/products/TechnicalSpecs.vue'
import { formatWithUnit } from '@/constants/units'
import {
  COMPANY_NAME,
  normalizeBaseUrl,
  renderMarkdown,
  stripMarkdown,
  toAbsoluteAssetUrl,
} from '@/utils/seo'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const productId = route.params.id as string
const apiBaseUrl = normalizeBaseUrl(String(config.public.apiBaseUrl))
const siteUrl = normalizeBaseUrl(String(config.public.siteUrl))
const assetUrlOptions = { apiBaseUrl, siteUrl }

const { data: product, error } = await useFetch<Product>(`${apiBaseUrl}/products/${productId}`, {
  key: `product-${productId}`,
})

if (error.value || !product.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '제품을 찾을 수 없습니다.',
  })
}

const canonicalUrl = computed(() => `${siteUrl}/products/${product.value!.id}`)
const mainImage = computed(() =>
  toAbsoluteAssetUrl(product.value?.images?.find((image) => image.image)?.image, assetUrlOptions),
)
const renderedDescription = computed(() => renderMarkdown(product.value?.description || ''))
const plainDescription = computed(
  () =>
    stripMarkdown(product.value?.description || '').slice(0, 155) ||
    `${product.value?.name} 제품의 주요 사양과 특징을 확인하세요.`,
)

const galleryImages = computed(() => {
  if (!product.value?.images || product.value.images.length === 0) return []

  return product.value.images
    .filter((img) => img.image.trim() !== '')
    .map((img, index) => ({
      url: toAbsoluteAssetUrl(img.image, assetUrlOptions),
      alt: `${product.value!.name} 제품 이미지 ${index + 1}`,
      description: img.description,
    }))
})

const openedImageFromPage = ref(false)
const selectedImageIndex = computed(() => {
  const imageQuery = Array.isArray(route.query.image) ? route.query.image[0] : route.query.image
  if (!imageQuery) return null

  const index = Number(imageQuery)
  return Number.isInteger(index) ? index : null
})
const selectedImage = computed(() => {
  const index = selectedImageIndex.value
  if (index === null || index < 0 || index >= galleryImages.value.length) return null

  return galleryImages.value[index] ?? null
})

const productSpecs = computed(() => {
  if (!product.value) return []

  return [
    {
      icon: 'bolt',
      label: '전력',
      value: formatWithUnit(product.value.power, 'power'),
    },
    {
      icon: 'straighten',
      label: '사이즈',
      value: formatWithUnit(product.value.dimensions, 'dimensions'),
    },
    {
      icon: 'verified',
      label: '인증',
      value: product.value.certifications?.join(', ') || 'N/A',
    },
    {
      icon: 'palette',
      label: '색온도',
      value: formatWithUnit(product.value.colorTemp, 'colorTemp'),
    },
  ]
})

const technicalSpecs = computed(() => {
  if (!product.value) return []

  const specs = [
    {
      label: '모델명',
      value: product.value.modelName || 'N/A',
    },
    {
      label: '사이즈',
      value: formatWithUnit(product.value.dimensions, 'dimensions'),
    },
    {
      label: '전력',
      value: formatWithUnit(product.value.power, 'power'),
    },
    {
      label: '색온도',
      value: formatWithUnit(product.value.colorTemp, 'colorTemp'),
    },
    {
      label: '수명',
      value: formatWithUnit(product.value.lifespan, 'lifespan'),
    },
    {
      label: 'LED 칩 제조사',
      value: product.value.ledChipManufacturer || 'N/A',
    },
  ]

  if (product.value.powerFactor) {
    specs.push({
      label: '역률',
      value: formatWithUnit(product.value.powerFactor, 'powerFactor'),
    })
  }

  if (product.value.luminanceEfficiency) {
    specs.push({
      label: '광효율',
      value: formatWithUnit(product.value.luminanceEfficiency, 'luminanceEfficiency'),
    })
  }

  if (product.value.colorRendering) {
    specs.push({
      label: '연색성',
      value: product.value.colorRendering,
    })
  }

  specs.push({
    label: '인증',
    value: product.value.certifications?.join(', ') || 'N/A',
  })

  if (product.value.options && product.value.options.length > 0) {
    specs.push({
      label: '옵션',
      value: product.value.options.join(', '),
    })
  }

  return specs
})

const handleImageClick = (_url: string, index: number) => {
  openedImageFromPage.value = true
  router.push({
    query: {
      ...route.query,
      image: String(index),
    },
  })
}

const closeImageViewer = () => {
  if (openedImageFromPage.value) {
    openedImageFromPage.value = false
    router.back()
    return
  }

  const query = { ...route.query }
  delete query.image
  router.replace({ query })
}

useSeoMeta({
  title: () => `${product.value!.name} | 제품 정보 | ${COMPANY_NAME}`,
  description: () => plainDescription.value,
  keywords: () =>
    `${product.value!.name}, ${product.value!.category}, ${product.value!.modelName}, LED 조명, 디에프코리아`,
  ogTitle: () => product.value!.name,
  ogDescription: () => plainDescription.value,
  ogUrl: () => canonicalUrl.value,
  ogImage: () => mainImage.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => product.value!.name,
  twitterDescription: () => plainDescription.value,
  twitterImage: () => mainImage.value,
})

useHead({
  meta: [
    {
      property: 'og:type',
      content: 'product',
    },
  ],
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.value!.name,
          description: plainDescription.value,
          image: galleryImages.value.map((image) => image.url),
          sku: product.value!.modelName,
          category: product.value!.category,
          brand: {
            '@type': 'Brand',
            name: COMPANY_NAME,
          },
          manufacturer: {
            '@type': 'Organization',
            name: COMPANY_NAME,
          },
          url: canonicalUrl.value,
        }),
      ),
    },
  ],
})
</script>

<style scoped>
.product-detail {
  width: 100%;
}

.product-description-content :deep(p) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px];
}

.product-description-content :deep(h1) {
  @apply text-text-main text-4xl font-bold mt-12 mb-6 tracking-tight;
}

.product-description-content :deep(h2) {
  @apply text-text-main text-3xl font-bold mt-14 mb-6 tracking-tight;
}

.product-description-content :deep(h3) {
  @apply text-text-main text-2xl font-bold mt-10 mb-4 tracking-tight;
}

.product-description-content :deep(ul) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px] pl-6 list-disc;
}

.product-description-content :deep(li) {
  @apply mb-2;
}

.product-description-content :deep(strong) {
  @apply font-semibold text-text-main;
}
</style>
