<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import { renderMarkdown } from '@/utils/seo'
import PublicAction from '@/components/common/site/PublicAction.vue'
import { resolveProductDetail } from './content'
import DetailHero from './DetailHero.vue'
import DetailStory from './DetailStory.vue'
import DetailControl from './DetailControl.vue'
import DetailDimensions from './DetailDimensions.vue'
import DetailHeading from './DetailHeading.vue'
import '@/assets/styles/product-markdown.css'
import './detail.css'
const props = withDefaults(defineProps<{ product: Product; preview?: boolean }>(), {
  preview: false,
})
const emit = defineEmits<{
  quote: [event: MouseEvent]
  'image-click': [url: string, index: number]
}>()
const detail = computed(() => resolveProductDetail(props.product))
const descriptionHtml = computed(() => {
  const html = renderMarkdown(props.product.description || '')
  // Embedded admin preview must remain inside its editor, including old Markdown links.
  return props.preview
    ? html.replace(/<a href="[^"]*">/g, '<span>').replace(/<\/a>/g, '</span>')
    : html
})
const zoom = (url: string) => {
  if (props.preview) return
  const index = detail.value.gallery.findIndex((image) => image.url === url)
  if (index >= 0) emit('image-click', url, index)
}
const quote = (event: MouseEvent) => {
  if (!props.preview) emit('quote', event)
}
</script>
<template>
  <main class="product-detail-template" :class="{ 'is-preview': preview }">
    <DetailHero
      :product="product"
      :detail="detail"
      :preview="preview"
      @quote="quote"
      @zoom="zoom"
    />
    <DetailStory :detail="detail" :product-name="product.name" :preview="preview" @zoom="zoom" />
    <DetailControl
      v-if="detail.showControl && detail.controls.length"
      :title="detail.controlTitle"
      :options="detail.controls"
    />
    <DetailDimensions
      v-if="detail.showDimensions && (detail.dimensionSpec || detail.dimensionImage)"
      :detail="detail"
      :product="product"
      :preview="preview"
      @zoom="zoom"
    />
    <section
      v-if="product.description"
      class="detail-description detail-section detail-container"
      data-section="description"
    >
      <DetailHeading label="제품 소개 · 기술 자료" :title="product.name" />
      <div class="detail-markdown product-description-content" v-html="descriptionHtml"></div>
    </section>
    <section
      class="detail-specifications detail-section detail-container"
      data-section="specifications"
    >
      <div class="detail-spec-grid">
        <div>
          <DetailHeading label="상세 사양" :title="'선택의 기준을,\n명확하게.'" />
          <p class="detail-spec-intro">사진으로 살펴본 제품의 사양을<br />한곳에서 확인하세요.</p>
          <div
            v-if="detail.certifications.length"
            class="detail-certifications"
            aria-label="제품에 등록된 인증 표기"
          >
            <span v-for="label in detail.certifications" :key="label">{{ label }}</span>
          </div>
        </div>
        <div>
          <table class="detail-spec-table">
            <caption>
              {{
                product.modelName || product.name
              }}
              등록 제품 사양
            </caption>
            <tbody>
              <tr>
                <th scope="row">제품명</th>
                <td>{{ product.name }}</td>
              </tr>
              <tr v-for="spec in detail.technicalSpecs" :key="spec.label">
                <th scope="row">{{ spec.label }}</th>
                <td>{{ spec.value }}</td>
              </tr>
            </tbody>
          </table>
          <p class="detail-spec-note">
            {{
              detail.connection
                ? '연결 구성품의 모델·길이 자료입니다. 전기 사양과 인증 적용은 연결할 조명에 맞춰 상담해 주세요.'
                : '현재 제품에 등록된 사양입니다. 사양·옵션 조합의 공급 가능 여부와 인증 적용 범위는 모델별로 확인해 주세요.'
            }}
          </p>
        </div>
      </div>
    </section>
    <section class="detail-inquiry detail-section detail-container" data-section="inquiry">
      <div>
        <DetailHeading label="제품 상담" :title="`${product.name},\n공간에 맞게 계획하세요.`" />
        <p>설치 구간과 필요한 수량,<br />원하시는 사양을 알려주세요.</p>
      </div>
      <PublicAction data-quote variant="light" :disabled="preview" @click="quote"
        >이 제품 견적에 담기 <span aria-hidden="true">↗</span></PublicAction
      >
    </section>
  </main>
</template>
