<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import type { TenderEvaluation, TenderRequirement } from '@/types'
import { requirementLabel, requirementValue } from '@/utils/tender-analysis-display'
const props = defineProps<{
  title: string
  requirements: TenderRequirement[]
  evaluations?: TenderEvaluation[]
  specifications?: boolean
}>()
const states = { SATISFIED: '✓ 충족', UNSATISFIED: '× 미충족', UNKNOWN: '? 확인 필요' }
const state = (id?: string | null) =>
  states[props.evaluations?.find((e) => id && e.requirementId === id)?.state ?? 'UNKNOWN']
</script>
<template>
  <BaseCard :hoverable="false"
    ><h5 class="font-bold mb-3">{{ title }}</h5>
    <p v-if="!requirements.length" class="text-sm text-gray-600">
      구조화된 조건이 없습니다. 원문 확인 필요
    </p>
    <template v-else
      ><p v-if="specifications" class="text-sm text-gray-600 mb-3">
        사양 판정은 상단 집계로 제공합니다. 아래는 공고의 요구값입니다.
      </p>
      <div class="requirement-scroll">
        <table>
          <caption class="sr-only">
            {{
              title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">조건</th>
              <th scope="col">요구값</th>
              <th scope="col">{{ specifications ? '구분' : '확인 결과' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, index) in requirements.slice(0, 80)" :key="r.id ?? index">
              <th scope="row">
                {{ requirementLabel(r)
                }}<small v-if="!specifications">{{ r.required ? '필수' : '참고' }}</small>
              </th>
              <td>{{ requirementValue(r) }}</td>
              <td>{{ specifications ? (r.required ? '필수' : '참고') : state(r.id) }}</td>
            </tr>
          </tbody>
        </table>
      </div></template
    ></BaseCard
  >
</template>
<style scoped>
.requirement-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  text-align: left;
  vertical-align: top;
  padding: 0.65rem 0.4rem;
  border-bottom: 1px solid #e5e7eb;
  overflow-wrap: anywhere;
}
thead th {
  color: #475569;
}
small {
  display: block;
  color: #64748b;
  font-weight: 400;
}
</style>
