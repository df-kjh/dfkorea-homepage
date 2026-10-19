<script setup lang="ts">
import { ref } from 'vue'
import type { Product } from '@/types'
import BaseModal from '@/components/common/BaseModal.vue'
import ProductDetailTemplate from '@/components/products/detail/ProductDetailTemplate.vue'
defineProps<{ modelValue: boolean; product: Product }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const size = ref<'desktop' | 'mobile'>('desktop')
</script>
<template>
  <BaseModal
    :model-value="modelValue"
    title="제품 상세 미리보기"
    subtitle="저장 전 현재 입력값입니다. 공개 페이지와 같은 템플릿으로 표시합니다."
    width="1440px"
    max-width="96vw"
    max-height="94vh"
    :z-index="80"
    content-padding="p-0"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="detail-preview-toolbar" role="group" aria-label="미리보기 화면 너비">
      <button
        v-for="option in ['desktop', 'mobile'] as const"
        :key="option"
        :data-detail-preview-size="option"
        type="button"
        class="detail-button"
        :aria-pressed="size === option"
        @click="size = option"
      >
        {{ option === 'desktop' ? 'PC' : '모바일 375px' }}
      </button>
      <span>견적 담기·페이지 이동·사진 확대는 미리보기에서 비활성화됩니다.</span>
    </div>
    <div class="detail-preview-scroll">
      <div
        data-detail-preview-canvas
        class="detail-preview-canvas"
        :style="{ width: size === 'mobile' ? '375px' : '100%' }"
      >
        <ProductDetailTemplate :product="product" preview />
      </div>
    </div>
  </BaseModal>
</template>
