<template>
  <div class="min-h-screen bg-background font-inter">
    <!-- Loading State -->
    <LoadingSpinner v-if="loading" message="게시글을 불러오는 중..." class="py-32" />

    <!-- Error State -->
    <div v-else-if="error" class="pt-20 max-w-article mx-auto px-6 py-24 text-center">
      <span class="material-symbols-outlined text-text-desc text-8xl mb-6">error</span>
      <h2 class="text-3xl font-bold text-text-main mb-4">글을 불러올 수 없습니다</h2>
      <p class="text-text-sub mb-8">{{ error }}</p>
      <button
        class="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-blue-600 transition-all"
        @click="router.push('/blog')"
      >
        목록으로 돌아가기
      </button>
    </div>

    <!-- Post Content -->
    <main v-else-if="post" class="pt-16">
      <!-- Hero Image -->
      <BlogDetailHero :image="post.image" :title="post.title" />

      <!-- Article Content -->
      <article class="max-w-article mx-auto px-6 py-16 md:py-24">
        <!-- Header with meta info -->
        <BlogDetailHeader
          :title="post.title"
          :category="post.category"
          :author="'Admin'"
          :created-at="post.createdAt"
          @share="handleShare"
          @bookmark="handleBookmark"
        />

        <!-- Markdown Content -->
        <BlogDetailContent :content="post.content" />

        <!-- Tags -->
        <BlogDetailTags :tags="postTags" />
      </article>

      <!-- Related Articles -->
      <RelatedArticles :articles="relatedPosts" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { postsAPI } from '@/api'
import type { Post } from '@/types'
import { useToast } from '@/composables/useToast'
import { useSEO } from '@/composables/useSEO'
import { getImageUrl } from '@/utils/image'

// Components
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BlogDetailHero from '@/components/blog/BlogDetailHero.vue'
import BlogDetailHeader from '@/components/blog/BlogDetailHeader.vue'
import BlogDetailContent from '@/components/blog/BlogDetailContent.vue'
import BlogDetailTags from '@/components/blog/BlogDetailTags.vue'
import RelatedArticles from '@/components/blog/RelatedArticles.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const { setMeta } = useSEO()

const loading = ref(false)
const error = ref('')
const post = ref<Post | null>(null)
const relatedPosts = ref<Post[]>([])

// Computed: Generate tags from category
const postTags = computed(() => {
  if (!post.value) return []
  const baseTags = ['#' + post.value.category.replace(/\s+/g, '')]
  // Add some default tags
  return [...baseTags, '#Innovation', '#Technology', '#Lighting']
})

const fetchPost = async (): Promise<void> => {
  try {
    loading.value = true
    error.value = ''

    const postId = route.params.id as string
    const { data } = await postsAPI.getOne(postId)

    post.value = data
    setPostSeo(data)

    // Fetch related posts
    await fetchRelatedPosts()
  } catch (err) {
    console.error('Failed to fetch post:', err)
    const axiosError = err as { response?: { data?: { message?: string } } }
    error.value = axiosError.response?.data?.message || '게시글을 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
}

const setPostSeo = (postData: Post): void => {
  const canonicalUrl = `${window.location.origin}/blog/${postData.id}`
  const imageUrl = postData.image ? getImageUrl(postData.image) : `${window.location.origin}/images/og-image.jpg`

  setMeta({
    title: `${postData.title} | 회사 소식 | (주)디에프코리아`,
    description: postData.excerpt,
    keywords: `${postData.category}, LED 조명, 디에프코리아, ${postData.title}`,
    ogImage: imageUrl,
    ogType: 'article',
    canonicalUrl,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: postData.title,
      description: postData.excerpt,
      image: imageUrl,
      url: canonicalUrl,
      datePublished: postData.createdAt,
      dateModified: postData.updatedAt || postData.createdAt,
      author: {
        '@type': 'Organization',
        name: '(주)디에프코리아',
      },
      publisher: {
        '@type': 'Organization',
        name: '(주)디에프코리아',
        logo: {
          '@type': 'ImageObject',
          url: `${window.location.origin}/images/logo.svg`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
    },
  })
}

const fetchRelatedPosts = async (): Promise<void> => {
  try {
    const { data } = await postsAPI.getAll()
    // Filter out current post and limit to 2
    relatedPosts.value = data.filter((p: Post) => p.id !== post.value?.id).slice(0, 2)
  } catch (err) {
    console.error('Failed to fetch related posts:', err)
    // Don't show error for related posts
  }
}

const handleShare = (): void => {
  if (navigator.share && post.value) {
    navigator
      .share({
        title: post.value.title,
        text: post.value.excerpt,
        url: window.location.href,
      })
      .then(() => toast.success('공유되었습니다'))
      .catch(() => {
        // Fallback: copy to clipboard
        copyToClipboard()
      })
  } else {
    copyToClipboard()
  }
}

const copyToClipboard = (): void => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => toast.success('링크가 클립보드에 복사되었습니다'))
    .catch(() => toast.error('링크 복사에 실패했습니다'))
}

const handleBookmark = (): void => {
  toast.success('북마크에 추가되었습니다')
  // TODO: Implement bookmark functionality
}

onMounted(() => {
  fetchPost()
})
</script>

<style scoped>
.max-w-article {
  max-width: 720px;
}
</style>
