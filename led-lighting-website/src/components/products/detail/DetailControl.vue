<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import DetailHeading from './DetailHeading.vue'
import ControlSimulation from './ControlSimulation.vue'
const props = defineProps<{ title: string; options: string[] }>()
const selected = ref(Math.max(0, props.options.indexOf('그룹디밍')))
watch(
  () => props.options,
  () => {
    selected.value = Math.max(0, props.options.indexOf('그룹디밍'))
  },
  { deep: true },
)
const prefix = useId()
const current = computed(() => props.options[selected.value] || props.options[0] || '')
const description = computed(
  () =>
    ({
      개별디밍: '격등으로 배치한 조명을 한 대씩 서로 다른 밝기로 제어하는 방식입니다.',
      그룹디밍: '같은 구역의 조명을 함께 제어하는 방식입니다.',
      센서: '감지 조건에 맞춰 작동하도록 구성하는 방식입니다.',
      '발전기 비상': '꺼진 상태에서 비상 전원으로 전환되어 계속 켜집니다.',
      '밧데리 비상': '꺼진 상태에서 배터리 전원으로 전환되어 계속 켜집니다.',
      '배터리 비상': '꺼진 상태에서 배터리 전원으로 전환되어 계속 켜집니다.',
    })[current.value] || `${current.value} 구성을 상담할 수 있습니다.`,
)
const select = (index: number) => {
  selected.value = index
}
const handleKey = (event: KeyboardEvent, index: number) => {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? props.options.length - 1
        : (index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + props.options.length) %
          props.options.length
  selected.value = next
  ;(event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus()
}
</script>
<template>
  <section class="detail-control detail-section detail-container" data-section="control">
    <DetailHeading label="제어 옵션" :title="title" />
    <div class="detail-control-grid">
      <div
        class="detail-control-tabs"
        role="tablist"
        aria-label="제어 옵션 개념 보기"
        aria-orientation="vertical"
      >
        <button
          v-for="(option, index) in options"
          :id="`${prefix}-tab-${index}`"
          :key="option"
          type="button"
          role="tab"
          :aria-controls="`${prefix}-panel`"
          :aria-selected="selected === index"
          :tabindex="selected === index ? 0 : -1"
          @click="select(index)"
          @keydown="handleKey($event, index)"
        >
          <span>{{ String(index + 1).padStart(2, '0') }}</span
          ><strong>{{ option }}</strong
          ><span aria-hidden="true">↗</span>
        </button>
      </div>
      <div
        :id="`${prefix}-panel`"
        class="detail-control-panel"
        role="tabpanel"
        :aria-labelledby="`${prefix}-tab-${selected}`"
      >
        <ControlSimulation :key="current" :option="current" />
        <div aria-live="polite">
          <h3>{{ current }}</h3>
          <p>{{ description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
