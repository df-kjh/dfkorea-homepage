<template>
  <div class="w-full h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden bg-surface">
    <img v-if="image" :src="image" :alt="title" class="w-full h-full object-cover" />
    <div
      v-else
      class="w-full h-full bg-gradient-to-br from-primary/10 to-surface flex items-center justify-center"
    >
      <span class="material-symbols-outlined text-primary text-8xl">article</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  image?: string
  title: string
}>()
</script>
