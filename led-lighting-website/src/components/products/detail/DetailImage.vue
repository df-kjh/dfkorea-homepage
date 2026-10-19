<script setup lang="ts">
import type { ProductDetailImage } from '@/types'
withDefaults(defineProps<{ image: ProductDetailImage; preview?: boolean; caption?: boolean }>(), {
  preview: false,
  caption: true,
})
const emit = defineEmits<{ zoom: [url: string] }>()
</script>
<template>
  <figure class="detail-image">
    <button
      type="button"
      data-image
      :disabled="preview"
      :aria-label="`${image.alt || '제품 사진'} 크게 보기`"
      @click="!preview && emit('zoom', image.url)"
    >
      <img :src="image.url" :alt="image.alt" loading="lazy" /><span
        v-if="!preview"
        aria-hidden="true"
        >↗</span
      >
    </button>
    <figcaption v-if="caption && image.caption">{{ image.caption }}</figcaption>
  </figure>
</template>
