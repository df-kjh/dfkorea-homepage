<template>
  <div class="products df-collection-page">
    <main class="df-products-main">
      <ProductsHeader
        title="공간에 맞는 빛."
        :total-items="totalProducts"
        :search-query="searchQuery"
        :filters="filters"
        :filter-options="filterOptions"
        @search="handleSearch"
        @apply-filters="applyFilters"
      /><CategoryFilter
        :categories="categoryLabels"
        :selected-category="selectedCategoryLabel"
        @category-change="handleCategoryChange"
      />
      <div class="df-filter-summary">
        <ProductFilters v-model="filters" :options="filterOptions" :controls="false" />
        <div class="df-filter-count">
          <QuoteButton variant="link" @click="resetFilters">검색 조건 초기화</QuoteButton
          ><span>검색 결과 {{ totalProducts }}개</span>
        </div>
        <p v-if="filterError" class="df-filter-error">
          검색 조건을 불러오지 못했습니다.
          <QuoteButton variant="link" @click="loadFilterOptions">다시 시도</QuoteButton>
        </p>
      </div>
      <div v-if="fetchError && !loading" class="df-collection-state" role="alert">
        <p>제품을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>
        <QuoteButton @click="fetchProducts()">다시 시도</QuoteButton>
      </div>
      <LoadingSpinner
        v-else-if="loading && !refreshingSeed"
        message="제품 목록을 불러오는 중..."
        class="py-20"
      /><EmptyState
        v-else-if="filteredProducts.length === 0"
        description="조건에 맞는 제품이 없습니다. 검색 조건을 초기화해 보세요."
        class="py-20"
      /><template v-else
        ><ProductGrid :products="filteredProducts" @product-click="viewProductDetail" />
        <div class="product-append-footer" :aria-busy="loadingMore">
          <p v-if="loadingMore" role="status">제품을 더 불러오는 중…</p>
          <p v-else-if="appendError" role="alert">
            다음 제품을 불러오지 못했습니다. 현재 목록은 유지됩니다.
          </p>
          <QuoteButton
            v-if="appendError"
            :disabled="loadingMore"
            @click="fetchProducts(currentPage + 1, true)"
            >다시 시도</QuoteButton
          >
          <div v-if="hasMore && !loading" ref="observerTarget" class="h-4"></div></div
      ></template>
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
const refreshingSeed = ref(false)
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

const fetchProducts = async (
  page: number = 1,
  append: boolean = false,
  preserveSeed: boolean = false,
) => {
  if (append && (loading.value || loadingMore.value)) return
  const generation = ++requestGeneration
  fetchError.value = false
  appendError.value = false
  if (append) {
    loadingMore.value = true
  } else {
    loadingMore.value = false
    loading.value = true
    refreshingSeed.value = preserveSeed
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
      refreshingSeed.value = false
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
  // Retain SSR cards while refreshing page 1, but block live offsets until its
  // records and total replace the build snapshot (including an exhausted seed).
  void fetchProducts(1, false, Boolean(props.initialPage))
})
</script>

<style scoped>
.products {
  width: 100%;
  overflow-anchor: none;
  background: #f0ece3;
  color: #29251e;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
}
.df-products-main {
  max-width: 1360px;
  margin: auto;
  padding: 120px 40px 60px;
}
.df-filter-summary {
  padding: 18px 0 33px;
}
.df-filter-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
  border-bottom: 1px solid #d9cdbb;
  padding-bottom: 20px;
}
.df-filter-count span {
  font-size: var(--df-font-label, 14px);
  color: #746149;
}
.df-filter-summary :deep(.q-button) {
  color: #6f5c41;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
}
.df-filter-error {
  color: #8a3e30;
  font-size: var(--df-font-body, 16px);
  margin-top: 15px;
}
.df-collection-state {
  padding: 65px 25px;
  text-align: center;
  background: #e9e2d5;
  line-height: 1.9;
}
.df-collection-state button {
  margin-top: 20px;
}
.product-append-footer {
  min-height: 180px;
  padding-block: 30px;
  color: #6f5c42;
  font-size: var(--df-font-body, 16px);
  overflow-anchor: none;
}
.product-append-footer > p {
  margin-bottom: 16px;
}
@media (max-width: 800px) {
  .df-products-main {
    padding: 108px 24px 40px;
  }
}
@media (max-width: 350px) {
  .df-products-main {
    padding-inline: 20px;
  }
}
</style>
