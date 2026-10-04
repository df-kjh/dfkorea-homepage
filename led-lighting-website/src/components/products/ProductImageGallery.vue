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
  <div class="df-product-gallery">
    <div>
      <button
        type="button"
        class="df-gallery-image df-gallery-image--main"
        :aria-label="`${productName} 이미지 크게 보기`"
        @click="handleImageClick(mainImage, 0)"
      >
        <img :src="mainImage" :alt="productName" /><span aria-hidden="true">↗</span>
      </button>
      <p v-if="mainImageDescription" class="df-image-description">{{ mainImageDescription }}</p>
    </div>
    <div v-if="thumbnailImages.length" class="df-gallery-thumbnails">
      <div v-for="(thumbnail, index) in thumbnailImages" :key="thumbnail.url">
        <button
          type="button"
          class="df-gallery-image"
          :aria-label="`${thumbnail.alt} 크게 보기`"
          @click="handleImageClick(thumbnail.url, index + 1)"
        >
          <img :src="thumbnail.url" :alt="thumbnail.alt" />
        </button>
        <p v-if="thumbnail.description" class="df-image-description">{{ thumbnail.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.df-product-gallery {
  min-width: 0;
}
.df-gallery-image {
  display: block;
  position: relative;
  width: 100%;
  padding: 0;
  border: 0;
  background: #fff;
  overflow: hidden;
  cursor: zoom-in;
}
.df-gallery-image img {
  display: block;
  width: 100%;
  height: auto;
}
.df-gallery-image--main span {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid #d6cbbb;
  border-radius: 50%;
  color: #877761;
  background: #fff;
  font-size: 20px;
}
.df-image-description {
  font-size: 11px;
  line-height: 1.75;
  color: #8a7b66;
  text-align: center;
  margin-top: 12px;
}
.df-gallery-thumbnails {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin-top: 28px;
}
.df-gallery-image:focus-visible {
  outline: 2px solid #9b793f;
  outline-offset: 4px;
}
@media (max-width: 640px) {
  .df-gallery-thumbnails {
    gap: 14px;
    margin-top: 21px;
  }
}
</style>
