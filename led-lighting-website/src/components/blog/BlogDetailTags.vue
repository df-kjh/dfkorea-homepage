<template>
  <div class="flex flex-wrap gap-2 mt-16 pt-8 border-t border-gray-200">
    <span
      v-for="tag in tags"
      :key="tag"
      class="px-5 py-2 bg-surface text-text-sub text-[13px] font-medium rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
    >
      {{ tag }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tags: string[]
}>()
</script>
