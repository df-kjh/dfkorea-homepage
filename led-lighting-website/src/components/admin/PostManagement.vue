<template>
  <div class="post-management bg-white rounded-lg shadow-sm">
    <div
      class="toolbar p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3"
    >
      <h3 class="text-lg sm:text-xl font-bold text-gray-900">소식 관리</h3>
      <div class="flex items-center gap-2 sm:gap-3">
        <AiPostGeneratorButton @success="handleAiSuccess" />
        <AiPostGeneratorButton
          type="productNews"
          label="제품소식 AI 자동생성"
          @success="handleAiSuccess"
        />
        <button
          @click="handleCreate"
          class="bg-primary text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-semibold hover:bg-primary/90 transition-colors"
        >
          <span class="hidden sm:inline">게시글 추가</span>
          <span class="sm:hidden">추가</span>
        </button>
      </div>
    </div>

    <!-- 검색바 -->
    <div class="p-4 sm:p-6 border-b border-gray-200">
      <SearchBar v-model="searchQuery" placeholder="제목으로 검색..." @search="handleSearch" />
    </div>

    <div class="p-4 sm:p-6">
      <div v-if="loading" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
        ></div>
      </div>

      <div v-else-if="posts.length === 0" class="text-center py-12 text-gray-500">
        등록된 게시글이 없습니다.
      </div>

      <!-- Desktop Table View -->
      <div v-else class="hidden lg:block overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4 font-semibold text-gray-700">제목</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">카테고리</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">이미지</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">요약</th>
              <th class="text-center py-3 px-4 font-semibold text-gray-700">조회수</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">작성일</th>
              <th class="text-center py-3 px-4 font-semibold text-gray-700">작업</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="post in posts"
              :key="post.id"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td class="py-3 px-4 font-medium">{{ post.title }}</td>
              <td class="py-3 px-4">{{ post.category }}</td>
              <td class="py-3 px-4">
                <img
                  v-if="post.image"
                  :src="getImageUrl(post.image)"
                  class="w-16 h-16 object-cover rounded"
                  :alt="post.title"
                />
              </td>
              <td class="py-3 px-4 max-w-xs truncate">{{ post.excerpt }}</td>
              <td class="py-3 px-4 text-center">{{ post.views || 0 }}</td>
              <td class="py-3 px-4">{{ formatDate(post.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button
                    @click="handleEdit(post)"
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    @click="handleDelete(post)"
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
      <div v-if="!loading && posts.length > 0" class="lg:hidden space-y-4">
        <div
          v-for="post in posts"
          :key="post.id"
          class="border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <!-- Image and Title -->
          <div class="flex items-start gap-3">
            <img
              v-if="post.image"
              :src="getImageUrl(post.image)"
              class="w-20 h-20 object-cover rounded flex-shrink-0"
              :alt="post.title"
            />
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-gray-900 mb-1 line-clamp-2">{{ post.title }}</h4>
              <p class="text-sm text-gray-600">{{ post.category }}</p>
            </div>
          </div>

          <!-- Excerpt -->
          <p class="text-sm text-gray-600 line-clamp-2">{{ post.excerpt }}</p>

          <!-- Meta Info -->
          <div class="flex items-center gap-4 text-xs text-gray-500">
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined !text-[16px]">visibility</span>
              <span>{{ post.views || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined !text-[16px]">calendar_today</span>
              <span>{{ formatDate(post.createdAt) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              @click="handleEdit(post)"
              class="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
            >
              수정
            </button>
            <button
              @click="handleDelete(post)"
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
        :total-items="totalPosts"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { postsAPI } from '@/api'
import type { Post } from '@/types'
import { formatDate } from '@/utils/date'
import { getImageUrl } from '@/utils/image'
import SearchBar from '@/components/common/SearchBar.vue'
import ThePagination from '@/components/common/ThePagination.vue'
import AiPostGeneratorButton from './AiPostGeneratorButton.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const posts = ref<Post[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const totalPosts = ref(0)
const totalPages = ref(0)
const searchQuery = ref('')

const fetchPosts = async (page: number = 1, search?: string): Promise<void> => {
  loading.value = true
  try {
    const { data } = await postsAPI.getPaginated(page, pageSize.value, search || searchQuery.value)
    posts.value = data.data
    totalPosts.value = data.total
    totalPages.value = data.totalPages
    currentPage.value = data.page
  } catch {
    toast.error('게시글 목록을 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number): void => {
  if (page < 1 || page > totalPages.value) return
  fetchPosts(page)
}

const handleSearch = (query: string): void => {
  searchQuery.value = query
  currentPage.value = 1
  fetchPosts(1, query)
}

const handleCreate = (): void => {
  const currentTab = route.query.tab || 'news'
  router.push({ path: '/admin/posts/new', query: { from: currentTab } })
}

const handleEdit = (post: Post): void => {
  const currentTab = route.query.tab || 'news'
  router.push({ path: `/admin/posts/${post.id}`, query: { from: currentTab } })
}

const handleDelete = async (post: Post): Promise<void> => {
  if (!confirm(`"${post.title}" 게시글을 삭제하시겠습니까?`)) {
    return
  }

  try {
    await postsAPI.delete(post.id)
    toast.success('게시글이 삭제되었습니다')
    // 현재 페이지를 다시 로드
    fetchPosts(currentPage.value)
  } catch {
    toast.error('삭제에 실패했습니다')
  }
}

const handleAiSuccess = (): void => {
  // AI 생성 성공 후 목록 새로고침
  fetchPosts(currentPage.value)
}

onMounted(() => {
  fetchPosts()
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
