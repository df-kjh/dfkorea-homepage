<template>
  <header class="mb-12">
    <!-- Category Badge -->
    <div class="flex items-center gap-2 mb-6">
      <span
        class="bg-primary/10 text-primary text-[13px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
      >
        {{ category }}
      </span>
    </div>

    <!-- Title -->
    <h1
      class="text-4xl md:text-5xl font-extrabold text-text-main leading-[1.15] tracking-tight mb-8"
    >
      {{ title }}
    </h1>

    <!-- Meta Information -->
    <div class="flex items-center justify-between border-y border-gray-200 py-6">
      <!-- Author Info -->
      <div class="flex items-center gap-4">
        <div
          class="size-12 rounded-full bg-surface overflow-hidden flex items-center justify-center"
        >
          <span class="material-symbols-outlined text-text-sub text-2xl">person</span>
        </div>
        <div class="flex flex-col">
          <span class="text-base font-bold text-text-main">{{ author }}</span>
          <span class="text-sm text-text-desc">{{ formattedDate }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          class="p-2 hover:bg-surface rounded-full transition-colors text-text-sub"
          @click="handleShare"
          aria-label="공유하기"
        >
          <span class="material-symbols-outlined">share</span>
        </button>
        <button
          class="p-2 hover:bg-surface rounded-full transition-colors text-text-sub"
          @click="handleBookmark"
          aria-label="북마크"
        >
          <span class="material-symbols-outlined">bookmark</span>
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
