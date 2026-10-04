<script setup lang="ts">
import BlogCard from './BlogCard.vue'
import type { Post } from '@/types'
defineProps<{ posts: Post[]; loading?: boolean }>()
const emit = defineEmits<{ postClick: [post: Post] }>()
const handlePostClick = (post: Post) => emit('postClick', post)
</script>
<template>
  <div class="df-news-grid">
    <article v-for="post in posts" :key="post.id">
      <BlogCard :post="post" @click="handlePostClick" />
    </article>
  </div>
</template>
<style scoped>
.df-news-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 55px 36px;
}
.df-news-grid article {
  min-width: 0;
}
@media (max-width: 640px) {
  .df-news-grid {
    grid-template-columns: 1fr;
    gap: 39px;
  }
}
</style>
