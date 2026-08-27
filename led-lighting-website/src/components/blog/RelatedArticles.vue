<template>
  <section class="bg-surface py-20">
    <div class="max-w-article mx-auto px-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-10">
        <h3 class="text-2xl font-bold text-text-main">{{ title }}</h3>
        <router-link
          to="/blog"
          class="text-primary font-bold text-sm flex items-center gap-1 group"
        >
          View all news
          <span
            class="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform"
          >
            arrow_forward
          </span>
        </router-link>
      </div>

      <!-- Related Posts Grid -->
      <div class="grid md:grid-cols-2 gap-8">
        <router-link
          v-for="article in articles"
          :key="article.id"
          :to="`/blog/${article.id}`"
          class="flex flex-col gap-4 group"
        >
          <!-- Image -->
          <div class="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-white">
            <img
              v-if="article.image"
              :src="article.image"
              :alt="article.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div
              v-else
              class="w-full h-full bg-gradient-to-br from-primary/10 to-surface flex items-center justify-center"
            >
              <span class="material-symbols-outlined text-primary text-5xl">article</span>
            </div>
          </div>

          <!-- Content -->
          <div class="flex flex-col gap-2">
            <span class="text-[11px] font-bold text-primary tracking-widest uppercase">
              {{ article.category }}
            </span>
            <h4
              class="text-xl font-bold text-text-main leading-tight group-hover:text-primary transition-colors line-clamp-2"
            >
              {{ article.title }}
            </h4>
            <span class="text-sm text-text-desc">{{ formatDate(article.createdAt) }}</span>
          </div>
        </router-link>
      </div>

      <!-- Empty State -->
      <div v-if="articles.length === 0" class="text-center py-12">
        <span class="material-symbols-outlined text-text-desc text-6xl mb-4">article</span>
        <p class="text-text-sub">관련 글이 없습니다</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Post } from '@/types'

withDefaults(
  defineProps<{
    title?: string
    articles: Post[]
  }>(),
  {
    title: 'Related Articles',
  },
)

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>
