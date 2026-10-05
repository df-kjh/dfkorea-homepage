<template>
  <section class="df-related">
    <div class="df-related-inner">
      <div class="df-related-heading">
        <div>
          <p>CONTINUE READING</p>
          <h2>{{ title }}</h2>
        </div>
        <router-link to="/blog">전체 소식 <span aria-hidden="true">↗</span></router-link>
      </div>
      <div v-if="articles.length" class="df-related-grid">
        <router-link v-for="article in articles" :key="article.id" :to="`/blog/${article.id}`"
          ><div class="df-related-image">
            <img v-if="article.image" :src="article.image" :alt="article.title" /><span
              v-else
              aria-hidden="true"
              >DF KOREA</span
            >
          </div>
          <p>{{ article.category }}</p>
          <h3>{{ article.title }}</h3>
          <time :datetime="article.createdAt">{{
            formatDate(article.createdAt)
          }}</time></router-link
        >
      </div>
      <p v-else class="df-related-empty">관련 글이 없습니다.</p>
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
    title: '이어지는 이야기.',
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

<style scoped>
.df-related {
  background: #e7dfcf;
  border-top: 1px solid #d8cbb3;
  padding: 60px 24px;
}
.df-related-inner {
  max-width: 1000px;
  margin: auto;
}
.df-related-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 25px;
  margin-bottom: 33px;
  flex-wrap: wrap;
}
.df-related-heading p {
  letter-spacing: 0.14em;
  margin-bottom: 17px;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.df-related-heading h2 {
  font-size: 30px;
  letter-spacing: -0.04em;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.df-related-heading > a {
  border-bottom: 1px solid #bfab88;
  padding-block: 10px;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
  color: var(--df-muted, #625f50);
  max-width: 100%;
  overflow-wrap: anywhere;
}
.df-related-heading > a span {
  margin-left: 25px;
}
.df-related-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 30px;
}
.df-related-grid > a {
  min-width: 0;
}
.df-related-image {
  display: grid;
  place-items: center;
  aspect-ratio: 1.6;
  background: #dcd0b9;
  overflow: hidden;
  color: #a18a64;
  letter-spacing: 0.14em;
  font-size: var(--df-font-meta, 13px);
}
.df-related-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.df-related-grid p {
  margin-top: 18px;
  font-size: var(--df-font-label, 14px);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
.df-related-grid h3 {
  font-size: 22px;
  line-height: 1.45;
  letter-spacing: -0.04em;
  margin-top: 10px;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.df-related-grid time {
  display: block;
  margin-top: 12px;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.df-related-empty {
  padding: 40px 0;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
}
@media (max-width: 640px) {
  .df-related {
    padding: 43px 24px;
  }
  .df-related-heading h2 {
    font-size: 25px;
  }
  .df-related-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}
</style>
