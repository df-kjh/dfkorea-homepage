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

      <!-- Loading State -->
      <LoadingSpinner v-if="loading" message="게시글 목록을 불러오는 중..." class="py-20" />

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
import { postsAPI } from '@/api'
import type { Post } from '@/types'
import BlogHeader from '@/components/blog/BlogHeader.vue'
import BlogGrid from '@/components/blog/BlogGrid.vue'
import CategoryFilter from '@/components/blog/CategoryFilter.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'

// SEO 설정
useSEO({
  title: '회사 소식 | (주)디에프코리아 - LED 조명 업계 뉴스 및 정보',
  description:
    '(주)디에프코리아의 최신 소식과 LED 조명 산업 동향을 확인하세요. 신제품 출시, 기술 혁신, 업계 트렌드 등 다양한 정보를 제공합니다.',
  keywords:
    '회사 소식, LED 뉴스, 조명 산업, 제품 출시, 기술 혁신, LED 트렌드, (주)디에프코리아 뉴스',
  ogType: 'website',
})

const router = useRouter()
const toast = useToast()
const posts = ref<Post[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20) // 한 번에 20개씩 로드
const totalPosts = ref(0)
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

const fetchPosts = async (page: number = 1, append: boolean = false) => {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
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
    toast.error('게시글 목록을 불러오는데 실패했습니다')
    console.error('Failed to fetch posts:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (!loadingMore.value && hasMore.value) {
    fetchPosts(currentPage.value + 1, true)
  }
}

// 무한 스크롤 설정
const { observerTarget } = useInfiniteScroll({
  onLoadMore: loadMore,
  enabled: () => hasMore.value && !loading.value && !loadingMore.value,
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
  fetchPosts()
})
</script>

<style scoped>
.blog {
  width: 100%;
}
</style>
