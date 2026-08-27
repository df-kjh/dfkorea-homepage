<template>
  <div class="products bg-background font-inter min-h-screen">
    <!-- Header with Search -->
    <main class="pt-32 pb-12 max-w-screen-xl mx-auto">
      <ProductsHeader
        title="제품 목록"
        :total-items="totalProducts"
        :search-query="searchQuery"
        @search="handleSearch"
      />

      <!-- Category Filter -->
      <CategoryFilter
        :categories="categoryLabels"
        :selected-category="selectedCategoryLabel"
        @category-change="handleCategoryChange"
      />

      <!-- Loading State -->
      <LoadingSpinner v-if="loading" message="제품 목록을 불러오는 중..." class="py-20" />

      <!-- Empty State -->
      <EmptyState
        v-else-if="filteredProducts.length === 0"
        description="등록된 제품이 없습니다"
        class="py-20"
      />

      <!-- Products Grid -->
      <template v-else>
        <ProductGrid :products="filteredProducts" @product-click="viewProductDetail" />

        <!-- Loading More Indicator -->
        <div v-if="loadingMore" class="py-10 text-center">
          <LoadingSpinner message="제품을 더 불러오는 중..." />
        </div>

        <!-- Intersection Observer Target -->
        <div v-if="hasMore" ref="observerTarget" class="h-4"></div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useSEO } from '@/composables/useSEO'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { productsAPI } from '@/api'
import type { Product } from '@/types'
import { productCategories } from '@/utils/category'
import ProductsHeader from '@/components/products/ProductsHeader.vue'
import ProductGrid from '@/components/products/ProductGrid.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CategoryFilter from '@/components/blog/CategoryFilter.vue'

// SEO 설정
useSEO({
  title: '제품 목록 | (주)디에프코리아 - 다양한 LED 조명 제품',
  description:
    '(주)디에프코리아의 다양한 LED 조명 제품을 만나보세요. 산업용, 상업용, 가정용 LED 조명 솔루션을 제공합니다. 에너지 효율적이고 고품질의 LED 제품을 확인하세요.',
  keywords:
    'LED 제품, LED 조명 제품, 산업용 LED, 상업용 LED, 가정용 조명, LED 솔루션, 에너지 절약 조명',
  ogType: 'website',
})

const router = useRouter()
const toast = useToast()
const selectedCategory = ref('전체')
const products = ref<Product[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20) // 한 번에 20개 제품 로드
const totalProducts = ref(0)
const searchQuery = ref('')

// 카테고리 레이블 목록
const categoryLabels = computed(() => productCategories.map((cat) => cat.label))

// 선택된 카테고리 레이블
const selectedCategoryLabel = computed(() => selectedCategory.value)

// 서버에서 필터링된 결과를 받으므로 그대로 표시
const filteredProducts = computed(() => products.value)

// 무한 스크롤로 더 로드할 수 있는지 확인
const hasMore = computed(() => products.value.length < totalProducts.value)

const fetchProducts = async (page: number = 1, append: boolean = false) => {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const { data } = await productsAPI.getPaginated(
      page,
      pageSize.value,
      searchQuery.value,
      selectedCategory.value,
    )

    if (append) {
      products.value = [...products.value, ...data.data]
    } else {
      products.value = data.data
    }

    totalProducts.value = data.total
    currentPage.value = data.page
  } catch (error) {
    toast.error('제품 목록을 불러오는데 실패했습니다')
    console.error('Failed to fetch products:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (!loadingMore.value && hasMore.value) {
    fetchProducts(currentPage.value + 1, true)
  }
}

// 무한 스크롤 설정
const { observerTarget } = useInfiniteScroll({
  onLoadMore: loadMore,
  enabled: () => hasMore.value && !loading.value && !loadingMore.value,
})

const handleSearch = (query: string) => {
  searchQuery.value = query
  // 검색 시 첫 페이지로 이동하고 API 호출
  currentPage.value = 1
  fetchProducts(1, false)
}

const handleCategoryChange = (categoryLabel: string) => {
  selectedCategory.value = categoryLabel
  // 카테고리 변경 시 첫 페이지로 이동하고 API 호출
  currentPage.value = 1
  fetchProducts(1, false)
  // 상단으로 스크롤
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const viewProductDetail = (product: Product) => {
  router.push(`/products/${product.id}`)
}

onMounted(() => {
  fetchProducts()
})
</script>

<style scoped>
.products {
  width: 100%;
}
</style>
