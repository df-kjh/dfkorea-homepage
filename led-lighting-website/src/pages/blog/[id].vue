<template>
  <div class="min-h-screen bg-background font-inter">
    <main v-if="post" class="pt-16">
      <BlogDetailHero :image="heroImage" :title="post.title" />

      <article class="max-w-article mx-auto px-6 py-16 md:py-24">
        <BlogDetailHeader
          :title="post.title"
          :category="post.category"
          :author="'Admin'"
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
import { computed } from "vue";
import type { Post } from "@/types";
import BlogDetailHero from "@/components/blog/BlogDetailHero.vue";
import BlogDetailHeader from "@/components/blog/BlogDetailHeader.vue";
import BlogDetailTags from "@/components/blog/BlogDetailTags.vue";
import RelatedArticles from "@/components/blog/RelatedArticles.vue";
import { useToast } from "@/composables/useToast";
import {
  COMPANY_NAME,
  normalizeBaseUrl,
  renderMarkdown,
  stripMarkdown,
  toAbsoluteAssetUrl,
} from "@/utils/seo";

const route = useRoute();
const config = useRuntimeConfig();
const toast = useToast();
const postId = route.params.id as string;
const apiBaseUrl = normalizeBaseUrl(String(config.public.apiBaseUrl));
const siteUrl = normalizeBaseUrl(String(config.public.siteUrl));
const assetUrlOptions = { apiBaseUrl, siteUrl };

const { data: post, error } = await useFetch<Post>(`${apiBaseUrl}/posts/${postId}`, {
  key: `post-${postId}`,
});

if (error.value || !post.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "게시글을 찾을 수 없습니다.",
  });
}

const { data: allPosts } = await useFetch<Post[]>(`${apiBaseUrl}/posts`, {
  key: "posts-related",
  default: () => [],
});

const canonicalUrl = computed(() => `${siteUrl}/blog/${post.value!.id}`);
const heroImage = computed(() => toAbsoluteAssetUrl(post.value?.image, assetUrlOptions));
const renderedContent = computed(() => renderMarkdown(post.value?.content || ""));

const relatedPosts = computed(() =>
  (allPosts.value || [])
    .filter((item) => item.id !== post.value?.id)
    .slice(0, 2)
    .map((item) => ({
      ...item,
      image: toAbsoluteAssetUrl(item.image, assetUrlOptions),
    })),
);

const postTags = computed(() => {
  if (!post.value) return [];
  return [`#${post.value.category.replace(/\s+/g, "")}`, "#Innovation", "#Technology", "#Lighting"];
});

useSeoMeta({
  title: () => `${post.value!.title} | 회사 소식 | ${COMPANY_NAME}`,
  description: () => post.value!.excerpt,
  keywords: () => `${post.value!.category}, LED 조명, 디에프코리아, ${post.value!.title}`,
  ogTitle: () => post.value!.title,
  ogDescription: () => post.value!.excerpt,
  ogType: "article",
  ogUrl: () => canonicalUrl.value,
  ogImage: () => heroImage.value,
  twitterCard: "summary_large_image",
  twitterTitle: () => post.value!.title,
  twitterDescription: () => post.value!.excerpt,
  twitterImage: () => heroImage.value,
});

useHead({
  link: [
    {
      rel: "canonical",
      href: canonicalUrl,
    },
  ],
  script: [
    {
      type: "application/ld+json",
      children: computed(() =>
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.value!.title,
          description: post.value!.excerpt,
          image: heroImage.value,
          url: canonicalUrl.value,
          datePublished: post.value!.createdAt,
          dateModified: post.value!.updatedAt || post.value!.createdAt,
          articleBody: stripMarkdown(post.value!.content),
          author: {
            "@type": "Organization",
            name: COMPANY_NAME,
          },
          publisher: {
            "@type": "Organization",
            name: COMPANY_NAME,
            logo: {
              "@type": "ImageObject",
              url: `${siteUrl}/images/logo.svg`,
            },
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": canonicalUrl.value,
          },
        }),
      ),
    },
  ],
});

const handleShare = (): void => {
  if (!import.meta.client || !post.value) return;

  if (navigator.share) {
    navigator
      .share({
        title: post.value.title,
        text: post.value.excerpt,
        url: canonicalUrl.value,
      })
      .then(() => toast.success("공유되었습니다"))
      .catch(() => copyToClipboard());
  } else {
    copyToClipboard();
  }
};

const copyToClipboard = (): void => {
  navigator.clipboard
    .writeText(canonicalUrl.value)
    .then(() => toast.success("링크가 클립보드에 복사되었습니다"))
    .catch(() => toast.error("링크 복사에 실패했습니다"));
};

const handleBookmark = (): void => {
  toast.success("북마크에 추가되었습니다");
};
</script>

<style scoped>
.max-w-article {
  max-width: 720px;
}

.article-content :deep(p) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px];
}

.article-content :deep(h2) {
  @apply text-text-main text-3xl font-bold mt-14 mb-6 tracking-tight;
}

.article-content :deep(h3) {
  @apply text-text-main text-2xl font-bold mt-10 mb-4 tracking-tight;
}

.article-content :deep(ul) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px] pl-6 list-disc;
}

.article-content :deep(li) {
  @apply mb-3;
}

.article-content :deep(strong) {
  @apply text-text-main font-semibold;
}
</style>
