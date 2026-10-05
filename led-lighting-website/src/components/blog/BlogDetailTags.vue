<template>
  <div class="df-article-tags" aria-label="게시글 태그">
    <span v-for="tag in tags" :key="tag">{{ tag }}</span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  tags: string[]
}>()
</script>

<style scoped>
.df-article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 45px;
  padding-top: 26px;
  border-top: 1px solid #d8ccb6;
  line-height: 1.8;
  font-size: var(--df-font-label, 14px);
  color: var(--df-muted, #625f50);
}
.df-article-tags span {
  overflow-wrap: anywhere;
  min-width: 0;
}
</style>
