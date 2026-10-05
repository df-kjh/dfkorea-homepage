<template>
  <header class="df-article-heading">
    <p class="df-article-category">{{ category }}</p>
    <h1>{{ title }}</h1>
    <div class="df-article-meta">
      <div>
        <span>{{ author }}</span
        ><time :datetime="createdAt">{{ formattedDate }}</time>
      </div>
      <div class="df-article-actions">
        <button type="button" @click="handleShare" aria-label="공유하기">
          <span class="material-symbols-outlined" aria-hidden="true">share</span></button
        ><button type="button" @click="handleBookmark" aria-label="북마크" title="북마크 안내">
          <span class="material-symbols-outlined" aria-hidden="true">bookmark</span>
        </button>
      </div>
    </div>
  </header>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  category: string
  author?: string
  createdAt: string
}>()

const emit = defineEmits<{
  share: []
  bookmark: []
}>()

const formattedDate = computed(() => {
  const date = new Date(props.createdAt)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const handleShare = () => {
  emit('share')
}

const handleBookmark = () => {
  emit('bookmark')
}
</script>

<style scoped>
.df-article-heading {
  margin-bottom: 45px;
}
.df-article-category {
  letter-spacing: 0.04em;
  margin-bottom: 24px;
  font-size: var(--df-font-label, 14px);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
.df-article-heading h1 {
  font-size: clamp(34px, 4vw, 57px);
  line-height: 1.28;
  letter-spacing: -0.06em;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.df-article-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  margin-top: 32px;
  padding: 20px 0;
  border-top: 1px solid #d8ccb6;
  border-bottom: 1px solid #d8ccb6;
  flex-wrap: wrap;
}
.df-article-meta > div:first-child {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  line-height: 1.8;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
  min-width: 0;
  overflow-wrap: anywhere;
}
.df-article-meta time {
  color: var(--df-muted, #625f50);
}
.df-article-actions {
  display: flex;
  gap: 8px;
}
.df-article-actions button {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  border: 1px solid #d8ccb6;
  border-radius: 50%;
  background: transparent;
  color: #897452;
}
.df-article-actions button:hover {
  background: #e6daca;
}
.df-article-actions button:focus-visible {
  outline: 2px solid #987540;
  outline-offset: 4px;
}
.df-article-actions span {
  font-size: 18px;
}
@media (max-width: 640px) {
  .df-article-heading h1 {
    font-size: 32px;
  }
  .df-article-heading {
    margin-bottom: 30px;
  }
  .df-article-meta {
    margin-top: 25px;
    padding-block: 15px;
  }
  .df-article-meta > div:first-child {
    gap: 7px;
    flex-direction: column;
  }
}
</style>
