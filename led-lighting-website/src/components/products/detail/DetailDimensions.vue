<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import type { resolveProductDetail } from './content'
import { resolveRegisteredDimensions } from './registered-dimensions'
import DetailHeading from './DetailHeading.vue'
import DetailImage from './DetailImage.vue'
const props = defineProps<{
  detail: ReturnType<typeof resolveProductDetail>
  product: Product
  preview: boolean
}>()
const emit = defineEmits<{ zoom: [url: string] }>()
const dimensions = computed(() => resolveRegisteredDimensions(props.product))
const numeric = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 20 })
const corners = computed(() =>
  dimensions.value.kind === 'linear'
    ? [
        [140, 105],
        [480, 105],
        [480, 195],
        [140, 195],
        [190, 65],
        [530, 65],
        [530, 155],
      ]
    : [
        [150, 80],
        [500, 80],
        [500, 210],
        [150, 210],
      ],
)
const measures = computed(() =>
  dimensions.value.kind === 'linear'
    ? [
        {
          key: 'length',
          start: [140, 195],
          end: [480, 195],
          from: [140, 255],
          to: [480, 255],
          label: [310, 284],
          value: dimensions.value.axes[0]!.value,
        },
        {
          key: 'width',
          start: [480, 195],
          end: [530, 155],
          from: [515, 230],
          to: [565, 190],
          label: [579, 230],
          value: dimensions.value.axes[1]!.value,
        },
        {
          key: 'height',
          start: [140, 105],
          end: [140, 195],
          from: [80, 105],
          to: [80, 195],
          label: [50, 155],
          value: dimensions.value.axes[2]!.value,
        },
      ]
    : dimensions.value.kind === 'round'
      ? [
          {
            key: 'diameter',
            start: [150, 210],
            end: [500, 210],
            from: [150, 255],
            to: [500, 255],
            label: [325, 284],
            value: dimensions.value.axes[0]!.value,
          },
          {
            key: 'height',
            start: [500, 80],
            end: [500, 210],
            from: [555, 80],
            to: [555, 210],
            label: [606, 150],
            value: dimensions.value.axes[1]!.value,
          },
        ]
      : [],
)
</script>
<template>
  <section class="detail-dimensions detail-section detail-container" data-section="dimensions">
    <div class="detail-dimensions-heading">
      <DetailHeading label="규격 안내" :title="detail.dimensionsTitle" />
      <p>등록 규격을 확인해<br />설치할 자리에 맞는지 살펴보세요.</p>
    </div>
    <div class="detail-dimensions-grid">
      <DetailImage
        v-if="detail.dimensionImage"
        :image="detail.dimensionImage"
        :preview="preview"
        @zoom="emit('zoom', $event)"
      />
      <figure
        v-else
        class="detail-dimension-drawing dimension-bounds"
        :class="{ 'dimension-bounds--linear': dimensions.kind === 'linear' }"
      >
        <svg
          viewBox="0 0 680 315"
          role="img"
          :aria-label="`${product.name} 등록 규격 ${dimensions.source || '미등록'} 외곽 범위 개념도`"
        >
          <g class="dimension-bounds__body">
            <template v-if="dimensions.kind === 'linear'">
              <path d="M140 105 190 65 530 65 480 105Z" fill="#f2f0e6" />
              <path d="M480 105 530 65 530 155 480 195Z" fill="#c9cdbd" />
              <rect x="140" y="105" width="340" height="90" fill="#e1e2d5" />
            </template>
            <rect
              v-else
              x="150"
              y="80"
              width="350"
              height="130"
              fill="#e1e2d5"
              :stroke-dasharray="dimensions.kind === 'registered' ? '7 6' : undefined"
            />
          </g>
          <circle
            v-for="(corner, index) in corners"
            :key="index"
            data-corner
            :cx="corner[0]"
            :cy="corner[1]"
            r="2"
            fill="#697456"
          />
          <g v-for="measure in measures" :key="measure.key" class="dimension-bounds__measure">
            <line
              :data-guide="measure.key"
              :x1="measure.start[0]"
              :y1="measure.start[1]"
              :x2="measure.from[0]"
              :y2="measure.from[1]"
            />
            <line
              :data-guide="measure.key"
              :x1="measure.end[0]"
              :y1="measure.end[1]"
              :x2="measure.to[0]"
              :y2="measure.to[1]"
            />
            <line
              :data-measurement="measure.key"
              :x1="measure.from[0]"
              :y1="measure.from[1]"
              :x2="measure.to[0]"
              :y2="measure.to[1]"
            />
            <circle :cx="measure.from[0]" :cy="measure.from[1]" r="3" />
            <circle :cx="measure.to[0]" :cy="measure.to[1]" r="3" />
            <text
              :data-axis="measure.key"
              :x="measure.label[0]"
              :y="measure.label[1]"
              text-anchor="middle"
            >
              {{ numeric(measure.value) }} mm
            </text>
          </g>
          <text v-if="!measures.length" x="325" y="265" text-anchor="middle">
            등록 규격은 원문을 확인해 주세요.
          </text>
        </svg>
        <figcaption>
          네모 외곽은 치수 범위 안내이며 실제 제품 형상을 나타내지 않습니다.<br />
          기본 등록 규격을 설명하는 개념도이며, 실제 비율·설치 도면과 다릅니다.
        </figcaption>
      </figure>
      <dl v-if="dimensions.axes.length" class="detail-dimension-summary">
        <div v-for="axis in dimensions.axes" :key="axis.label">
          <dt>{{ axis.label }}</dt>
          <dd>{{ numeric(axis.value) }}<small>mm</small></dd>
        </div>
      </dl>
      <dl
        v-else
        class="detail-dimension-summary detail-dimension-summary--text dimension-bounds__registered"
      >
        <div>
          <dt>등록 규격</dt>
          <dd>
            {{ dimensions.source || '규격 확인 필요'
            }}<small v-if="/\d/.test(dimensions.source) && !/mm/i.test(dimensions.source)"
              >mm</small
            >
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
<style scoped>
.dimension-bounds {
  min-width: 0;
  container-type: inline-size;
}
.dimension-bounds__body {
  stroke: #727d60;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.dimension-bounds__measure line {
  stroke: #7e896b;
  stroke-width: 1.25;
}
.dimension-bounds__measure [data-guide] {
  opacity: 0.55;
}
.dimension-bounds__measure circle {
  fill: #687452;
}
.dimension-bounds__measure text {
  fill: #4d593d;
  font-size: 17px;
}
.product-detail-template .dimension-bounds__registered {
  grid-column: auto;
}
.dimension-bounds__registered dd {
  overflow-wrap: anywhere;
}
/* SVG text scales with its viewBox. Compensate in narrow figures, including
   embedded admin previews, while keeping the full-size diagram unchanged. */
@container (max-width: 440px) {
  .dimension-bounds__measure text {
    font-size: clamp(17px, calc(52px - 8cqw), 36px);
  }
  .dimension-bounds--linear text[data-axis='height'] {
    transform: rotate(-90deg);
    transform-box: fill-box;
    transform-origin: center;
  }
}
</style>
