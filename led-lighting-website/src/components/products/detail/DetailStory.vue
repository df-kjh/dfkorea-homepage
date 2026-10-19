<script setup lang="ts">
import type { resolveProductDetail } from './content'
import DetailHeading from './DetailHeading.vue'
import DetailImage from './DetailImage.vue'
defineProps<{
  detail: ReturnType<typeof resolveProductDetail>
  productName: string
  preview: boolean
}>()
const emit = defineEmits<{ zoom: [url: string] }>()
</script>
<template>
  <section
    v-if="detail.storyImage || detail.features.length"
    class="detail-story detail-section detail-container"
    data-section="story"
  >
    <DetailHeading :label="productName" :title="detail.storyTitle" />
    <DetailImage
      v-if="detail.storyImage"
      :image="detail.storyImage"
      :preview="preview"
      :caption="false"
      class="detail-story-photo"
      @zoom="emit('zoom', $event)"
    />
    <div v-if="detail.features.length" class="detail-features">
      <article v-for="(feature, index) in detail.features" :key="index">
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.body }}</p>
      </article>
    </div>
  </section>
  <section
    v-if="detail.structureImages.length"
    class="detail-structure detail-section detail-container"
    data-section="structure"
  >
    <DetailHeading label="제품 구조" :title="detail.structureTitle" />
    <div class="detail-structure-grid">
      <DetailImage
        v-for="(image, index) in detail.structureImages"
        :key="`${image.url}-${index}`"
        :image="image"
        :preview="preview"
        @zoom="emit('zoom', $event)"
      />
    </div>
    <div
      v-if="detail.registeredImages.length"
      class="detail-thumbnails"
      aria-label="원본 제품 이미지 확대"
    >
      <button
        v-for="(image, index) in detail.registeredImages"
        :key="`${image.url}-${index}`"
        type="button"
        :disabled="preview"
        :aria-label="`${image.alt} 크게 보기`"
        @click="!preview && emit('zoom', image.url)"
      >
        <img :src="image.url" alt="" loading="lazy" /></button
      ><span>사진을 눌러<br />원본으로 살펴보세요.</span>
    </div>
  </section>
  <section v-if="detail.application" class="detail-application" data-section="application">
    <img :src="detail.application.image.url" :alt="detail.application.image.alt" loading="lazy" />
    <p
      v-if="detail.application.caption || detail.application.image.caption"
      class="detail-application-note"
    >
      {{ detail.application.caption || detail.application.image.caption }}
    </p>
    <div class="detail-application-copy detail-container">
      <DetailHeading label="공간에 맞는 조명 계획" :title="detail.application.title" />
      <p v-if="detail.application.description">{{ detail.application.description }}</p>
    </div>
  </section>
</template>
