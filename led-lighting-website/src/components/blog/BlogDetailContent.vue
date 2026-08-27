<template>
  <div class="article-content">
    <MdPreview :model-value="content" language="ko-KR" theme="light" />
  </div>
</template>

<script setup lang="ts">
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'

defineProps<{
  content: string
}>()
</script>

<style scoped>
.article-content :deep(p) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px];
}

.article-content :deep(h2) {
  @apply text-text-main text-3xl font-bold mt-14 mb-6 tracking-tight;
}

.article-content :deep(h3) {
  @apply text-text-main text-2xl font-bold mt-10 mb-4 tracking-tight;
}

.article-content :deep(img) {
  @apply rounded-3xl my-14 shadow-sm;
}

.article-content :deep(blockquote) {
  @apply my-14 bg-surface rounded-[32px] p-10 md:p-14 border border-gray-200;
  @apply text-2xl md:text-3xl font-semibold text-text-main leading-snug italic;
}

.article-content :deep(code) {
  @apply bg-surface px-2 py-1 rounded text-sm font-mono;
}

.article-content :deep(pre) {
  @apply bg-surface p-6 rounded-2xl overflow-x-auto my-8;
}

.article-content :deep(ul),
.article-content :deep(ol) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px] pl-6;
}

.article-content :deep(li) {
  @apply mb-3;
}

.article-content :deep(a) {
  @apply text-primary hover:underline;
}
</style>
