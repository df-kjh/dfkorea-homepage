<script setup lang="ts">
import { useId } from 'vue'
import type { resolveProductDetail } from './content'
import DetailHeading from './DetailHeading.vue'
import DetailImage from './DetailImage.vue'
defineProps<{ detail: ReturnType<typeof resolveProductDetail>; preview: boolean }>()
const gradientId = useId()
const emit = defineEmits<{ zoom: [url: string] }>()
</script>
<template>
  <section class="detail-dimensions detail-section detail-container" data-section="dimensions">
    <div class="detail-dimensions-heading">
      <DetailHeading label="규격 안내" :title="detail.dimensionsTitle" />
      <p v-if="detail.isMoldbar">길이와 폭, 높이를 확인해<br />설치할 자리에 맞는지 살펴보세요.</p>
    </div>
    <div class="detail-dimensions-grid">
      <DetailImage
        v-if="detail.dimensionImage"
        :image="detail.dimensionImage"
        :preview="preview"
        @zoom="emit('zoom', $event)"
      />
      <figure v-else-if="detail.linearDimensions" class="detail-dimension-drawing">
        <svg
          viewBox="0 0 680 300"
          role="img"
          :aria-label="`몰드바 등록 규격 ${detail.dimensionSpec?.value} 개념도`"
        >
          <defs>
            <linearGradient :id="gradientId">
              <stop stop-color="#c2c4b8" />
              <stop offset="1" stop-color="#eeece1" />
            </linearGradient>
          </defs>
          <path
            d="M80 152 527 89 601 125 154 192Z"
            :fill="`url(#${gradientId})`"
            stroke="#6d7462"
          />
          <path d="M80 152 154 192 154 218 80 178Z" fill="#c0c4b6" stroke="#6d7462" />
          <path d="M154 192 601 125 601 152 154 218Z" fill="#e7e5d9" stroke="#6d7462" />
          <path d="M86 245 604 170M73 231 89 254M595 160 611 182" stroke="#96957d" />
          <text x="350" y="240" text-anchor="middle">{{ detail.linearDimensions[0] }} mm</text>
          <text x="85" y="120">{{ detail.linearDimensions[1] }} mm</text>
          <text x="606" y="147">{{ detail.linearDimensions[2] }}</text>
        </svg>
        <figcaption>
          기본 등록 규격을 설명하는 개념도이며, 실제 비율·설치 도면과 다릅니다.
        </figcaption>
      </figure>
      <dl v-if="detail.linearDimensions" class="detail-dimension-summary">
        <div v-for="(value, index) in detail.linearDimensions" :key="index">
          <dt>{{ ['길이', '폭', '높이'][index] }}</dt>
          <dd>{{ Number(value).toLocaleString('ko-KR') }}<small>mm</small></dd>
        </div>
      </dl>
      <dl
        v-else-if="detail.dimensionSpec"
        class="detail-dimension-summary detail-dimension-summary--text"
      >
        <div>
          <dt>{{ detail.dimensionSpec.label }}</dt>
          <dd>{{ detail.dimensionSpec.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
