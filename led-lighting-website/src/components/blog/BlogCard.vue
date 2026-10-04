<script setup lang="ts">
import type { Post } from '@/types'
import { getImageUrl } from '@/utils/image'
const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ click: [post: Post] }>()
function handleClick(event: MouseEvent) {
  // Ordinary clicks keep the list's view-count/navigation event. Modified clicks
  // must keep the real href's native new-tab/window behavior without side effects.
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  emit('click', props.post)
}
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
</script>
<template>
  <NuxtLink v-slot="{ href }" custom :to="`/blog/${post.id}`"
    ><a :href="href ?? `/blog/${post.id}`" class="df-news-card" @click="handleClick"
      ><div class="df-news-image">
        <img
          v-if="post.image"
          :src="getImageUrl(post.image)"
          :alt="post.title"
          loading="lazy"
        /><span v-else class="df-news-placeholder" aria-hidden="true">DF KOREA<br />NEWSROOM</span
        ><span class="df-news-arrow" aria-hidden="true">↗</span>
      </div>
      <div class="df-news-meta">
        <span>{{ post.category }}</span
        ><time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
      </div>
      <h3>{{ post.title }}</h3>
      <p class="df-news-excerpt">{{ post.excerpt }}</p></a
    ></NuxtLink
  >
</template>
<style scoped>
.df-news-card {
  display: block;
  min-width: 0;
  color: #2b271f;
}
.df-news-image {
  aspect-ratio: 1.55;
  background: #e2dbcd;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.df-news-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.df-news-card:hover img {
  transform: scale(1.035);
}
.df-news-placeholder {
  font-size: 14px;
  letter-spacing: 0.12em;
  line-height: 2;
  color: #9f8c6b;
}
.df-news-arrow {
  position: absolute;
  bottom: 15px;
  right: 15px;
  border-radius: 50%;
  background: #f5efdfeb;
  color: #514634;
  width: 33px;
  height: 33px;
  display: grid;
  place-items: center;
  font-size: 20px;
}
.df-news-meta {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 10px;
  color: #998466;
  margin-top: 22px;
}
.df-news-meta time {
  color: #9d9381;
}
.df-news-card h3 {
  font-size: 27px;
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 1.45;
  margin-top: 14px;
  overflow-wrap: anywhere;
}
.df-news-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: #8b806d;
  font-size: 13px;
  line-height: 1.9;
  margin-top: 16px;
}
.df-news-card:focus-visible {
  outline: 2px solid #987441;
  outline-offset: 6px;
}
@media (max-width: 640px) {
  .df-news-card h3 {
    font-size: 23px;
  }
  .df-news-meta {
    margin-top: 19px;
  }
  .df-news-excerpt {
    font-size: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .df-news-image img {
    transition: none;
  }
}
</style>
