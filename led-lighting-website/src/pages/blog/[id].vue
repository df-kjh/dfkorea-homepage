<template>
  <div class="df-news-detail">
    <main v-if="post" class="df-news-detail-main">
      <div class="df-article-top">
        <PublicAction to="/blog" variant="text"
          >소식 목록으로 <span aria-hidden="true">↖</span></PublicAction
        >
      </div>
      <BlogDetailHero :image="heroImage" :title="post.title" />
      <article class="df-article">
        <BlogDetailHeader
          :title="post.title"
          :category="post.category"
          :author="'DF KOREA'"
          :created-at="post.createdAt"
          @share="handleShare"
          @bookmark="handleBookmark"
        />
        <div class="article-content" v-html="renderedContent"></div>
        <BlogDetailTags :tags="postTags" />
      </article>
      <RelatedArticles :articles="relatedPosts" />
    </main>
  </div>
</template>
<script setup lang="ts">
import PublicAction from '@/components/common/site/PublicAction.vue'
import { computed } from 'vue'
import type { Post } from '@/types'
import BlogDetailHero from '@/components/blog/BlogDetailHero.vue'
import BlogDetailHeader from '@/components/blog/BlogDetailHeader.vue'
import BlogDetailTags from '@/components/blog/BlogDetailTags.vue'
import RelatedArticles from '@/components/blog/RelatedArticles.vue'
import { useToast } from '@/composables/useToast'
import {
  COMPANY_NAME,
  normalizeBaseUrl,
  renderMarkdown,
  stripMarkdown,
  toAbsoluteAssetUrl,
} from '@/utils/seo'

const route = useRoute()
const config = useRuntimeConfig()
const toast = useToast()
const postId = route.params.id as string
const apiBaseUrl = normalizeBaseUrl(String(config.public.apiBaseUrl))
const siteUrl = normalizeBaseUrl(String(config.public.siteUrl))
const assetUrlOptions = { apiBaseUrl, siteUrl }

const { data: post, error } = await useFetch<Post>(`${apiBaseUrl}/posts/${postId}`, {
  key: `post-${postId}`,
})

if (error.value || !post.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '게시글을 찾을 수 없습니다.',
  })
}

const { data: allPosts } = await useFetch<Post[]>(`${apiBaseUrl}/posts`, {
  key: 'posts-related',
  default: () => [],
})

const canonicalUrl = computed(() => `${siteUrl}/blog/${post.value!.id}`)
const heroImage = computed(() => toAbsoluteAssetUrl(post.value?.image, assetUrlOptions))
const renderedContent = computed(() => renderMarkdown(post.value?.content || ''))

const relatedPosts = computed(() =>
  (allPosts.value || [])
    .filter((item) => item.id !== post.value?.id)
    .slice(0, 2)
    .map((item) => ({
      ...item,
      image: toAbsoluteAssetUrl(item.image, assetUrlOptions),
    })),
)

const postTags = computed(() => {
  if (!post.value) return []
  return [`#${post.value.category.replace(/\s+/g, '')}`, '#Innovation', '#Technology', '#Lighting']
})

useHead({
  meta: [
    {
      name: 'keywords',
      content: () => `${post.value!.category}, LED 조명, 디에프코리아, ${post.value!.title}`,
    },
  ],
})

useSeoMeta({
  title: () => `${post.value!.title} | 회사 소식 | ${COMPANY_NAME}`,
  description: () => post.value!.excerpt,
  ogTitle: () => post.value!.title,
  ogDescription: () => post.value!.excerpt,
  ogType: 'article',
  ogUrl: () => canonicalUrl.value,
  ogImage: () => heroImage.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => post.value!.title,
  twitterDescription: () => post.value!.excerpt,
  twitterImage: () => heroImage.value,
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.value!.title,
          description: post.value!.excerpt,
          image: heroImage.value,
          url: canonicalUrl.value,
          datePublished: post.value!.createdAt,
          dateModified: post.value!.updatedAt || post.value!.createdAt,
          articleBody: stripMarkdown(post.value!.content),
          author: {
            '@type': 'Organization',
            name: COMPANY_NAME,
          },
          publisher: {
            '@type': 'Organization',
            name: COMPANY_NAME,
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/images/logo.svg`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': canonicalUrl.value,
          },
        }),
      ),
    },
  ],
})

const handleShare = (): void => {
  if (!import.meta.client || !post.value) return

  if (navigator.share) {
    navigator
      .share({
        title: post.value.title,
        text: post.value.excerpt,
        url: canonicalUrl.value,
      })
      .then(() => toast.success('공유되었습니다'))
      .catch(() => copyToClipboard())
  } else {
    copyToClipboard()
  }
}

const copyToClipboard = (): void => {
  navigator.clipboard
    .writeText(canonicalUrl.value)
    .then(() => toast.success('링크가 클립보드에 복사되었습니다'))
    .catch(() => toast.error('링크 복사에 실패했습니다'))
}

const handleBookmark = (): void => {
  toast.success('북마크에 추가되었습니다')
}
</script>

<style scoped>
.df-news-detail {
  min-height: 100vh;
  background: #f0ece3;
  color: #29251e;
}
.df-news-detail-main {
  padding-top: 118px;
}
.df-article-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: 1280px;
  margin: auto;
  padding: 0 24px;
}
.df-article {
  max-width: 800px;
  margin: auto;
  padding: 58px 24px 70px;
}
.article-content :deep(p) {
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  line-height: 2;
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
  margin-bottom: 26px;
}
.article-content :deep(h1),
.article-content :deep(h2) {
  font-size: 29px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: -0.045em;
  margin: 38px 0 20px;
  overflow-wrap: anywhere;
}
.article-content :deep(h3) {
  font-size: 23px;
  font-weight: 600;
  margin: 30px 0 16px;
  overflow-wrap: anywhere;
}
.article-content :deep(ul),
.article-content :deep(ol) {
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
  line-height: 1.9;
  padding-left: 23px;
  margin-bottom: 25px;
}
.article-content :deep(li) {
  margin-bottom: 10px;
}
.article-content :deep(strong) {
  color: #393124;
}
.article-content :deep(img) {
  max-width: 100%;
  height: auto;
}
.article-content {
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  overflow-wrap: anywhere;
}
.article-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre;
}
.article-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  font-size: var(--df-font-body, 16px);
}
.article-content :deep(th),
.article-content :deep(td) {
  padding: 10px 12px;
  white-space: normal;
}
.article-content :deep(a) {
  color: #946d31;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
@media (max-width: 800px) {
  .df-news-detail-main {
    padding-top: 106px;
  }
}
@media (max-width: 640px) {
  .df-article {
    padding: 36px 24px 45px;
  }
  .article-content :deep(h2) {
    font-size: 24px;
  }
}
</style>
