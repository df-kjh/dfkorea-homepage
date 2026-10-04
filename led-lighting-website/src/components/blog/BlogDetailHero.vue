<template>
  <figure class="df-article-hero">
    <img v-if="image" :src="image" :alt="title" />
    <div v-else class="df-article-hero__empty"><span>DF KOREA</span><span>NEWSROOM</span></div>
  </figure>
</template>
<script setup lang="ts">
defineProps<{
  image?: string
  title: string
}>()
</script>

<style scoped>
.df-article-hero {
  max-width: 1280px;
  margin: 32px auto 0;
  aspect-ratio: 2.2;
  overflow: hidden;
  background: #e1d8c6;
}
.df-article-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.df-article-hero__empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 35px;
  color: #a38c63;
  font-size: 14px;
  letter-spacing: 0.18em;
}
@media (max-width: 640px) {
  .df-article-hero {
    margin-top: 23px;
    aspect-ratio: 1.5;
  }
  .df-article-hero__empty {
    gap: 16px;
    font-size: 10px;
  }
}
</style>
