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
}
.df-related-heading p {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: #a28a63;
  margin-bottom: 17px;
}
.df-related-heading h2 {
  font-size: 30px;
  font-weight: 500;
  letter-spacing: -0.04em;
}
.df-related-heading > a {
  font-size: 11px;
  color: #8e7450;
  border-bottom: 1px solid #bfab88;
  padding-block: 10px;
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
  font-size: 12px;
  letter-spacing: 0.14em;
}
.df-related-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.df-related-grid p {
  font-size: 10px;
  color: #a38c66;
  margin-top: 18px;
}
.df-related-grid h3 {
  font-size: 22px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.04em;
  margin-top: 10px;
  overflow-wrap: anywhere;
}
.df-related-grid time {
  display: block;
  font-size: 10px;
  color: #9b8b72;
  margin-top: 12px;
}
.df-related-empty {
  padding: 40px 0;
  color: #95866e;
  font-size: 13px;
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
