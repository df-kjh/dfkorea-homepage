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
  color: #a18b66;
  font-size: 11px;
  line-height: 1.8;
}
.df-article-tags span {
  overflow-wrap: anywhere;
}
</style>
