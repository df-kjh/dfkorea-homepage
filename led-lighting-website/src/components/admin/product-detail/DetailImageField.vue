<script setup lang="ts">
import { computed } from 'vue'
import type { ProductDetailImage } from '@/types'
import ImageUploader from '@/components/common/ImageUploader.vue'
import { safeDetailUrl } from '@/components/products/detail/content'
import DetailTextField from './DetailTextField.vue'
import type { DetailEditorError } from './editor-content'
const props = withDefaults(
  defineProps<{
    modelValue?: ProductDetailImage
    field: string
    label: string
    required?: boolean
    errors?: DetailEditorError[]
  }>(),
  { required: false, errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: ProductDetailImage | undefined] }>()
const safePreview = computed(() => safeDetailUrl(props.modelValue?.url) || '')
const error = (key: string) =>
  props.errors.find((item) => item.field === `${props.field}.${key}`)?.message
const update = (key: keyof ProductDetailImage, value: string) => {
  const next = { url: '', alt: '', ...props.modelValue, [key]: value }
  emit('update:modelValue', Object.values(next).some((item) => !!item) ? next : undefined)
}
// The shared uploader's remove action clears the image and its metadata together.
const uploaded = (url: string) => (url ? update('url', url) : emit('update:modelValue', undefined))
</script>
<template>
  <fieldset :data-detail-image="field" class="detail-image-field">
    <legend>{{ label }}</legend>
    <div class="detail-image-grid">
      <ImageUploader
        :model-value="safePreview"
        :alt="modelValue?.alt || label"
        aspect-ratio="video"
        @update:model-value="uploaded"
      />
      <div class="detail-field-stack">
        <DetailTextField
          :model-value="modelValue?.url"
          :field="`${field}.url`"
          label="이미지 주소"
          :limit="2048"
          :required="required"
          :error="error('url')"
          placeholder="업로드하거나 https:// 또는 /로 시작하는 주소"
          @update:model-value="update('url', $event)"
        />
        <DetailTextField
          :model-value="modelValue?.alt"
          :field="`${field}.alt`"
          label="대체텍스트"
          :limit="300"
          :required="required || !!modelValue?.url"
          :error="error('alt')"
          placeholder="사진에서 보여주는 제품·구조·공간을 설명하세요"
          @update:model-value="update('alt', $event)"
        />
        <DetailTextField
          :model-value="modelValue?.caption"
          :field="`${field}.caption`"
          label="이미지 캡션·출처 (선택)"
          :limit="500"
          :error="error('caption')"
          @update:model-value="update('caption', $event)"
        />
      </div>
    </div>
    <button
      v-if="modelValue"
      type="button"
      class="detail-button detail-button-subtle"
      @click="emit('update:modelValue', undefined)"
    >
      이 이미지 설정 비우기
    </button>
  </fieldset>
</template>
