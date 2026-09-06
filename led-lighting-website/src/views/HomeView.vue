<template>
  <div class="min-h-screen bg-white">
    <!-- Hero Section -->
    <HeroSection
      title="미래를 밝히는 LED 조명"
      subtitle="혁신적인 기술로 더 나은 빛을 제공합니다"
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
    <ProductCarousel
      v-else-if="featuredProducts.length > 0"
      title="주요 제품"
      subtitle="Our Categories"
      :products="featuredProducts"
      @product-click="handleProductClick"
    />
    <EmptyState v-else description="등록된 메인 제품이 없습니다" class="py-32" />

    <!-- CTA Section (기존 Contact Dialog 유지) -->
    <CtaSection />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const router = useRouter()
const toast = useToast()
const featuredProducts = ref<Product[]>([])
const loading = ref(false)

const fetchFeaturedProducts = async (): Promise<void> => {
  loading.value = true
  try {
    const { data } = await productsAPI.getFeatured()
    featuredProducts.value = data
  } catch (error) {
    console.error('Failed to fetch featured products:', error)
    toast.error('주요 제품 목록을 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const handleProductClick = (product: Product): void => {
  router.push(`/products/${product.id}`)
}

onMounted(() => {
  fetchFeaturedProducts()
})
</script>
