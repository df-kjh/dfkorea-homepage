<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Latest News',
  subtitle:
    'Stay updated with the latest breakthroughs in LED technology, design awards, and our journey toward sustainability.',
})
</script>

<template>
  <header class="px-6 md:px-12 mb-12">
    <h1 class="text-4xl md:text-5xl font-bold text-text-main tracking-tight">{{ title }}</h1>
    <p class="text-text-sub mt-4 text-lg max-w-2xl">{{ subtitle }}</p>
  </header>
</template>
