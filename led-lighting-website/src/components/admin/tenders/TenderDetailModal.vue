<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import TenderRelevanceBadge from './TenderRelevanceBadge.vue'
import TenderSuitabilityBadge from './TenderSuitabilityBadge.vue'
import TenderAnalysisSummary from './TenderAnalysisSummary.vue'
import TenderRequirementTable from './TenderRequirementTable.vue'
import TenderPriceAnalysis from './TenderPriceAnalysis.vue'
import { tendersAPI } from '@/api/tenders'
import type { Tender, TenderAnalysis } from '@/types'
import { formatKstDateTime } from '@/utils/tender-format'
import { boundedEvidence, isAnalysisActive, isAnalysisReady } from '@/utils/tender-analysis-display'
const props = defineProps<{ modelValue: boolean; tender: Tender | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'analysis-updated': [analysis: TenderAnalysis]
}>()
const analysis = ref<TenderAnalysis | null>(null)
const loading = ref(false),
  busy = ref(false),
  error = ref(''),
  note = ref(''),
  pollingPaused = ref(false)
let generation = 0,
  pollCount = 0
let timer: ReturnType<typeof setTimeout> | undefined
const stopPolling = () => {
  clearTimeout(timer)
  timer = undefined
}
const ready = computed(() => isAnalysisReady(analysis.value?.status))
const safeSourceUrl = computed(() => {
  try {
    const url = new URL(props.tender?.sourceUrl ?? '')
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
})
const dateTime = (value?: string | null) => (value ? formatKstDateTime(value) : '정보 없음')
const documents = {
  PENDING: '◷ 추출 대기',
  EXTRACTED: '✓ 추출 완료',
  PARTIAL: '△ 부분 추출',
  FAILED: '! 추출 실패',
  UNSUPPORTED: '? 지원하지 않는 형식',
}
const accept = (data: TenderAnalysis) => {
  analysis.value = data
  emit('analysis-updated', data)
}
const schedule = (request: number) => {
  stopPolling()
  if (!isAnalysisActive(analysis.value?.status) || request !== generation || !props.modelValue)
    return
  // A finite polling budget avoids a permanently queued job keeping this modal busy forever.
  if (pollCount >= 30) {
    pollingPaused.value = true
    return
  }
  timer = setTimeout(() => {
    pollCount++
    void fetchAnalysis(request, false)
  }, 5000)
}
const fetchAnalysis = async (request = generation, initial = true) => {
  const id = props.tender?.id
  if (!id || !props.modelValue) return
  if (initial) loading.value = true
  error.value = ''
  try {
    const { data } = await tendersAPI.getAnalysis(id)
    if (request !== generation) return
    accept(data)
    if (initial) note.value = data.reviewed ? (data.review?.note ?? '') : ''
    schedule(request)
  } catch {
    if (request === generation) {
      error.value = '분석을 불러오지 못했습니다. 다시 시도해 주세요.'
      stopPolling()
    }
  } finally {
    if (request === generation) loading.value = false
  }
}
const mutate = async (action: 'analyze' | 'review') => {
  if (busy.value || !props.tender || (action === 'review' && !ready.value)) return
  stopPolling()
  const request = ++generation
  const id = props.tender.id
  busy.value = true
  error.value = ''
  pollingPaused.value = false
  pollCount = 0
  try {
    const { data } =
      action === 'analyze'
        ? await tendersAPI.reanalyze(id)
        : await tendersAPI.saveReview(id, { completed: true, note: note.value.trim() })
    if (request !== generation) return
    accept(data)
    schedule(request)
  } catch {
    if (request === generation)
      error.value =
        action === 'review'
          ? '검토를 저장하지 못했습니다. 입력한 메모는 유지됩니다.'
          : '분석을 요청하지 못했습니다. 다시 시도해 주세요.'
  } finally {
    if (request === generation) busy.value = false
  }
}
const reload = () => {
  stopPolling()
  pollCount = 0
  pollingPaused.value = false
  void fetchAnalysis(++generation)
}
watch(
  [() => props.modelValue, () => props.tender?.id],
  () => {
    const request = ++generation
    stopPolling()
    analysis.value = null
    note.value = ''
    error.value = ''
    busy.value = false
    loading.value = false
    pollCount = 0
    pollingPaused.value = false
    if (props.modelValue && props.tender) void fetchAnalysis(request)
  },
  { immediate: true },
)
onUnmounted(() => {
  ++generation
  stopPolling()
})
</script>
<template>
  <BaseModal
    :model-value="modelValue"
    title="입찰 공고 상세"
    width="1120px"
    max-width="95vw"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <article v-if="tender" class="tender-detail">
      <div class="flex flex-wrap items-center gap-2">
        <TenderRelevanceBadge :relevance="tender.relevance" /><span class="text-sm text-gray-500"
          >{{ tender.source }} · {{ tender.sourceNoticeId }}-{{ tender.revision }}</span
        ><TenderSuitabilityBadge
          v-if="analysis"
          :status="analysis.status"
          :suitability="analysis.suitability"
        /><span
          v-if="tender.bidEndedAt && new Date(tender.bidEndedAt).getTime() < Date.now()"
          class="text-sm text-gray-500"
          >마감</span
        >
      </div>
      <h4 class="mt-3 text-xl font-bold text-gray-900">{{ tender.title }}</h4>
      <p v-if="loading" role="status" class="mt-4">분석을 불러오는 중입니다.</p>
      <div v-if="error" role="alert" class="mt-4 text-red-700">
        {{ error }}
        <BaseButton type="button" size="small" :disabled="busy" @click="reload"
          >다시 불러오기</BaseButton
        >
      </div>
      <p v-if="analysis?.status === 'PARTIAL'" role="status" class="analysis-notice">
        부분 분석입니다. 확보하지 못한 문서와 조건을 원문에서 확인해 주세요.
      </p>
      <p v-if="analysis?.status === 'FAILED'" role="status" class="analysis-notice">
        분석 실패 · 원문을 확인하거나 다시 분석해 주세요. {{ boundedEvidence(analysis.errorCode) }}
      </p>
      <p v-if="analysis && isAnalysisActive(analysis.status)" role="status" class="analysis-notice">
        최신 자료로 분석 중입니다. 이전 결과는 현재 판단에 사용하지 않습니다.
      </p>
      <p v-if="pollingPaused" role="status" class="analysis-notice">
        자동 갱신을 일시 중지했습니다.
        <BaseButton type="button" size="small" @click="reload">진행 상태 확인</BaseButton>
      </p>
      <template v-if="analysis && ready">
        <TenderAnalysisSummary :analysis="analysis" />
        <p v-if="analysis.participationAnalysis?.profileMissing" class="analysis-notice">
          회사 자격을 설정해 주세요. 현재 회사 참가 자격은 확인 필요입니다.
        </p>
        <p v-if="analysis.review && !analysis.reviewed" class="analysis-notice">
          이전 검토 이후 분석이 변경되었거나 검토가 완료되지 않았습니다. 다시 검토해 주세요.
        </p>
        <div class="analysis-columns">
          <div class="analysis-stack">
            <TenderRequirementTable
              title="참가 조건"
              :requirements="analysis.participationAnalysis?.requirements ?? []"
              :evaluations="analysis.participationAnalysis?.evaluations ?? []"
            />
            <TenderRequirementTable
              title="요구 사양"
              :requirements="
                analysis.requirements?.flatMap((item) => item.specifications ?? []) ?? []
              "
              specifications
            />
            <TenderRequirementTable
              title="요구 인증"
              :requirements="analysis.certificationAnalysis?.requirements ?? []"
              :evaluations="analysis.certificationAnalysis?.evaluations ?? []"
            />
            <BaseCard :hoverable="false"
              ><h5 class="font-bold mb-3">근거 문장</h5>
              <p v-if="!analysis.evidence?.length" class="text-sm text-gray-600">
                확보한 근거가 없습니다. 원문 확인 필요
              </p>
              <figure
                v-for="(evidence, index) in (analysis.evidence ?? []).slice(0, 80)"
                :key="evidence.id ?? index"
                class="evidence"
              >
                <blockquote>{{ boundedEvidence(evidence.snippet) }}</blockquote>
                <figcaption>
                  {{
                    evidence.kind === 'CONFLICT'
                      ? '충돌 · 확인 필요'
                      : evidence.state === 'UNKNOWN'
                        ? '확인 필요'
                        : ''
                  }}
                  {{ boundedEvidence(evidence.documentIdentity || evidence.source) }}
                  {{ boundedEvidence(evidence.location) }}
                  <span v-if="evidence.revision"
                    >차수 {{ boundedEvidence(evidence.revision) }}</span
                  >
                </figcaption>
              </figure></BaseCard
            >
          </div>
          <aside class="analysis-stack" aria-label="가격 및 문서 상태">
            <TenderPriceAnalysis :price="analysis.priceAnalysis" /><BaseCard :hoverable="false"
              ><h5 class="font-bold mb-3">문서 추출 상태</h5>
              <p v-if="!analysis.documents.length" class="text-sm text-gray-600">
                확보한 첨부문서가 없습니다.
              </p>
              <ul>
                <li
                  v-for="doc in analysis.documents.slice(0, 10)"
                  :key="doc.id"
                  class="document-state"
                >
                  <strong>{{ boundedEvidence(doc.displayName) }}</strong>
                  <p>{{ documents[doc.status] }}</p>
                  <p v-if="doc.errorCode">
                    {{ boundedEvidence(doc.errorCode)
                    }}{{ doc.errorCode.includes('OCR') ? ' · OCR 필요' : '' }}
                  </p>
                </li>
              </ul></BaseCard
            >
          </aside>
        </div>
      </template>
      <dl class="tender-detail__grid">
        <div>
          <dt>발주기관</dt>
          <dd>{{ tender.orderingOrganization }}</dd>
        </div>
        <div>
          <dt>수요기관</dt>
          <dd>{{ tender.demandOrganization || '정보 없음' }}</dd>
        </div>
        <div>
          <dt>등록일</dt>
          <dd>{{ dateTime(tender.registeredAt) }}</dd>
        </div>
        <div>
          <dt>입찰 마감</dt>
          <dd>{{ dateTime(tender.bidEndedAt) }}</dd>
        </div>
        <div>
          <dt>지역</dt>
          <dd>{{ tender.region || '정보 없음' }}</dd>
        </div>
        <div>
          <dt>관련도 판정 근거</dt>
          <dd>{{ tender.relevanceReasons.map((r) => r.keyword).join(', ') }}</dd>
        </div>
      </dl>
      <label v-if="ready" class="review-note"
        >내부 검토 메모 (최대 2,000자)<textarea
          v-model="note"
          rows="3"
          maxlength="2000"
          :disabled="busy"
        />
      </label>
      <p v-if="analysis?.reviewed" role="status" class="text-sm text-green-800">✓ 검토 완료</p>
      <footer class="detail-actions">
        <a
          v-if="safeSourceUrl"
          :href="safeSourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="tender-detail__link"
          >공식 원문 열기 ↗</a
        >
        <p v-else>공식 원문 링크를 제공하지 않았습니다.</p>
        <BaseButton
          type="button"
          :disabled="
            loading ||
            busy ||
            (isAnalysisActive(analysis?.status) && analysis?.analysisFingerprint !== null)
          "
          @click="mutate('analyze')"
          >다시 분석</BaseButton
        ><BaseButton
          type="button"
          variant="primary"
          :disabled="!ready || loading || busy"
          @click="mutate('review')"
          >검토 완료</BaseButton
        >
      </footer>
    </article>
  </BaseModal>
</template>
<style scoped>
.tender-detail {
  overflow-wrap: anywhere;
}
.analysis-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 1rem;
}
.analysis-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.analysis-notice {
  margin: 1rem 0;
  padding: 0.85rem;
  border-radius: 0.5rem;
  background: #fff7e6;
  color: #854d0e;
  font-size: 0.875rem;
}
.tender-detail__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}
.tender-detail__grid div {
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: #f8fafc;
}
dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
}
dd {
  margin-top: 0.3rem;
  color: #111827;
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.2rem;
}
.tender-detail__link {
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  background: #0f8198;
  color: white;
  font-weight: 700;
}
.tender-detail__link:focus-visible {
  outline: 2px solid #22a8c3;
  outline-offset: 3px;
}
.evidence {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}
figcaption {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.4rem;
}
.document-state {
  margin: 0.75rem 0;
  font-size: 0.8rem;
}
.review-note {
  display: block;
  font-size: 0.875rem;
}
textarea {
  display: block;
  width: 100%;
  margin: 0.5rem 0;
  padding: 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}
@media (max-width: 760px) {
  .analysis-columns,
  .tender-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
