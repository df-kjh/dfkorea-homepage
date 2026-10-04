<template>
  <div class="home-page">
    <!-- Hero Section -->
    <HeroSection
      title="빛의 새로운 흐름."
      :subtitle="'빛을 만드는 기술. 공간을 바꾸는 감각.\nDF KOREA의 LED 조명으로 시작됩니다.'"
      @primary-click="router.push('/products')"
      @secondary-click="router.push('/about')"
    />

    <!-- Stats Section -->
    <StatsSection />

    <!-- Clients Section -->
    <ClientsSection />

    <!-- Feature Section -->
    <FeatureSection @cta-click="router.push('/products')" />

    <!-- Products Carousel -->
    <LoadingSpinner v-if="loading" message="제품을 불러오는 중..." class="py-32" />
    <section
      v-else-if="featuredError"
      class="featured-error public-container"
      data-featured-error
      role="status"
    >
      <p class="public-eyebrow">SELECTED PRODUCTS</p>
      <h2>제품을 불러오지 못했습니다.</h2>
      <p>잠시 후 다시 시도하거나 전체 제품 페이지를 확인해 주세요.</p>
      <div class="featured-error-actions">
        <PublicAction data-featured-retry @click="fetchFeaturedProducts"
          >다시 시도 <span aria-hidden="true">↻</span></PublicAction
        >
        <PublicAction to="/products" variant="text"
          >전체 제품 보기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
    </section>
    <ProductCarousel
      v-else-if="featuredProducts.length > 0"
      title="주요 제품"
      subtitle="SELECTED PRODUCTS"
      :products="featuredProducts"
      @product-click="handleProductClick"
    />
    <EmptyState v-else description="등록된 메인 제품이 없습니다" class="py-32" />

    <!-- CTA Section (기존 Contact Dialog 유지) -->
    <CtaSection company-email="kjukym@dfkorealed.com" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { productsAPI } from '@/api'
import type { Product } from '@/types'

// New Components
import HeroSection from '@/components/home/HeroSection.vue'
import StatsSection from '@/components/home/StatsSection.vue'
import ClientsSection from '@/components/home/ClientsSection.vue'
import FeatureSection from '@/components/home/FeatureSection.vue'
import ProductCarousel from '@/components/home/ProductCarousel.vue'

// Keep existing components
import CtaSection from '@/components/home/CtaSection.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'

const router = useRouter()
const toast = useToast()
const featuredProducts = ref<Product[]>([])
const loading = ref(false)
const featuredError = ref(false)
let disposed = false

const fetchFeaturedProducts = async (): Promise<void> => {
  if (loading.value || disposed) return
  loading.value = true
  featuredError.value = false
  try {
    const { data } = await productsAPI.getFeatured()
    if (disposed) return
    featuredProducts.value = data
  } catch (error) {
    // The shared API request can finish after a route change. Its result and
    // toast belong only to this mounted home view; do not publish them later.
    if (disposed) return
    featuredError.value = true
    console.error('Failed to fetch featured products:', error)
    toast.error('주요 제품 목록을 불러오는데 실패했습니다')
  } finally {
    if (!disposed) loading.value = false
  }
}

const handleProductClick = (product: Product): void => {
  router.push(`/products/${product.id}`)
}

onMounted(() => {
  fetchFeaturedProducts()
})
onBeforeUnmount(() => {
  disposed = true
})
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--df-paper, #f0ece3);
  color: var(--df-ink, #080906);
}
.featured-error {
  padding-block: 110px;
}
.featured-error h2 {
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.06em;
  margin: 20px 0;
}
.featured-error > p:not(.public-eyebrow) {
  color: #777565;
  font-size: 14px;
  line-height: 1.8;
}
.featured-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 32px;
}
</style>
