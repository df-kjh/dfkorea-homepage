<script setup lang="ts">
import { useId } from 'vue'
import type { Product } from '@/types'
import PublicAction from '@/components/common/site/PublicAction.vue'
import DetailVariants from './DetailVariants.vue'
import type { resolveProductDetail } from './content'
defineProps<{
  product: Product
  detail: ReturnType<typeof resolveProductDetail>
  preview: boolean
}>()
const titleId = useId()
const emit = defineEmits<{ quote: [event: MouseEvent] }>()
</script>
<template>
  <div class="detail-breadcrumb detail-container">
    <PublicAction v-if="!preview" to="/products" variant="text">← 제품 목록</PublicAction
    ><span v-else>제품 미리보기</span><span>{{ product.category }}</span>
  </div>
  <section
    class="detail-hero"
    :class="{
      'detail-hero--product': detail.heroPresentation === 'product',
      'detail-hero--cover': detail.heroPresentation === 'cover',
      'detail-hero--empty': !detail.heroImage,
      'detail-hero--variants': !!product.variantGroup,
    }"
    :aria-labelledby="titleId"
  >
    <img
      v-if="detail.heroImage"
      class="detail-hero-art"
      :src="detail.heroImage.url"
      :alt="detail.heroImage.alt"
      fetchpriority="high"
    />
    <div class="detail-hero-copy detail-container">
      <h1 :id="titleId">
        <span class="detail-visually-hidden">{{ product.name }}</span>
        <span class="detail-hero-title">{{ detail.heroTitle }}</span>
      </h1>
      <p v-if="detail.heroDescription" class="detail-hero-description">
        {{ detail.heroDescription }}
      </p>
      <DetailVariants :product="product" :preview="preview" />
      <div class="detail-hero-actions">
        <PublicAction
          data-quote
          variant="light"
          :disabled="preview"
          @click="!preview && emit('quote', $event)"
          >견적에 담기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
    </div>
    <p v-if="detail.heroCaption" class="detail-hero-note">{{ detail.heroCaption }}</p>
    <div class="detail-hero-bottom detail-container">
      <div>
        <strong>{{ product.name }}</strong
        ><span>{{ product.modelName }}</span>
      </div>
    </div>
  </section>
  <dl v-if="detail.summary.length" class="detail-facts detail-container">
    <div v-for="spec in detail.summary" :key="spec.label">
      <dt>{{ spec.label }}</dt>
      <dd>{{ spec.value }}</dd>
    </div>
  </dl>
</template>
