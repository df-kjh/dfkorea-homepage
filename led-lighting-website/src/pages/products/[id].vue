<template>
  <div class="product-detail">
    <main v-if="product">
      <div class="df-detail-shell">
        <div class="df-detail-top">
          <PublicAction to="/products" variant="text"
            >제품 목록으로 <span aria-hidden="true">↖</span></PublicAction
          >
        </div>
        <section class="df-detail-layout">
          <ProductImageGallery
            :main-image="mainImage"
            :images="galleryImages"
            :product-name="product.name"
            @image-click="handleImageClick"
          /><ProductInfo
            :series="product.modelName || 'LED 조명'"
            :product-name="product.name"
            :price="0"
            :specs="productSpecs"
            :is-new="product.isNew"
            :is-featured="product.isFeatured"
            ><template #actions
              ><QuoteButton
                variant="primary"
                class="product-quote-button"
                @click="quote.addProduct(product, $event)"
                ><span class="material-symbols-outlined" aria-hidden="true">shopping_cart</span
                ><span>견적에 담기</span></QuoteButton
              >
              <p class="product-quote-help">
                {{
                  isConnectionComponent(product)
                    ? '연결 구성품의 모델·길이 자료입니다. 전기 사양과 인증 적용은 연결할 조명에 맞춰 상담해 주세요.'
                    : '등록된 선택 항목이며 모든 옵션 조합의 공급을 보장하지 않습니다. 희망 사양과 인증 적용 범위는 상담 시 확인하고 수량은 견적 창에서 수정하세요.'
                }}
              </p></template
            ></ProductInfo
          >
        </section>
      </div>
      <section v-if="product.description" class="df-description-section">
        <div class="df-description-inner">
          <p class="df-description-kicker">ABOUT THIS LIGHT</p>
          <h2>{{ product.name }}</h2>
          <div class="product-description-content" v-html="renderedDescription"></div>
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
import PublicAction from '@/components/common/site/PublicAction.vue'
import {
  productSummary,
  productTechnicalSpecs,
  isConnectionComponent,
} from '@/components/products/presentation'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import { computed, ref } from 'vue'
import '@/assets/styles/product-markdown.css'
import type { Product } from '@/types'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import ProductImageLightbox from '@/components/products/ProductImageLightbox.vue'
import ProductInfo from '@/components/products/ProductInfo.vue'
import TechnicalSpecs from '@/components/products/TechnicalSpecs.vue'
import {
  COMPANY_NAME,
  normalizeBaseUrl,
  renderMarkdown,
  stripMarkdown,
  toAbsoluteAssetUrl,
} from '@/utils/seo'

const quote = useQuoteDraft()
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

const productSpecs = computed(() => (product.value ? productSummary(product.value) : []))
const technicalSpecs = computed(() => (product.value ? productTechnicalSpecs(product.value) : []))

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
        `${product.value!.name}, ${product.value!.category}, ${product.value!.modelName}, LED 조명, 디에프코리아`,
    },
  ],
})

useSeoMeta({
  title: () => `${product.value!.name} | 제품 정보 | ${COMPANY_NAME}`,
  description: () => plainDescription.value,
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
.product-description-content :deep(.markdown-table-wrapper) {
  border-color: #d5c6af;
  border-radius: 2px;
}
.product-description-content :deep(th) {
  background: #e8decb;
  color: #514532;
}
.product-description-content :deep(td) {
  color: #6d5c43;
}
.product-description-content :deep(th),
.product-description-content :deep(td) {
  border-color: #dcd0ba;
  font-size: var(--df-font-body, 16px);
  line-height: 1.8;
}
.product-description-content :deep(a) {
  color: #92703d;
}

.product-detail {
  width: 100%;
  background: #f0ece3;
  color: #29251e;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
}
.df-detail-shell {
  max-width: 1360px;
  margin: auto;
  padding: 119px 40px 80px;
}
.df-detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid #d9cbb4;
}
.df-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 70px;
  margin-top: 42px;
}
.product-quote-button {
  width: 100%;
  min-height: 54px;
  white-space: normal;
  border-radius: 999px;
  gap: 12px;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
  background: #25251c;
  border-color: #25251c;
  color: #f6eddc;
}
.product-quote-button:hover {
  background: #4b4636;
}
.product-quote-button .material-symbols-outlined {
  font-size: 20px;
}
.product-quote-help {
  margin-top: 16px;
  color: #716149;
  font-size: var(--df-font-label, 14px);
  overflow-wrap: anywhere;
  line-height: 1.9;
}
.df-description-section {
  padding: 75px 24px;
  background: #f8f6ef;
  border-top: 1px solid #ded4c3;
}
.df-description-inner {
  max-width: 800px;
  margin: auto;
}
.df-description-kicker {
  font-size: var(--df-font-meta, 13px);
  color: #746044;
  letter-spacing: 0.15em;
  margin-bottom: 22px;
}
.df-description-inner > h2 {
  font-size: 34px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: -0.04em;
  margin-bottom: 34px;
  overflow-wrap: anywhere;
}
.product-description-content :deep(p) {
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  overflow-wrap: anywhere;
  line-height: 1.95;
  color: #6d6558;
  margin-bottom: 23px;
}
.product-description-content :deep(h1),
.product-description-content :deep(h2) {
  font-size: 29px;
  font-weight: 600;
  letter-spacing: -0.04em;
  margin: 38px 0 22px;
}
.product-description-content :deep(h3) {
  font-size: 23px;
  font-weight: 600;
  margin: 30px 0 16px;
}
.product-description-content :deep(ul) {
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  overflow-wrap: anywhere;
  line-height: 1.9;
  color: #6d6558;
  margin: 0 0 25px;
  padding-left: 24px;
}
.product-description-content :deep(li) {
  margin-bottom: 10px;
}
.product-description-content :deep(strong) {
  color: #352f24;
}
@media (max-width: 900px) {
  .df-detail-layout {
    gap: 36px;
  }
}
@media (max-width: 800px) {
  .df-detail-shell {
    padding: 108px 24px 45px;
  }
  .df-detail-layout {
    grid-template-columns: 1fr;
    gap: 38px;
    margin-top: 28px;
  }
  .df-description-section {
    padding: 48px 24px;
  }
  .df-description-inner > h2 {
    font-size: 28px;
  }
}
@media (max-width: 350px) {
  .df-detail-shell {
    padding-inline: 20px;
  }
}
</style>
