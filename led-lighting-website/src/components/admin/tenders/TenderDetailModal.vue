<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import TenderOpportunityBadge from './TenderOpportunityBadge.vue'
import TenderRelevanceBadge from './TenderRelevanceBadge.vue'
import type { Tender } from '@/types'
import { formatKstDateTime } from '@/utils/tender-format'

interface Props { modelValue: boolean; tender: Tender | null }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const safeSourceUrl = computed(() => {
  if (!props.tender?.sourceUrl) return null
  try { const url = new URL(props.tender.sourceUrl); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
})
const dateTime = (value: string | null) => value ? formatKstDateTime(value) : '정보 없음'
</script>

<template>
  <BaseModal :model-value="modelValue" title="입찰 공고 상세" width="760px" max-width="95vw" @update:model-value="emit('update:modelValue', $event)">
    <article v-if="tender" class="tender-detail"><div class="flex flex-wrap items-center gap-2"><TenderRelevanceBadge :relevance="tender.relevance" /><TenderOpportunityBadge :opportunity-type="tender.opportunityType" /><span class="text-sm text-gray-500">{{ tender.source }} · {{ tender.sourceNoticeId }}-{{ tender.revision }}</span></div><h4 class="mt-3 text-xl font-bold text-gray-900">{{ tender.title }}</h4><dl class="tender-detail__grid"><div><dt>발주기관</dt><dd>{{ tender.orderingOrganization }}</dd></div><div><dt>수요기관</dt><dd>{{ tender.demandOrganization || '정보 없음' }}</dd></div><div><dt>등록일</dt><dd>{{ dateTime(tender.registeredAt) }}</dd></div><div><dt>입찰 마감</dt><dd>{{ dateTime(tender.bidEndedAt) }}</dd></div><div><dt>지역</dt><dd>{{ tender.region || '정보 없음' }}</dd></div><div><dt>공고 유형</dt><dd>{{ tender.procurementType }}</dd></div><div class="tender-detail__wide"><dt>판정 근거</dt><dd><ul><li v-for="reason in tender.relevanceReasons" :key="`${reason.field}-${reason.keyword}`"><strong>{{ reason.keyword }}</strong> · {{ reason.field }}</li></ul></dd></div><div class="tender-detail__wide"><dt>기회 판정 근거</dt><dd><ul><li v-for="reason in tender.opportunityReasons" :key="reason">{{ reason }}</li></ul></dd></div></dl><a v-if="safeSourceUrl" :href="safeSourceUrl" target="_blank" rel="noopener noreferrer" class="tender-detail__link">공식 원문 열기 <span aria-hidden="true">↗</span></a><p v-else class="text-sm text-gray-500">공식 원문 링크를 제공하지 않았습니다.</p></article>
  </BaseModal>
</template>

<style scoped>
.tender-detail__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin: 1.5rem 0; }.tender-detail__grid div { padding: .75rem; border-radius: .5rem; background: #f8fafc; }.tender-detail__wide { grid-column: 1 / -1; } dt { font-size: .75rem; font-weight: 700; color: #6b7280; } dd { margin-top: .3rem; color: #111827; word-break: break-word; }.tender-detail__link { display: inline-flex; padding: .65rem .85rem; border-radius: .5rem; background: #22a8c3; color: white; font-weight: 700; }.tender-detail__link:hover { background: #0f8198; } ul { padding-left: 1rem; list-style: disc; }@media (max-width: 520px) { .tender-detail__grid { grid-template-columns: 1fr; } }
</style>
