<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ThePagination from '@/components/common/ThePagination.vue'
import TenderRelevanceBadge from './TenderRelevanceBadge.vue'
import type { PaginatedTenderResponse, Tender } from '@/types'

interface Props { response: PaginatedTenderResponse; loading: boolean; error: string | null; selectedDate: string }
defineProps<Props>()
const emit = defineEmits<{ select: [tender: Tender]; retry: []; 'page-change': [page: number] }>()

const sourceLabel: Record<Tender['source'], string> = { G2B: '나라장터', KAPT: 'K-apt', KEPCO: '한전' }
const procurementLabel: Record<Tender['procurementType'], string> = { GOODS: '물품', CONSTRUCTION: '공사', SERVICE: '용역', OTHER: '기타' }
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value)) : '-'
const currency = (value: string | null) => value ? `${Number(value).toLocaleString('ko-KR')}원` : '-'
</script>

<template>
  <section class="tender-list" :aria-label="`${selectedDate} 등록 공고`">
    <div class="tender-list__heading"><h3 class="font-bold text-gray-900">{{ selectedDate }} 등록 공고</h3><span v-if="!loading && !error" class="text-sm text-gray-500">총 {{ response.total }}건</span></div>
    <LoadingSpinner v-if="loading" message="공고 목록을 불러오는 중입니다" />
    <div v-else-if="error" data-test="tender-list-error" class="tender-list__feedback"><p>{{ error }}</p><button type="button" class="retry-button" @click="emit('retry')">다시 시도</button></div>
    <EmptyState v-else-if="response.data.length === 0" data-test="tender-list-empty" description="선택한 날짜에 등록된 관련 공고가 없습니다." />
    <template v-else>
      <div class="hidden lg:block overflow-x-auto"><table class="w-full"><thead><tr><th>관련도</th><th>공고명</th><th>발주기관</th><th>출처</th><th>지역</th><th>유형</th><th>등록일</th><th>입찰 마감</th><th>금액</th></tr></thead><tbody><tr v-for="tender in response.data" :key="tender.id"><td><TenderRelevanceBadge :relevance="tender.relevance" /></td><td><strong>{{ tender.title }}</strong><p class="reason">{{ tender.relevanceReasons.map((reason) => reason.keyword).join(', ') }}</p><button :data-test="`tender-details-${tender.id}`" type="button" class="tender-list__details" @click="emit('select', tender)" @keydown.enter.prevent="emit('select', tender)" @keyup.space.prevent="emit('select', tender)">상세 보기</button></td><td>{{ tender.orderingOrganization }}</td><td>{{ sourceLabel[tender.source] }}</td><td>{{ tender.region || '-' }}</td><td>{{ procurementLabel[tender.procurementType] }}</td><td>{{ dateLabel(tender.registeredAt) }}</td><td>{{ dateLabel(tender.bidEndedAt) }}</td><td>{{ currency(tender.estimatedAmount) }}</td></tr></tbody></table></div>
      <div class="lg:hidden space-y-3"><button v-for="tender in response.data" :key="tender.id" type="button" class="tender-list__mobile-card" @click="emit('select', tender)"><div class="flex justify-between gap-2 text-left"><TenderRelevanceBadge :relevance="tender.relevance" /><span class="text-xs text-gray-500">{{ sourceLabel[tender.source] }}</span></div><strong class="block mt-2 text-left">{{ tender.title }}</strong><span class="block mt-2 text-left text-sm text-gray-600">{{ tender.orderingOrganization }} · {{ tender.region || '지역 미상' }}</span><span class="block mt-1 text-left text-sm text-gray-600">입찰 마감 {{ dateLabel(tender.bidEndedAt) }}</span></button></div>
      <ThePagination :current-page="response.page" :total-pages="response.totalPages" :total-items="response.total" @page-change="emit('page-change', $event)" />
    </template>
  </section>
</template>

<style scoped>
.tender-list { border-top: 1px solid #e5e7eb; padding-top: 1.5rem; }.tender-list__heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; } table { border-collapse: collapse; } th { text-align: left; padding: .7rem .5rem; font-size: .75rem; color: #6b7280; border-bottom: 1px solid #e5e7eb; } td { padding: .85rem .5rem; border-bottom: 1px solid #f0f1f2; font-size: .875rem; vertical-align: top; } tbody tr:hover { background: #f8fcfd; }.reason { margin-top: .25rem; color: #6b7280; font-size: .75rem; }.tender-list__details { margin-top: .45rem; color: #0f8198; font-size: .78rem; font-weight: 700; text-decoration: underline; }.tender-list__details:focus-visible { outline: 2px solid #22a8c3; outline-offset: 2px; }.tender-list__feedback { padding: 3rem 1rem; text-align: center; color: #b42318; }.retry-button { margin-top: .75rem; color: #0f8198; font-weight: 700; }.tender-list__mobile-card { display: block; width: 100%; border: 1px solid #e5e7eb; border-radius: .75rem; padding: 1rem; background: white; }.tender-list__mobile-card:hover { border-color: #22a8c3; }
</style>
