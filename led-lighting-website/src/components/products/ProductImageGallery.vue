<script setup lang="ts">
import { computed } from 'vue'
import type { ProductGalleryImage } from '@/types/product-gallery'

interface Props {
  mainImage: string
  images?: ProductGalleryImage[]
  productName: string
}

const props = withDefaults(defineProps<Props>(), {
  images: () => [],
})

const emit = defineEmits<{
  imageClick: [url: string, index: number]
}>()

const mainImageDescription = computed(() => props.images[0]?.description)
const thumbnailImages = computed(() => props.images.slice(1))

const handleImageClick = (url: string, index: number) => {
  emit('imageClick', url, index)
}
</script>

<template>
  <div class="lg:col-span-7 space-y-8">
    <div class="space-y-3">
      <div
        class="w-full aspect-[4/5] rounded-3xl overflow-hidden bg-white cursor-pointer border border-divider"
        @click="handleImageClick(mainImage, 0)"
      >
        <img :src="mainImage" :alt="productName" class="w-full h-full object-contain" />
      </div>
      <p v-if="mainImageDescription" class="text-sm text-center text-text-sub">
        {{ mainImageDescription }}
      </p>
    </div>

    <div v-if="thumbnailImages.length > 0" class="grid grid-cols-2 gap-8">
      <div
        v-for="(thumbnail, index) in thumbnailImages"
        :key="thumbnail.url"
        class="flex flex-col gap-2"
      >
        <div
          class="aspect-square bg-white rounded-3xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-divider"
          @click="handleImageClick(thumbnail.url, index + 1)"
        >
          <img :src="thumbnail.url" :alt="thumbnail.alt" class="w-full h-full object-contain" />
        </div>
        <p v-if="thumbnail.description" class="text-sm text-center text-text-sub">
          {{ thumbnail.description }}
        </p>
      </div>
    </div>
  </div>
</template>
