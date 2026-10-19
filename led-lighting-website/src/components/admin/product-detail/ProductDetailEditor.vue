<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type {
  Product,
  ProductDetailContent,
  ProductDetailFeature,
  ProductDetailImage,
} from '@/types'
import DetailTextField from './DetailTextField.vue'
import DetailImageField from './DetailImageField.vue'
import ProductDetailPreview from './ProductDetailPreview.vue'
import { withRegisteredImageUrls } from '@/utils/product-images'
import { cloneDetailContent, prepareDetailContent, validateDetailContent } from './editor-content'
import './editor.css'

const props = defineProps<{
  modelValue: ProductDetailContent | null
  product: Product
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ProductDetailContent | null] }>()
const config = useRuntimeConfig()
const assetUrlOptions = {
  apiBaseUrl: String(config.public.apiBaseUrl),
  siteUrl: String(config.public.siteUrl),
}
const id = useId()
const previewOpen = ref(false)
const custom = computed(() => props.modelValue !== null)
const content = computed(() => props.modelValue || ({ version: 1 } as ProductDetailContent))
const errors = computed(() => validateDetailContent(props.modelValue))
const error = (field: string) => errors.value.find((item) => item.field === field)?.message
const previewProduct = computed<Product>(() => ({
  ...withRegisteredImageUrls(props.product, assetUrlOptions),
  detailContent: prepareDetailContent(props.modelValue),
}))
const update = <K extends keyof ProductDetailContent>(key: K, value: ProductDetailContent[K]) => {
  const next = cloneDetailContent(content.value)!
  if (value === undefined) delete next[key]
  else next[key] = value
  emit('update:modelValue', next)
}
const mode = (useCustom: boolean) => emit('update:modelValue', useCustom ? { version: 1 } : null)
const feature = (index: number, key: keyof ProductDetailFeature, value: string) => {
  const next = (content.value.features || []).map((item) => ({ ...item }))
  const item = next[index]
  if (item) {
    item[key] = value
    update('features', next)
  }
}
const structure = (index: number, value: ProductDetailImage | undefined) => {
  const next = [...(content.value.structureImages || [])]
  next[index] = value || { url: '', alt: '' }
  update('structureImages', next)
}
const application = <K extends keyof NonNullable<ProductDetailContent['application']>>(
  key: K,
  value: NonNullable<ProductDetailContent['application']>[K],
) => {
  update('application', {
    title: '',
    image: { url: '', alt: '' },
    ...content.value.application,
    [key]: value,
  })
}
const featureFields = [
  { key: 'title', label: '제목', limit: 160 },
  { key: 'body', label: '설명', limit: 2000 },
] as const
const sections = [
  { title: '히어로', titleKey: 'heroTitle', imageKey: 'heroImage' },
  { title: '제품 소개', titleKey: 'storyTitle', imageKey: 'storyImage' },
] as const
</script>
<template>
  <section data-detail-editor class="detail-editor" :aria-labelledby="`${id}-title`">
    <div class="detail-editor-header">
      <div>
        <h2 :id="`${id}-title`">제품 상세 템플릿</h2>
        <p>
          제품 사양은 위의 등록 정보를 사용합니다. 빈 문구·이미지 항목에는 공통 기본값을 적용합니다.
        </p>
      </div>
      <button data-detail-preview type="button" class="detail-button" @click="previewOpen = true">
        상세 미리보기
      </button>
    </div>
    <fieldset class="detail-mode" :disabled="disabled">
      <legend class="sr-only">상세 콘텐츠 작성 방식</legend>
      <label
        ><input
          data-detail-mode="default"
          type="radio"
          :name="`${id}-mode`"
          :checked="!custom"
          @change="mode(false)"
        />
        공통 기본값 사용</label
      >
      <label
        ><input
          data-detail-mode="custom"
          type="radio"
          :name="`${id}-mode`"
          :checked="custom"
          @change="mode(true)"
        />
        직접 편집</label
      >
      <button
        v-if="custom"
        data-detail-reset
        type="button"
        class="detail-button detail-button-subtle"
        @click="mode(false)"
      >
        공통 기본값으로 초기화
      </button>
    </fieldset>
    <div
      v-if="errors.length"
      data-detail-errors
      class="detail-errors"
      role="status"
      aria-live="polite"
    >
      <p>저장 전에 다음 항목을 확인해주세요.</p>
      <ul>
        <li v-for="item in errors" :key="item.field">{{ item.message }}</li>
      </ul>
    </div>
    <fieldset v-if="custom" class="detail-editor-fields" :disabled="disabled">
      <legend class="sr-only">상세 콘텐츠 입력</legend>
      <div v-for="section in sections" :key="section.titleKey" class="detail-editor-section">
        <h3>{{ section.title }}</h3>
        <DetailTextField
          :model-value="content[section.titleKey]"
          :field="section.titleKey"
          label="섹션 제목 (선택)"
          :limit="160"
          multiline
          :error="error(section.titleKey)"
          @update:model-value="update(section.titleKey, $event)"
        />
        <DetailTextField
          v-if="section.titleKey === 'heroTitle'"
          :model-value="content.heroDescription"
          field="heroDescription"
          label="히어로 설명 (선택)"
          :limit="2000"
          multiline
          :error="error('heroDescription')"
          @update:model-value="update('heroDescription', $event)"
        />
        <DetailImageField
          :model-value="content[section.imageKey]"
          :field="section.imageKey"
          :label="`${section.title} 이미지 (선택)`"
          :errors="errors"
          @update:model-value="update(section.imageKey, $event)"
        />
      </div>
      <div class="detail-editor-section">
        <div class="detail-editor-header">
          <h3>제품 특징</h3>
          <button
            data-detail-add="feature"
            type="button"
            class="detail-button"
            :disabled="(content.features?.length || 0) >= 6"
            @click="update('features', [...(content.features || []), { title: '', body: '' }])"
          >
            특징 추가 ({{ content.features?.length || 0 }}/6)
          </button>
        </div>
        <p class="detail-help">
          특징을 직접 등록하면 기본 사양 요약을 대체합니다. 추가한 항목을 모두 지우면 특징을
          표시하지 않습니다.
        </p>
        <fieldset v-for="(item, index) in content.features" :key="index" class="detail-repeat-item">
          <legend>특징 {{ index + 1 }}</legend>
          <DetailTextField
            v-for="entry in featureFields"
            :key="entry.key"
            :model-value="item[entry.key]"
            :field="`features.${index}.${entry.key}`"
            :label="entry.label"
            :limit="entry.limit"
            :multiline="entry.key === 'body'"
            :error="error(`features.${index}.${entry.key}`)"
            @update:model-value="feature(index, entry.key, $event)"
          />
          <button
            :data-detail-remove="`feature-${index}`"
            type="button"
            class="detail-button detail-button-subtle"
            @click="
              update(
                'features',
                content.features?.filter((_, itemIndex) => itemIndex !== index),
              )
            "
          >
            특징 {{ index + 1 }} 삭제
          </button>
        </fieldset>
      </div>
      <div class="detail-editor-section">
        <div class="detail-editor-header">
          <h3>제품 구조</h3>
          <button
            data-detail-add="structure"
            type="button"
            class="detail-button"
            :disabled="(content.structureImages?.length || 0) >= 6"
            @click="
              update('structureImages', [...(content.structureImages || []), { url: '', alt: '' }])
            "
          >
            구조 이미지 추가 ({{ content.structureImages?.length || 0 }}/6)
          </button>
        </div>
        <DetailTextField
          :model-value="content.structureTitle"
          field="structureTitle"
          label="구조 제목 (선택)"
          :limit="160"
          multiline
          :error="error('structureTitle')"
          @update:model-value="update('structureTitle', $event)"
        />
        <div
          v-for="(item, index) in content.structureImages"
          :key="index"
          class="detail-repeat-item"
        >
          <DetailImageField
            :model-value="item"
            :field="`structureImages.${index}`"
            :label="`구조 이미지 ${index + 1}`"
            :errors="errors"
            @update:model-value="structure(index, $event)"
          />
          <button
            :data-detail-remove="`structure-${index}`"
            type="button"
            class="detail-button detail-button-subtle"
            @click="
              update(
                'structureImages',
                content.structureImages?.filter((_, itemIndex) => itemIndex !== index),
              )
            "
          >
            구조 이미지 {{ index + 1 }} 삭제
          </button>
        </div>
      </div>
      <div class="detail-editor-section">
        <h3>적용 이미지 (선택)</h3>
        <label class="detail-toggle"
          ><input
            data-detail-application-enabled
            type="checkbox"
            :checked="!!content.application"
            @change="
              update(
                'application',
                ($event.target as HTMLInputElement).checked
                  ? { title: '', image: { url: '', alt: '' } }
                  : undefined,
              )
            "
          />
          적용 이미지 직접 등록</label
        >
        <p class="detail-help">
          등록하지 않으면 제품 기본값을 사용합니다. 일반 제품은 적용 이미지를 표시하지 않습니다.
        </p>
        <template v-if="content.application">
          <DetailTextField
            :model-value="content.application.title"
            field="application.title"
            label="적용 이미지 제목"
            :limit="160"
            required
            multiline
            :error="error('application.title')"
            @update:model-value="application('title', $event)"
          />
          <DetailTextField
            :model-value="content.application.description"
            field="application.description"
            label="적용 설명 (선택)"
            :limit="2000"
            multiline
            :error="error('application.description')"
            @update:model-value="application('description', $event)"
          />
          <DetailImageField
            :model-value="content.application.image"
            field="application.image"
            label="적용 이미지"
            required
            :errors="errors"
            @update:model-value="application('image', $event || { url: '', alt: '' })"
          />
          <DetailTextField
            :model-value="content.application.caption"
            field="application.caption"
            label="적용 이미지 출처·캡션 (선택)"
            :limit="500"
            multiline
            :error="error('application.caption')"
            @update:model-value="application('caption', $event)"
          />
        </template>
      </div>
      <div class="detail-editor-section">
        <h3>제어 옵션</h3>
        <label class="detail-toggle"
          ><input
            data-detail-show-control
            type="checkbox"
            :checked="content.showControl !== false"
            @change="update('showControl', ($event.target as HTMLInputElement).checked)"
          />
          제어 옵션 표시</label
        >
        <DetailTextField
          :model-value="content.controlTitle"
          field="controlTitle"
          label="제어 제목 (선택)"
          :limit="160"
          multiline
          :error="error('controlTitle')"
          @update:model-value="update('controlTitle', $event)"
        />
        <p class="detail-help">위에서 선택한 제품 옵션이 있을 때 표시합니다.</p>
      </div>
      <div class="detail-editor-section">
        <h3>규격</h3>
        <label class="detail-toggle"
          ><input
            data-detail-show-dimensions
            type="checkbox"
            :checked="content.showDimensions !== false"
            @change="update('showDimensions', ($event.target as HTMLInputElement).checked)"
          />
          규격 표시</label
        >
        <DetailTextField
          :model-value="content.dimensionsTitle"
          field="dimensionsTitle"
          label="규격 제목 (선택)"
          :limit="160"
          multiline
          :error="error('dimensionsTitle')"
          @update:model-value="update('dimensionsTitle', $event)"
        />
        <DetailImageField
          :model-value="content.dimensionImage"
          field="dimensionImage"
          label="규격 도식 이미지 (선택)"
          :errors="errors"
          @update:model-value="update('dimensionImage', $event)"
        />
        <p class="detail-help">
          규격 수치는 위의 크기 정보를 사용합니다. 기존 기술 자료는 아래 기타 사항에서 편집하세요.
        </p>
      </div>
    </fieldset>
    <p v-else class="detail-help">
      등록한 제품 정보와 기존 기술 자료로 상세페이지를 구성합니다. 직접 편집을 선택하면 이미지와
      문구를 추가할 수 있습니다.
    </p>
    <ProductDetailPreview v-model="previewOpen" :product="previewProduct" />
  </section>
</template>
