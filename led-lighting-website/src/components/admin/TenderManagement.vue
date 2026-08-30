<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { tendersAPI } from '@/api/tenders'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import TenderCalendar from './tenders/TenderCalendar.vue'
import TenderDetailModal from './tenders/TenderDetailModal.vue'
import TenderFilterPanel from './tenders/TenderFilterPanel.vue'
import TenderList from './tenders/TenderList.vue'
import TenderSubscriptionModal from './tenders/TenderSubscriptionModal.vue'
import type {
  PaginatedTenderResponse,
  Tender,
  TenderCalendarDay,
  TenderQuery,
  TenderSubscription,
} from '@/types'

type CalendarFilters = Pick<TenderQuery, 'keyword' | 'source' | 'region' | 'procurementType' | 'relevance'>

const emptyResponse = (): PaginatedTenderResponse => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
const currentDateLabel = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

const selectedDate = ref(currentDateLabel())
const month = ref(selectedDate.value.slice(0, 7))
const calendarDays = ref<TenderCalendarDay[]>([])
const calendarLoading = ref(false)
const calendarError = ref<string | null>(null)
const listLoading = ref(false)
const listError = ref<string | null>(null)
const listResponse = ref<PaginatedTenderResponse>(emptyResponse())
const currentListPage = ref(1)
const collectionLoading = ref(false)
const collectionFeedback = ref<{ role: 'status' | 'alert'; message: string } | null>(null)
const filterVisible = ref(false)
const appliedFilters = reactive<CalendarFilters>({})
const selectedTender = ref<Tender | null>(null)
const detailOpen = ref(false)
const subscriptionOpen = ref(false)
const subscriptionLoading = ref(false)
const subscriptionLoaded = ref(false)
const subscriptionError = ref<string | null>(null)
const subscription = ref<TenderSubscription>({ enabled: false, deliveryTime: '09:00', recipients: [] })
let calendarRequest = 0
let listRequest = 0
let subscriptionRequest = 0

const summary = computed(() => calendarDays.value.reduce(
  (total, day) => ({ total: total.total + day.total, direct: total.direct + day.direct, potential: total.potential + day.potential }),
  { total: 0, direct: 0, potential: 0 },
))

const fetchCalendar = async () => {
  const request = ++calendarRequest
  calendarLoading.value = true
  calendarError.value = null
  try {
    const { data } = await tendersAPI.getCalendar(month.value, { ...appliedFilters })
    if (request === calendarRequest) calendarDays.value = data
  } catch {
    if (request === calendarRequest) {
      calendarDays.value = []
      calendarError.value = '캘린더를 불러오지 못했습니다. 다시 시도해 주세요.'
    }
  } finally {
    if (request === calendarRequest) calendarLoading.value = false
  }
}

const fetchList = async (page = currentListPage.value) => {
  currentListPage.value = page
  const request = ++listRequest
  listLoading.value = true
  listError.value = null
  listResponse.value = emptyResponse()
  try {
    const { data } = await tendersAPI.getAll({ registeredDate: selectedDate.value, ...appliedFilters, page, pageSize: 20 })
    if (request === listRequest) listResponse.value = data
  } catch {
    if (request === listRequest) {
      listResponse.value = emptyResponse()
      listError.value = '공고 목록을 불러오지 못했습니다. 다시 시도해 주세요.'
    }
  } finally {
    if (request === listRequest) listLoading.value = false
  }
}

const collectTenders = async () => {
  if (collectionLoading.value) return

  collectionLoading.value = true
  collectionFeedback.value = null
  try {
    const { data } = await tendersAPI.collect()
    if (!data.lockAcquired) {
      collectionFeedback.value = { role: 'status', message: '이미 수집이 진행 중입니다.' }
      return
    }

    collectionFeedback.value = data.failedSources.length > 0
      ? { role: 'alert', message: '일부 출처 수집에 실패했습니다. 성공한 공고는 최신 목록으로 반영했습니다.' }
      : { role: 'status', message: '공고 수집이 완료되었습니다.' }
    await Promise.all([fetchCalendar(), fetchList(currentListPage.value)])
  } catch {
    collectionFeedback.value = { role: 'alert', message: '공고 수집을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  } finally {
    collectionLoading.value = false
  }
}

const fetchSubscription = async () => {
  const request = ++subscriptionRequest
  subscriptionLoaded.value = false
  subscriptionLoading.value = true
  subscriptionError.value = null
  try {
    const { data } = await tendersAPI.getSubscription()
    if (request === subscriptionRequest) {
      subscription.value = data
      subscriptionLoaded.value = true
    }
  } catch {
    if (request === subscriptionRequest) {
      subscriptionError.value = '수신 설정을 불러오지 못했습니다. 다시 시도해 주세요.'
    }
  } finally {
    if (request === subscriptionRequest) subscriptionLoading.value = false
  }
}

const selectDate = (date: string) => { selectedDate.value = date; fetchList(1) }
const changeMonth = (nextMonth: string) => { month.value = nextMonth; selectedDate.value = `${nextMonth}-01`; fetchCalendar(); fetchList(1) }
const goToday = () => { const today = currentDateLabel(); month.value = today.slice(0, 7); selectedDate.value = today; fetchCalendar(); fetchList(1) }
const applyFilters = (filters: CalendarFilters) => { Object.assign(appliedFilters, filters); fetchCalendar(); fetchList(1) }
const resetFilters = () => { Object.assign(appliedFilters, { keyword: undefined, source: undefined, region: undefined, procurementType: undefined, relevance: undefined }); fetchCalendar(); fetchList(1) }
const openDetail = (tender: Tender) => { selectedTender.value = tender; detailOpen.value = true }
const openSubscription = () => { subscriptionOpen.value = true; void fetchSubscription() }
const closeSubscription = () => {
  ++subscriptionRequest
  subscriptionOpen.value = false
  subscriptionLoaded.value = false
  subscriptionLoading.value = false
  subscriptionError.value = null
}
const setSubscriptionOpen = (open: boolean) => { if (open) openSubscription(); else closeSubscription() }
const saveSubscription = async (next: TenderSubscription) => {
  if (!subscriptionLoaded.value) return
  const request = subscriptionRequest
  subscriptionLoading.value = true
  subscriptionError.value = null
  try {
    const { data } = await tendersAPI.updateSubscription(next)
    if (request === subscriptionRequest) {
      subscription.value = data
      closeSubscription()
    }
  } catch {
    if (request === subscriptionRequest) {
      subscriptionError.value = '수신 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    if (request === subscriptionRequest) subscriptionLoading.value = false
  }
}

onMounted(() => { fetchCalendar(); fetchList() })
</script>

<template>
  <section class="tender-management" aria-label="입찰 공고 관리">
    <div class="tender-management__toolbar">
      <div><h3 class="text-lg sm:text-xl font-bold text-gray-900">입찰 공고</h3><p class="mt-1 text-sm text-gray-500">등록일 기준으로 LED 조명 관련 공고를 확인합니다.</p></div>
      <div class="flex flex-wrap gap-2"><BaseButton data-test="collect-tenders" type="button" variant="default" size="small" icon-left="sync" :loading="collectionLoading" aria-label="공고 즉시 수집" :aria-busy="collectionLoading" @click="collectTenders">즉시 수집</BaseButton><BaseButton data-test="open-filter" type="button" variant="default" size="small" icon-left="filter_alt" @click="filterVisible = !filterVisible">필터</BaseButton><BaseButton data-test="open-subscription" type="button" variant="primary" size="small" icon-left="mail" @click="openSubscription">수신 설정</BaseButton></div>
    </div>

    <TenderFilterPanel v-if="filterVisible" :filters="appliedFilters" class="mt-4" @apply="applyFilters" @reset="resetFilters" />
    <p v-if="collectionFeedback" class="tender-management__feedback" :role="collectionFeedback.role">{{ collectionFeedback.message }}</p>
    <p v-if="calendarError" class="tender-management__error" role="alert">{{ calendarError }}</p>

    <div class="tender-management__summary" aria-label="월간 공고 요약">
      <BaseCard :hoverable="false" custom-class="tender-summary-card"><p>이번 달 전체</p><strong>{{ summary.total }}건</strong></BaseCard>
      <BaseCard :hoverable="false" custom-class="tender-summary-card tender-summary-card--direct"><p>💡 직접 관련</p><strong>{{ summary.direct }}건</strong></BaseCard>
      <BaseCard :hoverable="false" custom-class="tender-summary-card tender-summary-card--potential"><p>⚡ 잠재 관련</p><strong>{{ summary.potential }}건</strong></BaseCard>
    </div>

    <BaseCard :hoverable="false" custom-class="tender-calendar-card"><div class="tender-management__calendar-scroll"><TenderCalendar :month="month" :selected-date="selectedDate" :days="calendarDays" :loading="calendarLoading" @change-month="changeMonth" @select-date="selectDate" @today="goToday" /></div></BaseCard>
    <TenderList :response="listResponse" :loading="listLoading" :error="listError" :selected-date="selectedDate" @select="openDetail" @retry="fetchList(currentListPage)" @page-change="fetchList" />
    <TenderDetailModal v-model="detailOpen" :tender="selectedTender" />
    <TenderSubscriptionModal :model-value="subscriptionOpen" :subscription="subscription" :loading="subscriptionLoading" :loaded="subscriptionLoaded" :error="subscriptionError" @update:model-value="setSubscriptionOpen" @retry="fetchSubscription" @save="saveSubscription" />
  </section>
</template>

<style scoped>
.tender-management { background: white; border-radius: .75rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.05); }.tender-management__toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }.tender-management__summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin: 1.25rem 0; }.tender-management :deep(.tender-summary-card .card-body) { padding: 1rem; }.tender-management :deep(.tender-summary-card p) { margin: 0; color: #6b7280; font-size: .8rem; font-weight: 700; }.tender-management :deep(.tender-summary-card strong) { display: block; margin-top: .35rem; color: #111827; font-size: 1.5rem; }.tender-management :deep(.tender-summary-card--direct) { border-color: #b7e9f1; }.tender-management :deep(.tender-summary-card--potential) { border-color: #f7dea1; }.tender-management :deep(.tender-calendar-card .card-body) { padding: 1rem; }.tender-management__calendar-scroll { overflow-x: auto; }.tender-management__error, .tender-management__feedback { margin-top: 1rem; font-size: .875rem; }.tender-management__error { color: #b42318; }.tender-management__feedback { color: #176b45; } .tender-management__feedback[role='alert'] { color: #b54708; }@media (max-width: 520px) { .tender-management__toolbar { flex-direction: column; }.tender-management__summary { gap: .45rem; }.tender-management :deep(.tender-summary-card .card-body) { padding: .7rem; }.tender-management :deep(.tender-summary-card strong) { font-size: 1.15rem; } }
</style>
