<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProductGalleryImage } from '@/types/product-gallery'

interface Props {
  image: ProductGalleryImage | null
  title: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const isBodyScrollLocked = ref(false)
const previousBodyOverflow = ref('')

const close = () => {
  emit('close')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.image) {
    close()
  }
}

watch(
  () => props.image,
  (image) => {
    if (!import.meta.client) return

    if (image && !isBodyScrollLocked.value) {
      previousBodyOverflow.value = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      isBodyScrollLocked.value = true
      return
    }

    if (!image && isBodyScrollLocked.value) {
      document.body.style.overflow = previousBodyOverflow.value
      isBodyScrollLocked.value = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (isBodyScrollLocked.value) {
    document.body.style.overflow = previousBodyOverflow.value
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="image"
      class="fixed inset-0 z-[9999] bg-black/90 flex flex-col"
      role="dialog"
      aria-modal="true"
      :aria-label="`${title} 이미지 크게 보기`"
      @click.self="close"
    >
      <div class="flex items-center justify-between gap-4 px-4 py-3 md:px-6 text-white">
        <p class="text-sm md:text-base font-medium truncate">
          {{ image.alt }}
        </p>
        <button
          type="button"
          class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="이미지 상세보기 닫기"
          @click="close"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>

      <div class="flex-1 min-h-0 flex items-center justify-center px-4 pb-6 md:px-8">
        <img :src="image.url" :alt="image.alt" class="max-w-full max-h-full object-contain" />
      </div>

      <p v-if="image.description" class="px-4 pb-5 text-center text-sm md:text-base text-white/80">
        {{ image.description }}
      </p>
    </div>
  </Teleport>
</template>
