<script setup lang="ts">
interface Props {
  imagePath: string
  title: string
  alt?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div
    class="p-6 bg-surface rounded-2xl transition-transform hover:scale-[1.02] duration-300 flex flex-col items-center"
  >
    <div class="w-20 h-20 mb-4 flex items-center justify-center">
      <img
        :src="imagePath"
        :alt="alt || title"
        class="w-full h-full object-contain"
        loading="lazy"
      />
    </div>
    <h3 class="text-text-main font-bold text-base mb-2 text-center">{{ props.title }}</h3>
  </div>
</template>
