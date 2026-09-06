<script setup lang="ts">
import { computed } from 'vue'
import type { TenderAnalysisStatus, TenderSuitability } from '@/types'
const props = defineProps<{
  status: TenderAnalysisStatus
  suitability?: TenderSuitability | null
}>()
const labels = {
  PENDING: ['◷', '분석 대기'],
  PROCESSING: ['↻', '분석 중'],
  PARTIAL: ['△', '부분 분석 · 검토 필요'],
  FAILED: ['!', '분석 실패'],
  RECOMMENDED: ['✓', '참여 추천'],
  REVIEW: ['?', '검토 필요'],
  DIFFICULT: ['×', '참여 어려움'],
}
const state = computed(() =>
  props.status === 'COMPLETED' ? (props.suitability ?? 'REVIEW') : props.status,
)
const label = computed(() =>
  props.status === 'PARTIAL' && props.suitability === 'DIFFICULT'
    ? ['△', '부분 분석 · 참여 어려움']
    : labels[state.value],
)
</script>
<template>
  <span class="suitability-badge" :class="`suitability-badge--${state.toLowerCase()}`"
    ><span aria-hidden="true">{{ label[0] }}</span
    ><span>{{ label[1] }}</span></span
  >
</template>
<style scoped>
.suitability-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.8rem;
  font-weight: 700;
}
.suitability-badge--recommended {
  background: #e8f5ed;
  color: #176b45;
}
.suitability-badge--review,
.suitability-badge--partial {
  background: #fff4d6;
  color: #854d0e;
}
.suitability-badge--difficult,
.suitability-badge--failed {
  background: #fef2f2;
  color: #b42318;
}
</style>
