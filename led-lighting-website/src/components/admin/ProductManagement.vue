<template>
  <div class="product-management bg-white rounded-lg shadow-sm">
    <div class="toolbar p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
      <h3 class="text-lg sm:text-xl font-bold text-gray-900">제품 관리</h3>
      <button
        @click="handleCreate"
        class="bg-primary text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-semibold hover:bg-primary/90 transition-colors"
      >
        <span class="hidden sm:inline">제품 추가</span>
        <span class="sm:hidden">추가</span>
      </button>
    </div>

    <!-- 검색바 -->
    <div class="p-4 sm:p-6 border-b border-gray-200">
      <SearchBar v-model="searchQuery" placeholder="제품명으로 검색..." @search="handleSearch" />
    </div>

    <div class="p-4 sm:p-6">
      <div v-if="loading" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
        ></div>
      </div>

      <div v-else-if="products.length === 0" class="text-center py-12 text-gray-500">
        등록된 제품이 없습니다.
      </div>

      <!-- Desktop Table View -->
      <div v-else class="hidden lg:block overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4 font-semibold text-gray-700">제품명</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">카테고리</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">전력</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">수명</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">이미지</th>
              <th class="text-center py-3 px-4 font-semibold text-gray-700">작업</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="product in products"
              :key="product.id"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td class="py-3 px-4">{{ product.name }}</td>
              <td class="py-3 px-4">{{ product.category }}</td>
              <td class="py-3 px-4">{{ formatWithUnit(product.power, 'power') }}</td>
              <td class="py-3 px-4">{{ formatWithUnit(product.lifespan, 'lifespan') }}</td>
              <td class="py-3 px-4">
                <img
                  v-if="product.images && product.images.length > 0"
                  :src="getFirstImageUrl(product.images)"
                  class="w-16 h-16 object-cover rounded"
                  :alt="product.name"
                />
              </td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button
                    @click="handleEdit(product)"
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    @click="handleDelete(product)"
                    class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div v-if="!loading && products.length > 0" class="lg:hidden space-y-4">
        <div
          v-for="product in products"
          :key="product.id"
          class="border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <!-- Image and Name -->
          <div class="flex items-start gap-3">
            <img
              v-if="product.images && product.images.length > 0"
              :src="getFirstImageUrl(product.images)"
              class="w-20 h-20 object-cover rounded flex-shrink-0"
              :alt="product.name"
            />
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-gray-900 mb-1 truncate">{{ product.name }}</h4>
              <p class="text-sm text-gray-600">{{ product.category }}</p>
              <span
                v-if="product.isNew"
                class="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded mt-1"
              >
                신제품
              </span>
            </div>
          </div>

          <!-- Details -->
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-gray-600">전력:</span>
              <span class="ml-1 font-medium">{{ product.power }}</span>
            </div>
            <div>
              <span class="text-gray-600">수명:</span>
              <span class="ml-1 font-medium">{{ product.lifespan }}</span>
            </div>
          </div>

          <!-- Description -->
          <p class="text-sm text-gray-600 line-clamp-2">{{ product.description }}</p>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              @click="handleEdit(product)"
              class="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
            >
              수정
            </button>
            <button
              @click="handleDelete(product)"
              class="flex-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-medium"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      <!-- 페이지네이션 -->
      <ThePagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalProducts"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { productsAPI } from '@/api'
import type { Product } from '@/types'
import { getFirstImageUrl } from '@/utils/image'
import { formatWithUnit } from '@/constants/units'
import SearchBar from '@/components/common/SearchBar.vue'
import ThePagination from '@/components/common/ThePagination.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const products = ref<Product[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const totalProducts = ref(0)
const totalPages = ref(0)
const searchQuery = ref('')

const fetchProducts = async (page: number = 1, search?: string): Promise<void> => {
  loading.value = true
  try {
    const { data } = await productsAPI.getPaginated(
      page,
      pageSize.value,
      search || searchQuery.value,
    )
    products.value = data.data
    totalProducts.value = data.total
    totalPages.value = data.totalPages
    currentPage.value = data.page
  } catch {
    toast.error('제품 목록을 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number): void => {
  if (page < 1 || page > totalPages.value) return
  fetchProducts(page)
}

const handleSearch = (query: string): void => {
  searchQuery.value = query
  currentPage.value = 1
  fetchProducts(1, query)
}

const handleCreate = (): void => {
  const currentTab = route.query.tab || 'products'
  router.push({ path: '/admin/products/new', query: { from: currentTab } })
}

const handleEdit = (product: Product): void => {
  const currentTab = route.query.tab || 'products'
  router.push({ path: `/admin/products/${product.id}`, query: { from: currentTab } })
}

const handleDelete = async (product: Product): Promise<void> => {
  if (!confirm(`"${product.name}" 제품을 삭제하시겠습니까?`)) {
    return
  }

  try {
    await productsAPI.delete(product.id)
    toast.success('제품이 삭제되었습니다')
    // 현재 페이지를 다시 로드
    fetchProducts(currentPage.value)
  } catch {
    toast.error('삭제에 실패했습니다')
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<style scoped>
.bg-primary {
  background-color: #22a8c3;
}

.hover\:bg-primary\/90:hover {
  background-color: rgba(34, 168, 195, 0.9);
}
</style>
