<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import TenderSuitabilityBadge from './TenderSuitabilityBadge.vue'
import { analysisAmount } from '@/utils/tender-analysis-display'
import type { TenderAnalysis } from '@/types'
const props = defineProps<{ analysis: TenderAnalysis }>()
const count = computed(
  () =>
    props.analysis.requirements?.reduce(
      (sum, item) => sum + (item.specifications?.length ?? 0),
      0,
    ) ?? 0,
)
const unknown = computed(() => Math.max(0, count.value - (props.analysis.comparableCount ?? 0)))
const coverageComplete = computed(
  () =>
    count.value >= (props.analysis.comparableCount ?? 0) &&
    !(props.analysis.evidence ?? []).some(
      (e) => e.diagnosticCategory === 'TRUNCATION' && e.field === 'normalizedDetail',
    ),
)
const certificates = computed(() =>
  (props.analysis.certificationAnalysis?.requirements ?? []).map(
    (requirement) =>
      props.analysis.certificationAnalysis?.evaluations?.find(
        (e) => requirement.id && e.requirementId === requirement.id,
      ) ?? { state: 'UNKNOWN' },
  ),
)
</script>
<template>
  <section class="analysis-summary" aria-label="적합성 분석 요약">
    <BaseCard :hoverable="false"
      ><h5>참여 검토</h5>
      <TenderSuitabilityBadge :status="analysis.status" :suitability="analysis.suitability" />
      <p>전체 확인 필요 {{ analysis.unknownCount ?? 0 }}개</p></BaseCard
    >
    <BaseCard :hoverable="false"
      ><h5>사양 충족도</h5>
      <strong>{{
        analysis.specificationScore == null ? '계산 불가' : `${analysis.specificationScore}%`
      }}</strong>
      <p v-if="coverageComplete">
        {{ count }}개 중 {{ analysis.satisfiedCount ?? 0 }}개 충족,
        {{ analysis.unsatisfiedCount ?? 0 }}개 불일치, {{ unknown }}개 확인 필요
      </p>
      <p v-if="coverageComplete">
        분석 범위 {{ analysis.comparableCount ?? 0 }}/{{ count }} · 표시된 요구 사양 기준
      </p>
      <p v-else>
        전체 사양 수 확인 필요 · 표시 {{ count }}개, 비교 가능
        {{ analysis.comparableCount ?? 0 }}개. {{ analysis.satisfiedCount ?? 0 }}개 충족,
        {{ analysis.unsatisfiedCount ?? 0 }}개 불일치
      </p></BaseCard
    >
    <BaseCard :hoverable="false"
      ><h5>요구 인증</h5>
      <strong>{{ certificates.filter((c) => c.state === 'SATISFIED').length }}개 충족</strong>
      <p>
        {{ certificates.filter((c) => c.state === 'UNSATISFIED').length }}개 미충족 ·
        {{
          certificates.filter((c) => c.state !== 'SATISFIED' && c.state !== 'UNSATISFIED').length
        }}개 확인 필요
      </p></BaseCard
    >
    <BaseCard :hoverable="false"
      ><h5>통계 예상 투찰가</h5>
      <strong>{{
        analysis.priceAnalysis?.statistics?.status === 'AVAILABLE'
          ? analysisAmount(analysis.priceAnalysis.statistics.estimatedPrice)
          : '확인 필요'
      }}</strong>
      <p>과거 개찰 결과를 이용한 참고값</p></BaseCard
    >
  </section>
</template>
<style scoped>
.analysis-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0;
}
.analysis-summary :deep(.card-body) {
  padding: 1rem;
}
h5 {
  font-size: 0.8rem;
  color: #475569;
  margin-bottom: 0.65rem;
  font-weight: 700;
}
strong {
  display: block;
  font-size: 1.2rem;
  overflow-wrap: anywhere;
  color: #111827;
}
p {
  font-size: 0.75rem;
  margin-top: 0.5rem;
  color: #475569;
}
@media (max-width: 900px) {
  .analysis-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .analysis-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
