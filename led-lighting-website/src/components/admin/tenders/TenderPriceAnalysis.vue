<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import type { TenderPriceAnalysis } from '@/types'
import { analysisAmount, analysisRate } from '@/utils/tender-analysis-display'
defineProps<{ price: TenderPriceAnalysis | null }>()
const confidence = {
  INSUFFICIENT: '표본 부족',
  LOW: '신뢰도 낮음',
  MEDIUM: '신뢰도 보통',
  HIGH: '신뢰도 높음',
}
const matching = {
  ITEM_METHOD_REGION: '동일 세부품명·낙찰 방식·지역',
  ITEM_METHOD: '동일 세부품명·낙찰 방식',
  LED_GROUP_METHOD: '동일 LED 제품군·낙찰 방식',
}
</script>
<template>
  <BaseCard :hoverable="false"
    ><h5 class="font-bold mb-3">가격 분석</h5>
    <dl>
      <dt>기초금액</dt>
      <dd>{{ analysisAmount(price?.basisAmount) }}</dd>
      <dt>낙찰하한율</dt>
      <dd>{{ price?.lowerLimitRate ? `${price.lowerLimitRate}%` : '확인 필요' }}</dd>
    </dl>
    <h6>공식 계산 범위</h6>
    <p v-if="price?.official?.status === 'AVAILABLE'">
      {{ analysisAmount(price.official.minimum) }} ~ {{ analysisAmount(price.official.maximum) }}
    </p>
    <p v-else>산식 확인 필요</p>
    <h6>과거 개찰 통계</h6>
    <template v-if="price?.statistics"
      ><p>
        {{ confidence[price.statistics.confidence ?? 'INSUFFICIENT'] }} · 표본
        {{ price.statistics.sampleCount ?? 0 }}건
      </p>
      <p>이상값 제외 {{ price.statistics.excludedCount ?? 0 }}건</p>
      <p>
        {{
          price.statistics.matchingLevel
            ? matching[price.statistics.matchingLevel]
            : '비교 기준 확인 필요'
        }}
      </p>
      <p v-if="price.statistics.period">
        분석 기간 {{ price.statistics.period.start }} ~ {{ price.statistics.period.end }}
      </p>
      <template v-if="price.statistics.status === 'AVAILABLE'"
        ><dl>
          <dt>사정률 중앙값</dt>
          <dd>{{ analysisRate(price.statistics.adjustmentRate?.median) }}</dd>
          <dt>낙찰률 중앙값</dt>
          <dd>{{ analysisRate(price.statistics.winningRate?.median) }}</dd>
          <dt>통계 예상 투찰가</dt>
          <dd>{{ analysisAmount(price.statistics.estimatedPrice) }}</dd>
          <dt>예상 범위 (25~75 백분위)</dt>
          <dd>
            {{ analysisAmount(price.statistics.minimum) }} ~
            {{ analysisAmount(price.statistics.maximum) }}
          </dd>
        </dl></template
      >
      <p v-else>
        {{
          price.statistics.status === 'INCOMPARABLE_CONTRACT'
            ? '계약 비교 기준 확인 필요'
            : '통계 예측 미제공 · 유효 표본 15건 이상 필요'
        }}
      </p></template
    >
    <p v-else>통계 자료 확인 필요</p>
    <p class="price-notice">
      공고 원문의 산식이 우선합니다. 예상 투찰가는 실제 낙찰가나 낙찰 가능성을 보장하지 않습니다.
    </p></BaseCard
  >
</template>
<style scoped>
h6 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
  font-size: 0.9rem;
}
dt {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.6rem;
}
dd,
p {
  font-size: 0.85rem;
  margin-top: 0.3rem;
  overflow-wrap: anywhere;
}
.price-notice {
  margin-top: 1rem;
  color: #64748b;
  font-size: 0.75rem;
}
</style>
