<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ option: string }>()
const reducedMotion = ref(false)
const emergencyOn = ref(false)
const emergency = computed(() => /^(?:발전기|밧데리|배터리)\s*비상$/.test(props.option))
const individual = computed(() => props.option === '개별디밍')
const dimming = computed(() => individual.value || props.option === '그룹디밍')
const lampCount = computed(() => (individual.value ? 6 : 3))
const status = computed(() => {
  if (emergency.value)
    return emergencyOn.value ? '비상 전원 · 상시 점등' : '비상 전원 전환 대기'
  if (individual.value) return '1·3·5번 조명 개별 제어 · 2·4·6번 꺼짐'
  if (dimming.value) return '한 줄의 세 조명 · 같은 밝기로 함께 제어'
  if (props.option === '센서') return '감지 구역의 조명 점등 예시'
  return '등록된 제어 구성은 상담 시 확인해 주세요.'
})

let timer: ReturnType<typeof setTimeout> | undefined
let media: MediaQueryList | undefined
let mounted = false

function clearTimer() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}
function startEmergency() {
  // SSR runs the immediate option watcher without a matching unmount hook.
  // Starting only after mount keeps countdown timers owned by a live browser view.
  if (!mounted || !emergency.value || emergencyOn.value) return
  // This delay illustrates the demo transition; it is not a product switching-time guarantee.
  timer = setTimeout(() => {
    emergencyOn.value = true
    timer = undefined
  }, 1000)
}
function resetEmergency() {
  clearTimer()
  emergencyOn.value = false
  startEmergency()
}
function onMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
}
function powered(index: number) {
  if (individual.value) return index % 2 === 0
  if (dimming.value) return true
  if (emergency.value) return emergencyOn.value
  return props.option === '센서' && index < 2
}
watch(() => props.option, resetEmergency, { immediate: true })
onMounted(() => {
  mounted = true
  startEmergency()
  if (typeof window.matchMedia !== 'function') return
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = media.matches
  media.addEventListener('change', onMotionChange)
})
onBeforeUnmount(() => {
  mounted = false
  clearTimer()
  media?.removeEventListener('change', onMotionChange)
})
</script>

<template>
  <div class="control-simulation">
    <div
      class="control-simulation__room"
      :data-motion="reducedMotion ? 'reduced' : 'full'"
      role="img"
      :aria-label="`${option} 제어 방식 설명용 개념도. ${status}`"
    >
      <span
        v-for="(_, index) in lampCount"
        :key="index"
        class="control-simulation__lamp"
        :class="{
          'is-on': powered(index),
          'is-dimming': dimming && powered(index) && !reducedMotion,
        }"
        :style="{ animationDelay: individual ? `${-(index / 2) * 1.2}s` : '0s' }"
        :data-lamp="index + 1"
        :data-powered="String(powered(index))"
        aria-hidden="true"
      ></span>
    </div>
    <div class="control-simulation__status" aria-live="polite">{{ status }}</div>
    <p v-if="reducedMotion && dimming" class="control-simulation__note">
      동작 감소 설정에 따라 밝기 변화를 멈춘 대표 상태입니다.
    </p>
  </div>
</template>

<style scoped>
.control-simulation__room {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 44px 26px;
  padding: 60px 24px;
  margin-block: 24px 18px;
  border-block: 1px solid #66725b55;
}
.control-simulation__lamp {
  display: block;
  height: 15px;
  border: 1px solid #748264;
  background: #303b2a;
  border-radius: 3px;
}
.control-simulation__lamp.is-on {
  background: #fff4c7;
  border-color: #fff4c7;
  box-shadow:
    0 0 14px 4px #fff1a85c,
    0 0 34px 12px #fff1a826;
}
.control-simulation__lamp.is-dimming {
  animation: control-dim 3.6s ease-in-out infinite;
}
@keyframes control-dim {
  0%,
  100% {
    opacity: 0.2;
    box-shadow: 0 0 5px #fff1a820;
  }
  50% {
    opacity: 1;
    box-shadow:
      0 0 18px 5px #fff1a870,
      0 0 36px 12px #fff1a830;
  }
}
.control-simulation__status {
  color: #c5cdb7;
  font-size: 13px;
  line-height: 1.7;
}
.control-simulation__note {
  margin-top: 12px;
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .control-simulation__lamp.is-dimming {
    animation: none;
  }
}
@media (max-width: 480px) {
  .control-simulation__room {
    gap: 38px 16px;
    padding: 48px 12px;
  }
}
</style>
