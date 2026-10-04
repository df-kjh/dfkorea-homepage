<script setup lang="ts">
import PublicPageHeader from '@/components/common/site/PublicPageHeader.vue'
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
  <PublicPageHeader eyebrow="DF KOREA NEWSROOM" :title="title" :description="subtitle" index="04" />
</template>
<style scoped></style>
