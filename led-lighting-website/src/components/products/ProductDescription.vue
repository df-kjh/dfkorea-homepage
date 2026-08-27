<script setup lang="ts">
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'

interface Props {
  title?: string
  subtitle?: string
  description?: string
  featureImage?: string
  quote?: string
  quoteSource?: string
  featureTitle?: string
  featureDescription?: string
}

withDefaults(defineProps<Props>(), {
  title: 'A Symphony of Light and Form.',
  subtitle:
    "The Linear Beam Gen 2 isn't just a light fixture; it's a precision instrument. Crafted from aircraft-grade aluminum, it delivers a flicker-free, edge-to-edge illumination that mimics the natural properties of morning sunlight.",
  description: '',
  featureImage: '',
  quote:
    '"The way it integrates with my circadian rhythm has completely changed how I work from home."',
  quoteSource: '— Architectural Digest',
  featureTitle: 'Seamless Integration',
  featureDescription:
    'Equipped with the latest Matter-compatible chipsets, the Linear Beam connects instantly to your preferred smart home ecosystem. No hubs, no complexity—just pure, effortless light controlled by your voice or your presence.',
})
</script>

<template>
  <section class="py-24 bg-white border-t border-gray-100">
    <div class="max-w-4xl mx-auto px-10">
      <!-- Title & Subtitle -->
      <h2 class="text-text-main text-4xl lg:text-5xl font-bold mb-10 leading-tight">
        {{ title }}
      </h2>
      <div v-if="!description" class="prose prose-xl max-w-none">
        <p class="text-text-sub text-2xl leading-relaxed mb-12 font-light">
          {{ subtitle }}
        </p>
      </div>

      <!-- Markdown Content -->
      <div v-if="description" class="product-description-content mb-12">
        <MdPreview :model-value="description" language="ko-KR" theme="light" />
      </div>

      <!-- Feature Grid -->
      <div v-if="!description" class="grid md:grid-cols-2 gap-10 items-center my-20">
        <!-- Feature Image -->
        <div v-if="featureImage" class="rounded-3xl overflow-hidden shadow-2xl">
          <img
            :src="featureImage"
            alt="Lifestyle Application"
            class="w-full aspect-[3/4] object-cover"
          />
        </div>

        <!-- Feature Content -->
        <div class="space-y-8">
          <!-- Quote -->
          <div v-if="quote" class="p-10 bg-surface rounded-3xl">
            <p class="text-text-main text-xl italic leading-relaxed mb-6">
              {{ quote }}
            </p>
            <p class="text-text-main font-bold text-sm">{{ quoteSource }}</p>
          </div>

          <!-- Feature Description -->
          <div v-if="featureTitle">
            <h3 class="text-text-main text-2xl font-bold mb-4">{{ featureTitle }}</h3>
            <p class="text-text-sub text-lg leading-relaxed">
              {{ featureDescription }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Markdown 스타일링 */
.product-description-content :deep(p) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px];
}

.product-description-content :deep(h1) {
  @apply text-text-main text-4xl font-bold mt-12 mb-6 tracking-tight;
}

.product-description-content :deep(h2) {
  @apply text-text-main text-3xl font-bold mt-14 mb-6 tracking-tight;
}

.product-description-content :deep(h3) {
  @apply text-text-main text-2xl font-bold mt-10 mb-4 tracking-tight;
}

.product-description-content :deep(img) {
  @apply rounded-3xl my-14 shadow-sm max-w-full h-auto;
}

.product-description-content :deep(blockquote) {
  @apply my-14 bg-surface rounded-[32px] p-10 md:p-14 border border-gray-200;
  @apply text-2xl md:text-3xl font-semibold text-text-main leading-snug italic;
}

.product-description-content :deep(code) {
  @apply bg-surface px-2 py-1 rounded text-sm font-mono;
}

.product-description-content :deep(pre) {
  @apply bg-surface p-6 rounded-2xl overflow-x-auto my-8;
}

.product-description-content :deep(ul),
.product-description-content :deep(ol) {
  @apply text-text-sub leading-[1.8] mb-8 text-[19px] pl-6;
}

.product-description-content :deep(li) {
  @apply mb-2;
}

.product-description-content :deep(a) {
  @apply text-primary underline hover:text-primary/80;
}

.product-description-content :deep(strong) {
  @apply font-semibold text-text-main;
}

.product-description-content :deep(em) {
  @apply italic;
}
</style>
