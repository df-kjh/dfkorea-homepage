<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  createParkingGarageController,
  type ParkingGarageController,
} from './parking-garage/parkingGarageScene'

const rendererContainer = ref<HTMLElement | null>(null)
const sceneContainer = ref<HTMLElement | null>(null)
const rendererReady = ref(false)
const fallbackImage = '/images/home/parking-garage-fallback.webp'
const defaultFallbackImage = '/images/main-hero.jpg'

let controller: ParkingGarageController | null = null
let intersectionObserver: IntersectionObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
let hasTerminalFallback = false
let isSceneVisible = true

const startController = (reducedMotion: boolean): void => {
  if (!rendererContainer.value) return

  rendererReady.value = false
  const nextController = createParkingGarageController({
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
  controller = nextController
  if (!hasTerminalFallback && isSceneVisible) nextController.start()
}

const handleIntersection: IntersectionObserverCallback = ([entry]) => {
  if (!entry || entry.isIntersecting === isSceneVisible) return

  isSceneVisible = entry.isIntersecting
  if (hasTerminalFallback) return
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
  intersectionObserver = null
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  reducedMotionQuery = null
  controller?.dispose()
  controller = null
})
</script>

<template>
  <div
    ref="sceneContainer"
    class="absolute inset-0 overflow-hidden"
    style="touch-action: pan-y"
    aria-hidden="true"
  >
    <picture class="absolute inset-0 block h-full w-full">
      <source :srcset="fallbackImage" type="image/webp" />
      <img
        :src="defaultFallbackImage"
        alt=""
        class="h-full w-full object-cover"
        loading="eager"
        fetchpriority="high"
      />
    </picture>
    <div
      ref="rendererContainer"
      data-test="parking-garage-renderer"
      class="absolute inset-0 z-10 transition-opacity duration-500"
      :class="rendererReady ? 'opacity-100' : 'opacity-0'"
    ></div>
  </div>
</template>
