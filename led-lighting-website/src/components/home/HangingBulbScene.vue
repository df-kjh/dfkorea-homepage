<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  createHangingBulbController,
  type HangingBulbController,
} from './hanging-bulb/createHangingBulbController'

const sceneContainer = ref<HTMLElement | null>(null)
const rendererContainer = ref<HTMLElement | null>(null)
const rendererReady = ref(false)

let controller: HangingBulbController | null = null
let hasTerminalFallback = false
let intersectionObserver: IntersectionObserver | null = null
let isSceneVisible = true
let reducedMotionQuery: MediaQueryList | null = null

const startController = (reducedMotion: boolean): void => {
  if (!rendererContainer.value) return
  rendererReady.value = false
  controller = createHangingBulbController({
    container: rendererContainer.value,
    reducedMotion,
    onReady: () => {
      rendererReady.value = true
    },
    onFallback: () => {
      hasTerminalFallback = true
      rendererReady.value = false
    },
  })
  if (!hasTerminalFallback && isSceneVisible) controller.start()
}

const handleIntersection: IntersectionObserverCallback = ([entry]) => {
  if (!entry || entry.isIntersecting === isSceneVisible || hasTerminalFallback) return
  isSceneVisible = entry.isIntersecting
  if (isSceneVisible) controller?.start()
  else controller?.pause()
}

const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
  if (hasTerminalFallback) return
  controller?.dispose()
  controller = null
  startController(event.matches)
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
  if (typeof window.IntersectionObserver === 'function' && sceneContainer.value) {
    intersectionObserver = new window.IntersectionObserver(handleIntersection)
    intersectionObserver.observe(sceneContainer.value)
  }
  startController(reducedMotionQuery.matches)
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  controller?.dispose()
  intersectionObserver = null
  reducedMotionQuery = null
  controller = null
})
</script>

<template>
  <div ref="sceneContainer" class="hanging-bulb" aria-hidden="true" style="touch-action: pan-y">
    <div
      data-test="hanging-bulb-fallback"
      class="hanging-bulb__fallback"
      :class="{ 'hanging-bulb__fallback--hidden': rendererReady }"
    >
      <div data-test="fallback-cable" class="fallback-cable"></div>
      <div data-test="fallback-bulb" class="fallback-bulb">
        <span class="fallback-bulb__socket"></span>
        <span class="fallback-bulb__housing"><span>LED · 4000 K</span></span>
        <span class="fallback-bulb__globe"></span>
      </div>
    </div>
    <div
      ref="rendererContainer"
      data-test="hanging-bulb-renderer"
      class="hanging-bulb__renderer"
      :class="rendererReady ? 'opacity-100' : 'opacity-0'"
    ></div>
  </div>
</template>

<style scoped>
.hanging-bulb {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.hanging-bulb__fallback,
.hanging-bulb__renderer {
  position: absolute;
  inset: 0;
}

.hanging-bulb__renderer {
  z-index: 2;
  transition: opacity 650ms ease;
}

.hanging-bulb__fallback {
  transition: opacity 450ms ease;
}

.hanging-bulb__fallback--hidden {
  opacity: 0;
}

.fallback-cable {
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: clamp(142px, 25vh, 228px);
  background: linear-gradient(#111719, #30383b 48%, #161b1d);
  box-shadow: 1px 0 rgba(255, 255, 255, 0.1);
  transform: translateX(-50%);
}

.fallback-bulb {
  position: absolute;
  top: clamp(136px, 25vh, 222px);
  left: 50%;
  width: 144px;
  height: 228px;
  transform: translateX(-50%);
}

.fallback-bulb__socket {
  position: absolute;
  top: 0;
  left: 50%;
  width: 40px;
  height: 49px;
  border-radius: 9px 9px 4px 4px;
  background:
    linear-gradient(90deg, #566067, transparent 35%, #ffffff66 52%, #27323988),
    repeating-linear-gradient(170deg, #ccd2d6 0 4px, #79848b 5px 7px, #eef0f1 8px 9px);
  transform: translateX(-50%);
}

.fallback-bulb__housing {
  position: absolute;
  top: 47px;
  left: 0;
  display: flex;
  width: 144px;
  height: 87px;
  align-items: end;
  justify-content: center;
  padding-bottom: 18px;
  clip-path: polygon(
    36% 0,
    64% 0,
    70% 22%,
    87% 64%,
    98% 88%,
    100% 100%,
    0 100%,
    2% 88%,
    13% 64%,
    30% 22%
  );
  background: linear-gradient(100deg, #899398, #e5e8e9 34%, #f4f5f5 58%, #a9b1b5);
  color: #687277;
  font: 7px/1.4 sans-serif;
  letter-spacing: 0.04em;
}

.fallback-bulb__globe {
  position: absolute;
  top: 133px;
  left: 0;
  width: 144px;
  height: 91px;
  border-top: 2px solid #aab0b1;
  border-radius: 3% 3% 50% 50% / 4% 4% 78% 78%;
  background: radial-gradient(ellipse at 44% 18%, #fffaf1, #f6eedf 50%, #d7d4cd 100%);
}

/* Animate emitted light only: the opaque housing must remain visible when powered down. */
.fallback-bulb__globe::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse at 45% 20%, #fffdf7, #fff3de 80%);
  box-shadow:
    0 0 35px #ffe4c43d,
    0 0 75px #ffe4c424;
  content: '';
  animation: fallback-flicker 5.4s linear infinite;
}

.hanging-bulb:hover .fallback-bulb__globe::before {
  animation: none;
  opacity: 1;
  filter: brightness(1.15);
}

@keyframes fallback-flicker {
  0%,
  16%,
  100% {
    opacity: 0.62;
  }
  19% {
    opacity: 0.8;
  }
  37% {
    opacity: 0.55;
  }
  39% {
    opacity: 0.74;
  }
  71% {
    opacity: 0.66;
  }
  73% {
    opacity: 0.48;
  }
  78% {
    opacity: 0.72;
  }
}

@keyframes mobile-fallback-power-cycle {
  0%,
  13.5%,
  18.95%,
  33.65%,
  37.2%,
  52.5%,
  60.85%,
  75.25%,
  79.85%,
  88.85%,
  93.35%,
  100% {
    opacity: 0.64;
  }
  14.6%,
  17.9%,
  34.7%,
  36.15%,
  53.5%,
  59.85%,
  76.25%,
  78.85%,
  89.85%,
  92.35% {
    opacity: 0;
  }
}

@media (max-width: 639px) {
  .fallback-bulb__globe::before {
    animation: mobile-fallback-power-cycle 12s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hanging-bulb__fallback,
  .hanging-bulb__renderer {
    transition: none;
  }

  .fallback-bulb__globe::before {
    animation: none;
    opacity: 0.62;
  }
}
</style>
