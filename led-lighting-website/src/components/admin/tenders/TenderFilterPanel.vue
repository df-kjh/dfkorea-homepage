<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { TenderProcurementType, TenderQuery, TenderRelevance, TenderSource } from '@/types'

type CalendarFilters = Pick<TenderQuery, 'keyword' | 'source' | 'region' | 'procurementType' | 'relevance'>
interface Props { filters: CalendarFilters }
const props = defineProps<Props>()
const emit = defineEmits<{ apply: [filters: CalendarFilters]; reset: [] }>()

const form = reactive<CalendarFilters>({ ...props.filters })
watch(() => props.filters, (filters) => Object.assign(form, filters), { deep: true })

const apply = () => emit('apply', { ...form })
const reset = () => {
  Object.assign(form, { keyword: undefined, source: undefined, region: undefined, procurementType: undefined, relevance: undefined })
  emit('reset')
}
</script>

<template>
  <section class="tender-filter" aria-label="입찰 공고 필터">
    <div class="tender-filter__fields">
      <label><span>검색어</span><input data-test="filter-keyword" v-model.trim="form.keyword" type="search" placeholder="공고명 또는 발주기관" @keyup.enter="apply" /></label>
      <label><span>출처</span><select v-model="form.source"><option :value="undefined">전체</option><option value="G2B">나라장터</option><option value="KAPT">K-apt</option><option value="KEPCO">한전</option></select></label>
      <label><span>지역</span><input v-model.trim="form.region" type="text" placeholder="예: 서울" /></label>
      <label><span>공고 유형</span><select v-model="form.procurementType"><option :value="undefined">전체</option><option value="GOODS">물품</option><option value="CONSTRUCTION">공사</option><option value="SERVICE">용역</option><option value="OTHER">기타</option></select></label>
      <label><span>관련도</span><select v-model="form.relevance"><option :value="undefined">전체</option><option value="DIRECT">💡 직접 관련</option><option value="POTENTIAL">⚡ 잠재 관련</option></select></label>
    </div>
    <div class="flex justify-end gap-2 mt-4"><button data-test="reset-filter" type="button" class="filter-button filter-button--secondary" @click="reset">초기화</button><button data-test="apply-filter" type="button" class="filter-button" @click="apply">적용</button></div>
  </section>
</template>

<style scoped>
.tender-filter { padding: 1rem; border: 1px solid #dbe7ea; border-radius: .75rem; background: #f8fcfd; }
.tender-filter__fields { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; }
label { display: grid; gap: .35rem; font-size: .78rem; font-weight: 700; color: #4b5563; } input, select { min-width: 0; border: 1px solid #d1d5db; border-radius: .45rem; padding: .55rem .65rem; background: white; font: inherit; color: #111827; } input:focus, select:focus { outline: 2px solid #22a8c3; outline-offset: 1px; }
.filter-button { padding: .5rem .85rem; border-radius: .45rem; background: #22a8c3; color: white; font-size: .875rem; font-weight: 700; }.filter-button--secondary { border: 1px solid #d1d5db; background: white; color: #4b5563; }
@media (max-width: 900px) { .tender-filter__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .tender-filter__fields { grid-template-columns: 1fr; } }
</style>
