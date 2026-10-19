<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ option: string }>()
const paused = ref(false)
const reducedMotion = ref(false)
const emergencyOn = ref(false)
const replay = ref(0)
const emergency = computed(() => /^(?:발전기|밧데리|배터리)\s*비상$/.test(props.option))
const individual = computed(() => props.option === '개별디밍')
const dimming = computed(() => individual.value || props.option === '그룹디밍')
const animated = computed(() => emergency.value || dimming.value)
const lampCount = computed(() => (individual.value ? 6 : 3))
const status = computed(() => {
  if (emergency.value)
    return emergencyOn.value ? '비상 전원 · 상시 점등' : '전원 전환 대기 · 1초 후 점등'
  if (individual.value) return '1·3·5번 조명 개별 제어 · 2·4·6번 꺼짐'
  if (dimming.value) return '한 줄의 세 조명 · 같은 밝기로 함께 제어'
  if (props.option === '센서') return '감지 구역의 조명 점등 예시'
  return '등록된 제어 구성은 상담 시 확인해 주세요.'
})

let timer: ReturnType<typeof setTimeout> | undefined
let remaining = 1000
let startedAt = 0
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
  if (!mounted || !emergency.value || paused.value || emergencyOn.value) return
  startedAt = Date.now()
  timer = setTimeout(() => {
    emergencyOn.value = true
    remaining = 0
    timer = undefined
  }, remaining)
}
function restart() {
  clearTimer()
  remaining = 1000
  emergencyOn.value = false
  paused.value = false
  replay.value += 1
  startEmergency()
}
function togglePlayback() {
  if (!paused.value) {
    // Pause preserves the unfinished portion of the one-shot emergency delay.
    // CSS animation-play-state provides the same resume behavior for dimming.
    if (timer !== undefined) remaining = Math.max(0, remaining - (Date.now() - startedAt))
    clearTimer()
    paused.value = true
  } else {
    paused.value = false
    startEmergency()
  }
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
watch(() => props.option, restart, { immediate: true })
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
      :key="replay"
      class="control-simulation__room"
      :class="{ 'is-paused': paused }"
      :data-play-state="paused ? 'paused' : 'running'"
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
    <div v-if="animated" class="control-simulation__controls">
      <button
        type="button"
        :aria-label="paused ? '애니메이션 재생' : '애니메이션 일시정지'"
        :aria-pressed="paused"
        @click="togglePlayback"
      >
        <span aria-hidden="true">{{ paused ? '▶' : 'Ⅱ' }}</span>
        {{ paused ? '재생' : '일시정지' }}
      </button>
      <button type="button" aria-label="애니메이션 다시보기" @click="restart">
        <span aria-hidden="true">↻</span> 다시보기
      </button>
    </div>
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
.is-paused .control-simulation__lamp {
  animation-play-state: paused;
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
.control-simulation__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.control-simulation__controls button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 9px 14px;
  color: #e6e4d3;
  border: 1px solid #798466;
  background: #293323;
  border-radius: 3px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.control-simulation__controls button:hover {
  background: #36432e;
}
.control-simulation__controls button:focus-visible {
  outline: 2px solid #e5dfbb;
  outline-offset: 3px;
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
