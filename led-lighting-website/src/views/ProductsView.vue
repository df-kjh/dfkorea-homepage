<template>
  <div class="products bg-background font-inter min-h-screen">
    <!-- Header with Search -->
    <main class="pt-32 pb-12 max-w-screen-xl mx-auto">
      <ProductsHeader
        title="제품 목록"
        :total-items="totalProducts"
        :search-query="searchQuery"
        :filters="filters"
        :filter-options="filterOptions"
        @search="handleSearch"
        @apply-filters="applyFilters"
      />

      <!-- Category Filter -->
      <CategoryFilter
        :categories="categoryLabels"
        :selected-category="selectedCategoryLabel"
        @category-change="handleCategoryChange"
      />

      <div class="px-6 md:px-12 mb-8 max-w-3xl">
        <ProductFilters v-model="filters" :options="filterOptions" :controls="false" />
        <div class="flex flex-wrap gap-3 items-center">
          <QuoteButton variant="link" @click="resetFilters">검색 조건 초기화</QuoteButton
          ><span class="text-sm text-gray-600">검색 결과 {{ totalProducts }}개</span>
        </div>
        <p v-if="filterError" class="text-sm text-red-700">
          검색 조건을 불러오지 못했습니다.
          <QuoteButton variant="link" @click="loadFilterOptions">다시 시도</QuoteButton>
        </p>
      </div>

      <div
        v-if="fetchError && !loading"
        class="mx-6 md:mx-12 p-8 rounded-xl bg-red-50 text-gray-800"
        role="alert"
      >
        <p>제품을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>
        <QuoteButton class="mt-4" @click="fetchProducts()">다시 시도</QuoteButton>
      </div>
      <!-- Loading State -->
      <LoadingSpinner v-else-if="loading" message="제품 목록을 불러오는 중..." class="py-20" />

      <!-- Empty State -->
      <EmptyState
        v-else-if="filteredProducts.length === 0"
        description="조건에 맞는 제품이 없습니다. 검색 조건을 초기화해 보세요."
        class="py-20"
      />

      <!-- Products Grid -->
      <template v-else>
        <ProductGrid :products="filteredProducts" @product-click="viewProductDetail" />

        <!-- Keep the append footer's height stable across pending, failure and retry. -->
        <div class="product-append-footer mx-6 md:mx-12" :aria-busy="loadingMore">
          <p v-if="loadingMore" role="status">제품을 더 불러오는 중…</p>
          <p v-else-if="appendError" role="alert" class="text-red-700">
            다음 제품을 불러오지 못했습니다. 현재 목록은 유지됩니다.
          </p>
          <QuoteButton
            v-if="appendError"
            :disabled="loadingMore"
            @click="fetchProducts(currentPage + 1, true)"
            >다시 시도</QuoteButton
          >
          <div v-if="hasMore" ref="observerTarget" class="h-4"></div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { productsAPI } from '@/api'
import type { Product, PaginatedResponse } from '@/types'
import type { ProductFilterOptions } from '@/types/quote'
import { emptyFilters } from '@/composables/quote-draft'
import ProductFilters from '@/components/common/quote/ProductFilters.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import ProductsHeader from '@/components/products/ProductsHeader.vue'
import ProductGrid from '@/components/products/ProductGrid.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CategoryFilter from '@/components/blog/CategoryFilter.vue'

const props = defineProps<{ initialPage?: PaginatedResponse<Product> | null }>()

const router = useRouter()
const toast = useToast()
const selectedCategory = ref('전체')
const products = ref<Product[]>(props.initialPage?.data ?? [])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(props.initialPage?.page ?? 1)
const pageSize = ref(props.initialPage?.limit ?? 20) // 한 번에 20개 제품 로드
const totalProducts = ref(props.initialPage?.total ?? 0)
const searchQuery = ref('')
const filters = ref(emptyFilters())
const filterOptions = ref<ProductFilterOptions>({ categories: [], ...emptyFilters() })
const fetchError = ref(false),
  appendError = ref(false),
  filterError = ref(false)
let requestGeneration = 0,
  disposed = false
async function loadFilterOptions() {
  try {
    const { data } = await productsAPI.getFilterOptions()
    if (!disposed) {
      filterOptions.value = data
      filterError.value = false
    }
  } catch {
    if (!disposed) filterError.value = true
  }
}
function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = '전체'
  filters.value = emptyFilters()
}
function applyFilters(value: ReturnType<typeof emptyFilters>) {
  filters.value = value
}
watch(
  filters,
  () => {
    void fetchProducts()
  },
  { deep: true },
)
onBeforeUnmount(() => {
  disposed = true
  requestGeneration++
})

// 카테고리 레이블 목록
const categoryLabels = computed(() => ['전체', ...filterOptions.value.categories])

// 선택된 카테고리 레이블
const selectedCategoryLabel = computed(() => selectedCategory.value)

// 서버에서 필터링된 결과를 받으므로 그대로 표시
const filteredProducts = computed(() => products.value)

// 무한 스크롤로 더 로드할 수 있는지 확인
const hasMore = computed(() => products.value.length < totalProducts.value)

const fetchProducts = async (page: number = 1, append: boolean = false) => {
  if (append && (loading.value || loadingMore.value)) return
  const generation = ++requestGeneration
  fetchError.value = false
  appendError.value = false
  if (append) {
    loadingMore.value = true
  } else {
    loadingMore.value = false
    loading.value = true
  }

  try {
    const { data } = await productsAPI.getPaginated(
      page,
      pageSize.value,
      searchQuery.value,
      selectedCategory.value,
      filters.value,
    )

    if (generation !== requestGeneration || disposed) return
    if (append) {
      products.value = [...products.value, ...data.data]
    } else {
      products.value = data.data
    }

    totalProducts.value = data.total
    currentPage.value = data.page
  } catch (error) {
    if (generation !== requestGeneration || disposed) return
    if (append) appendError.value = true
    else fetchError.value = true
    toast.error('제품 목록을 불러오는데 실패했습니다')
    console.error('Failed to fetch products:', error)
  } finally {
    if (generation === requestGeneration && !disposed) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

const loadMore = () => {
  if (
    !loading.value &&
    !loadingMore.value &&
    !fetchError.value &&
    !appendError.value &&
    hasMore.value
  ) {
    // The observer must not wait on an obsolete generation after filters change.
    // loading/loadingMore guard duplicate requests for the current generation.
    void fetchProducts(currentPage.value + 1, true)
  }
}

// 무한 스크롤 설정
const { observerTarget } = useInfiniteScroll({
  onLoadMore: loadMore,
  enabled: () =>
    hasMore.value &&
    !fetchError.value &&
    !appendError.value &&
    !loading.value &&
    !loadingMore.value,
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
  void loadFilterOptions()
  // Nuxt transfers the SSR page in its payload; retain those cards during hydration.
  if (!props.initialPage) void fetchProducts()
})
</script>

<style scoped>
.product-append-footer {
  min-height: 180px;
  padding-block: 24px;
  color: #637083;
  overflow-anchor: none;
}
.product-append-footer > p {
  margin-bottom: 16px;
}
.products {
  width: 100%;
  /* Appending changes only content below the existing grid; do not anchor to the loader. */
  overflow-anchor: none;
}
</style>
