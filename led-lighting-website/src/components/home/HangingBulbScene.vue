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
  width: 128px;
  height: 224px;
  transform: translateX(-50%);
  filter: drop-shadow(0 0 24px rgba(255, 169, 69, 0.2));
  animation: fallback-flicker 5.4s linear infinite;
}

.fallback-bulb__socket {
  position: absolute;
  top: 0;
  left: 50%;
  width: 38px;
  height: 52px;
  border-radius: 7px 7px 5px 5px;
  background: repeating-linear-gradient(
    to bottom,
    #c3a06c 0,
    #c3a06c 7px,
    #826138 8px,
    #826138 11px
  );
  box-shadow:
    inset 7px 0 rgba(255, 244, 218, 0.16),
    inset -6px 0 rgba(66, 42, 18, 0.22);
  transform: translateX(-50%);
}

.fallback-bulb__globe {
  position: absolute;
  top: 48px;
  left: 50%;
  width: 122px;
  height: 160px;
  border: 1px solid rgba(255, 234, 202, 0.58);
  border-radius: 43% 43% 49% 49% / 35% 35% 65% 65%;
  background:
    radial-gradient(circle at 34% 24%, rgba(255, 255, 255, 0.68) 0 3%, transparent 15%),
    radial-gradient(
      circle at 50% 48%,
      rgba(255, 183, 72, 0.18),
      rgba(255, 225, 183, 0.07) 48%,
      rgba(255, 255, 255, 0.02) 72%
    );
  box-shadow:
    inset 8px 4px 18px rgba(255, 255, 255, 0.12),
    inset -8px -2px 18px rgba(101, 52, 13, 0.08),
    0 0 24px rgba(255, 184, 74, 0.2),
    0 0 64px rgba(255, 139, 38, 0.1);
  transform: translateX(-50%);
}

.fallback-bulb__globe::before {
  position: absolute;
  top: 48px;
  left: 50%;
  width: 3px;
  height: 62px;
  border-radius: 999px;
  background: #ff9a38;
  box-shadow:
    -15px 0 #ffb14d,
    15px 0 #ffb14d,
    0 0 14px 5px rgba(255, 132, 31, 0.32);
  content: '';
  transform: translateX(-50%);
}

.hanging-bulb:hover .fallback-bulb {
  filter: brightness(1.55) drop-shadow(0 0 48px rgba(255, 169, 69, 0.48));
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
  .fallback-bulb {
    animation: mobile-fallback-power-cycle 12s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hanging-bulb__fallback,
  .hanging-bulb__renderer {
    transition: none;
  }

  .fallback-bulb {
    animation: none;
    opacity: 0.62;
  }
}
</style>
