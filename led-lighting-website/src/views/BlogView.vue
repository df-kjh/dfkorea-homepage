<template>
  <div class="blog bg-background font-inter min-h-screen">
    <!-- Main Content -->
    <main class="pt-32 pb-12 max-w-screen-xl mx-auto">
      <!-- Header -->
      <BlogHeader
        title="회사 소식"
        subtitle="최신 LED 기술 혁신, 신뢰할 수 있는 제품, 그리고 지속 가능성을 향한 여정"
      />

      <!-- Category Filter -->
      <CategoryFilter
        :categories="categories"
        :selected-category="selectedCategory"
        @category-change="handleCategoryChange"
      />

      <div
        v-if="fetchError && !loading"
        class="mx-6 md:mx-12 p-8 rounded-xl bg-red-50"
        role="alert"
      >
        <p>게시글을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>
        <BaseButton class="mt-4" @click="fetchPosts()">다시 시도</BaseButton>
      </div>
      <!-- Loading State -->
      <LoadingSpinner
        v-else-if="loading && !refreshingSeed"
        message="게시글 목록을 불러오는 중..."
        class="py-20"
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="filteredPosts.length === 0"
        description="검색 결과가 없습니다"
        class="py-20"
      />

      <!-- Blog Grid -->
      <template v-else>
        <BlogGrid :posts="displayedPosts" @post-click="viewPost" />

        <!-- Loading More Indicator -->
        <div v-if="loadingMore" class="py-10 text-center">
          <LoadingSpinner message="게시글을 더 불러오는 중..." />
        </div>

        <!-- Reobserve after page 1 refreshes, even if this sentinel stays in view. -->
        <div v-if="hasMore && !loading" ref="observerTarget" class="h-4"></div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { postsAPI } from '@/api'
import type { Post, PaginatedResponse } from '@/types'
import BlogHeader from '@/components/blog/BlogHeader.vue'
import BlogGrid from '@/components/blog/BlogGrid.vue'
import CategoryFilter from '@/components/blog/CategoryFilter.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseButton from '@/components/common/BaseButton.vue'

const props = defineProps<{ initialPage?: PaginatedResponse<Post> | null }>()

const router = useRouter()
const toast = useToast()
const posts = ref<Post[]>(props.initialPage?.data ?? [])
const loading = ref(false)
const refreshingSeed = ref(false)
const fetchError = ref(false)
const loadingMore = ref(false)
const currentPage = ref(props.initialPage?.page ?? 1)
const pageSize = ref(props.initialPage?.limit ?? 20) // 한 번에 20개씩 로드
const totalPosts = ref(props.initialPage?.total ?? 0)
const selectedCategory = ref('전체')

const categories = ['전체', '회사소식', '제품소식', '기술정보', '산업동향']

const filteredPosts = computed(() => {
  if (selectedCategory.value === '전체') {
    return posts.value
  }
  return posts.value.filter((post) => post.category === selectedCategory.value)
})

const displayedPosts = computed(() => filteredPosts.value)
const hasMore = computed(() => posts.value.length < totalPosts.value)

const fetchPosts = async (
  page: number = 1,
  append: boolean = false,
  preserveSeed: boolean = false,
) => {
  if (append && (loading.value || loadingMore.value || fetchError.value)) return
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    refreshingSeed.value = preserveSeed
    fetchError.value = false
  }

  try {
    const { data } = await postsAPI.getPaginated(page, pageSize.value)

    if (append) {
      posts.value = [...posts.value, ...data.data]
    } else {
      posts.value = data.data
    }

    totalPosts.value = data.total
    currentPage.value = data.page
  } catch (error) {
    // A failed first-page refresh must not append live offsets to the old SSR seed.
    if (!append) fetchError.value = true
    toast.error('게시글 목록을 불러오는데 실패했습니다')
    console.error('Failed to fetch posts:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
    refreshingSeed.value = false
  }
}

const loadMore = () => {
  if (!loading.value && !loadingMore.value && !fetchError.value && hasMore.value) {
    fetchPosts(currentPage.value + 1, true)
  }
}

// 무한 스크롤 설정
const { observerTarget } = useInfiniteScroll({
  onLoadMore: loadMore,
  enabled: () => hasMore.value && !loading.value && !loadingMore.value && !fetchError.value,
})

const handleCategoryChange = (category: string) => {
  selectedCategory.value = category
}

const viewPost = async (post: Post) => {
  console.log('viewPost called with:', post.id)

  // 조회수 증가
  try {
    await postsAPI.incrementView(post.id)
    console.log('View count incremented successfully')
  } catch (error) {
    console.error('Failed to increment view count:', error)
  }

  // 상세 페이지로 이동
  console.log('Navigating to:', `/blog/${post.id}`)
  router.push(`/blog/${post.id}`)
}

onMounted(() => {
  // Retain SSR cards while refreshing page 1, but block live offsets until its
  // records and total replace the build snapshot (including an exhausted seed).
  void fetchPosts(1, false, Boolean(props.initialPage))
})
</script>

<style scoped>
.blog {
  width: 100%;
}
</style>
