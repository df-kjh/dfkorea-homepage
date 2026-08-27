<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import type { Post } from '@/types'
import { getImageUrl } from '@/utils/image'

interface Props {
  posts: Post[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  postClick: [post: Post]
}>()

const handlePostClick = (post: Post) => {
  emit('postClick', post)
}

const getCategoryStyle = (category: string) => {
  const styles: Record<string, { bg: string; text: string }> = {
    innovation: { bg: 'bg-blue-50', text: 'text-primary' },
    event: { bg: 'bg-gray-100', text: 'text-text-sub' },
    sustainability: { bg: 'bg-green-50', text: 'text-green-600' },
    product: { bg: 'bg-blue-50', text: 'text-primary' },
  }
  return styles[category.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-text-sub' }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-16">
    <BaseCard
      v-for="post in posts"
      :key="post.id"
      :clickable="true"
      :hoverable="true"
      :body-style="{ padding: '0' }"
      class="group"
      @click="handlePostClick(post)"
    >
      <!-- Post Image -->
      <div class="aspect-[16/10] rounded-t-3xl overflow-hidden bg-surface">
        <img
          :src="getImageUrl(post.image)"
          :alt="post.title"
          class="w-full h-full object-cover transition-transform duration-500"
        />
      </div>

      <!-- Post Meta & Content -->
      <div class="flex flex-col gap-3 p-6">
        <!-- Category & Date -->
        <div class="flex items-center gap-3">
          <span
            :class="[
              'px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
              getCategoryStyle(post.category).bg,
              getCategoryStyle(post.category).text,
            ]"
          >
            {{ post.category }}
          </span>
          <time class="text-xs text-text-desc font-medium">
            {{ formatDate(post.createdAt) }}
          </time>
        </div>

        <!-- Title -->
        <h3
          class="text-2xl font-bold text-text-main leading-tight group-hover:text-primary transition-colors"
        >
          {{ post.title }}
        </h3>

        <!-- Excerpt -->
        <p class="text-[16px] text-text-sub leading-relaxed line-clamp-2">
          {{ post.excerpt }}
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
