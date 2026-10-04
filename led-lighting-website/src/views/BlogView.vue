<template>
  <div class="blog">
    <main class="df-news-main">
      <BlogHeader
        title="빛을 만드는 이야기."
        subtitle="디에프코리아의 제품과 회사 소식을 전합니다."
      /><CategoryFilter
        :categories="categories"
        :selected-category="selectedCategory"
        @category-change="handleCategoryChange"
      />
      <div class="df-news-count">
        <span>{{
          selectedCategory === '전체'
            ? `전체 게시글 ${totalPosts}개`
            : `불러온 게시글 중 ${filteredPosts.length}개`
        }}</span>
        <p v-if="selectedCategory !== '전체'">현재 불러온 게시글에서 분류합니다.</p>
      </div>
      <div v-if="fetchError && !loading" class="df-news-state" role="alert">
        <p>게시글을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>
        <BaseButton @click="fetchPosts()">다시 시도</BaseButton>
      </div>
      <LoadingSpinner
        v-else-if="loading && !refreshingSeed"
        message="게시글 목록을 불러오는 중..."
        class="py-20"
      /><EmptyState
        v-else-if="filteredPosts.length === 0"
        description="검색 결과가 없습니다"
        class="py-20"
      /><template v-else
        ><BlogGrid :posts="displayedPosts" @post-click="viewPost" />
        <div v-if="loadingMore" class="df-news-append">
          <LoadingSpinner message="게시글을 더 불러오는 중..." />
        </div>
        <div v-if="hasMore && !loading" ref="observerTarget" class="h-4"></div
      ></template>
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
/* The routed list supplies its own container/inset; avoid nesting the global page inset. */
.df-news-main :deep(.public-page-header) {
  padding: 0 0 43px;
}
.df-news-main :deep(.public-container) {
  padding-inline: 0;
}

.blog {
  width: 100%;
  background: #f0ece3;
  color: #29251e;
}
.df-news-main {
  max-width: 1360px;
  margin: auto;
  padding: 120px 40px 90px;
}
.df-news-count {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin: 23px 0 37px;
  font-size: 11px;
  color: #99886c;
  line-height: 1.8;
}
.df-news-state {
  text-align: center;
  padding: 65px 25px;
  background: #e6dece;
  line-height: 1.9;
}
.df-news-state button {
  margin-top: 20px;
}
.df-news-append {
  padding: 35px 0;
}
@media (max-width: 800px) {
  .df-news-main {
    padding: 108px 24px 50px;
  }
}
@media (max-width: 640px) {
  .df-news-count {
    display: block;
    margin-bottom: 27px;
  }
  .df-news-count p {
    margin-top: 6px;
  }
}
@media (max-width: 350px) {
  .df-news-main {
    padding-inline: 20px;
  }
}
</style>
