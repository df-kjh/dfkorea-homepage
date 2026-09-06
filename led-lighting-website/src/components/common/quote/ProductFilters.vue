<script setup lang="ts">
import { computed } from 'vue'
import QuoteButton from './QuoteButton.vue'
import type { ProductFilters, ProductFilterOptions } from '@/types/quote'
const props = defineProps<{ modelValue: ProductFilters; options: ProductFilterOptions }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProductFilters] }>()
const basic = [
  { key: 'power', label: '소비전력', unit: 'W' },
  { key: 'certifications', label: '인증', unit: '' },
] as const
const advanced = [
  { key: 'colorTemp', label: '색온도', unit: 'K' },
  { key: 'options', label: '옵션', unit: '' },
] as const
const chips = computed(() =>
  [...basic, ...advanced].flatMap((group) =>
    props.modelValue[group.key].map((value) => ({
      key: group.key,
      value,
      text: `${value}${group.unit}`,
    })),
  ),
)
function toggle(key: keyof ProductFilters, value: string | number) {
  const values = props.modelValue[key] as (string | number)[]
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value],
  })
}
</script>
<template>
  <div class="q-filters">
    <div class="q-filter-row">
      <details v-for="group in basic" :key="group.key">
        <summary>
          {{ group.label }}
          <span v-if="modelValue[group.key].length">{{ modelValue[group.key].length }}</span
          ><span aria-hidden="true">⌄</span>
        </summary>
        <div class="q-filter-values">
          <label v-for="value in options[group.key]" :key="value"
            ><input
              type="checkbox"
              :checked="(modelValue[group.key] as (string | number)[]).includes(value)"
              @change="toggle(group.key, value)"
            />{{ value }}{{ group.unit }}</label
          >
          <p v-if="!options[group.key].length">등록된 선택지가 없습니다.</p>
        </div>
      </details>
    </div>
    <details class="q-more-filters">
      <summary>색온도·옵션 더 보기</summary>
      <fieldset v-for="group in advanced" :key="group.key">
        <legend>{{ group.label }}</legend>
        <div class="q-filter-values">
          <label v-for="value in options[group.key]" :key="value"
            ><input
              type="checkbox"
              :checked="(modelValue[group.key] as (string | number)[]).includes(value)"
              @change="toggle(group.key, value)"
            />{{ value }}{{ group.unit }}</label
          >
          <p v-if="!options[group.key].length">등록된 선택지가 없습니다.</p>
        </div>
      </fieldset>
    </details>
    <div v-if="chips.length" class="q-filter-chips" aria-label="선택한 검색 조건">
      <QuoteButton
        v-for="chip in chips"
        :key="`${chip.key}-${chip.value}`"
        :aria-label="`${chip.text} 조건 삭제`"
        @click="toggle(chip.key, chip.value)"
        >{{ chip.text }} ×</QuoteButton
      >
    </div>
  </div>
</template>
<style scoped>
.q-filters {
  color: #263348;
  font-size: 12px;
  margin: 10px 0;
}
.q-filter-row {
  display: flex;
  gap: 8px;
  align-items: start;
}
.q-filter-row > details {
  flex: 1;
  border: 1px solid #dce3ec;
  border-radius: 9px;
  background: #fff;
  min-width: 0;
}
summary {
  padding: 9px 11px;
  cursor: pointer;
  list-style: none;
  display: flex;
  gap: 6px;
  justify-content: space-between;
}
summary:focus-visible {
  outline: 3px solid #a8c9ff;
}
.q-filter-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
  font-size: 12px;
}
.q-filter-values label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
}
.q-filter-values input {
  accent-color: #0066ff;
}
.q-more-filters {
  margin-top: 6px;
}
fieldset {
  border: 1px solid #e5eaf1;
  border-radius: 8px;
  margin: 8px 0;
}
legend {
  padding: 0 8px;
}
.q-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.q-filter-chips button {
  font-size: 11px;
  min-height: 32px;
  background: #eef5ff;
  color: #0066ff;
}
</style>
