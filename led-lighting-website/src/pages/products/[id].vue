<template>
  <div class="product-detail">
    <ProductDetailTemplate
      v-if="product"
      :key="product.id"
      :product="displayProduct"
      @quote="quote.addProduct(product, $event)"
      @image-click="handleImageClick"
    />
    <ProductImageLightbox
      :image="selectedImage"
      :title="product?.name || '제품'"
      @close="closeImageViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { computed, ref, watch } from 'vue'
import type { Product } from '@/types'
import ProductDetailTemplate from '@/components/products/detail/ProductDetailTemplate.vue'
import { resolveProductDetail } from '@/components/products/detail/content'
import ProductImageLightbox from '@/components/products/ProductImageLightbox.vue'
import { COMPANY_NAME, normalizeBaseUrl, stripMarkdown, toAbsoluteAssetUrl } from '@/utils/seo'
import { withRegisteredImageUrls } from '@/utils/product-images'

const quote = useQuoteDraft()
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const productId = computed(() => String(route.params.id))
const apiBaseUrl = normalizeBaseUrl(String(config.public.apiBaseUrl))
const siteUrl = normalizeBaseUrl(String(config.public.siteUrl))
const assetUrlOptions = { apiBaseUrl, siteUrl }

const { data: product, error } = await useFetch<Product>(
  () => `${apiBaseUrl}/products/${productId.value}`,
  {
    key: computed(() => `product-${productId.value}`),
  },
)

if (error.value || !product.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '제품을 찾을 수 없습니다.',
  })
}

const canonicalUrl = computed(() => `${siteUrl}/products/${product.value?.id || productId.value}`)
const mainImage = computed(() =>
  toAbsoluteAssetUrl(product.value?.images?.find((image) => image.image)?.image, assetUrlOptions),
)
const plainDescription = computed(
  () =>
    stripMarkdown(product.value?.description || '').slice(0, 155) ||
    `${product.value?.name} 제품의 주요 사양과 특징을 확인하세요.`,
)

const displayProduct = computed(() => withRegisteredImageUrls(product.value!, assetUrlOptions))
const galleryImages = computed(() =>
  product.value ? resolveProductDetail(displayProduct.value).gallery : [],
)

const openedImageFromPage = ref(false)
// Image history belongs to one SKU. A later direct image URL must close with
// replace rather than using the previous SKU's lightbox back-navigation state.
watch(productId, () => {
  openedImageFromPage.value = false
})
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

useHead({
  meta: [
    {
      name: 'keywords',
      content: () =>
        `${product.value?.name || ''}, ${product.value?.category || ''}, ${product.value?.modelName || ''}, LED 조명, 디에프코리아`,
    },
  ],
})

useSeoMeta({
  title: () => `${product.value?.name || '제품'} | 제품 정보 | ${COMPANY_NAME}`,
  description: () => plainDescription.value,
  ogTitle: () => product.value?.name,
  ogDescription: () => plainDescription.value,
  ogUrl: () => canonicalUrl.value,
  ogImage: () => mainImage.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => product.value?.name,
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
          name: product.value?.name,
          description: plainDescription.value,
          image: (product.value
            ? resolveProductDetail(displayProduct.value).registeredImages
            : []
          ).map((image) => image.url),
          sku: product.value?.modelName,
          category: product.value?.category,
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
