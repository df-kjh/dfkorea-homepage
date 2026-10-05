<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
import { mountLightField, type LightFieldController } from './liquid-light/light-field'

interface Props {
  title?: string
  subtitle?: string
  eyebrow?: string
  primaryButtonText?: string
  secondaryButtonText?: string
}
const props = withDefaults(defineProps<Props>(), {
  title: '빛의 새로운 흐름.',
  subtitle: '빛을 만드는 기술. 공간을 바꾸는 감각.\nDF KOREA의 LED 조명으로 시작됩니다.',
  eyebrow: 'LIGHT, IN A NEW FORM',
  primaryButtonText: '제품 보기',
  secondaryButtonText: '회사 소개',
})
const emit = defineEmits<{ primaryClick: []; secondaryClick: []; scrollDown: [] }>()
const heroSection = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const motionControl = ref<HTMLButtonElement | null>(null)
let controller: LightFieldController | null = null
const headingLines = computed(() =>
  props.title === '빛의 새로운 흐름.' ? ['빛의 새로운', '흐름.'] : [props.title],
)

onMounted(() => {
  if (!heroSection.value || !canvas.value || !motionControl.value) return
  // The field owns its static control label/aria nodes; Vue owns copy and route actions.
  controller = mountLightField({
    canvas: canvas.value,
    hero: heroSection.value,
    control: motionControl.value,
  })
})
onBeforeUnmount(() => {
  controller?.dispose()
  controller = null
})
function scrollDown() {
  if (!heroSection.value) return
  emit('scrollDown')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: window.scrollY + heroSection.value.getBoundingClientRect().bottom,
    behavior: reduced ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <section ref="heroSection" class="hero-shell" data-light-hero aria-label="DF KOREA의 빛">
    <div class="light-fallback" aria-hidden="true"></div>
    <canvas ref="canvas" data-light-canvas aria-hidden="true"></canvas>
    <div class="light-scrim" aria-hidden="true"></div>
    <div class="hero-copy" data-test="hero-copy">
      <p class="hero-eyebrow"><span aria-hidden="true"></span>{{ eyebrow }}</p>
      <h1 class="hero-title" :aria-label="title">
        <span v-for="(line, index) in headingLines" :key="index">{{ line }}</span>
      </h1>
      <p class="hero-subtitle">{{ subtitle }}</p>
      <div class="hero-actions" data-test="hero-actions">
        <PublicAction variant="light" @click="emit('primaryClick')">{{
          primaryButtonText
        }}</PublicAction>
        <PublicAction variant="outline" @click="emit('secondaryClick')">{{
          secondaryButtonText
        }}</PublicAction>
      </div>
    </div>
    <div class="hero-motion">
      <p data-pointer-hint>정적 빛을 표시합니다</p>
      <button
        ref="motionControl"
        type="button"
        class="hero-motion-button"
        data-motion-control
        disabled
        aria-label="정적 빛 표시"
        aria-pressed="false"
      >
        <svg class="pause-mark" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3v10M11 3v10" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <svg class="play-mark" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m5 3 8 5-8 5Z" fill="currentColor" />
        </svg>
        <span data-motion-label>정적 보기</span>
      </button>
    </div>
    <button
      type="button"
      class="hero-scroll-control"
      data-test="hero-scroll-down"
      aria-label="다음 섹션으로 이동"
      @click="scrollDown"
    >
      <span>SCROLL TO DISCOVER</span><span aria-hidden="true">↓</span>
    </button>
  </section>
</template>

<style scoped>
/* The page owns typography/layout. These layers only paint its light field. */
[data-light-hero] .light-fallback,
[data-light-hero] [data-light-canvas],
[data-light-hero] .light-scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
[data-light-hero] .light-fallback {
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 78% 26%, #80551934, transparent 46%),
    radial-gradient(ellipse at 22% 85%, #bd762222, transparent 43%), #080906;
}
[data-light-hero] .light-fallback::before,
[data-light-hero] .light-fallback::after {
  content: '';
  position: absolute;
  width: 150%;
  height: 68%;
  left: -25%;
  top: 40%;
  border: 2px solid #ffdb9d;
  border-radius: 48%;
  transform: rotate(-29deg);
  box-shadow:
    0 0 8px #fff0d4,
    0 0 24px #db9c4c,
    inset 0 0 30px #cf8a2818;
  opacity: 0.7;
}
[data-light-hero] .light-fallback::after {
  top: 47%;
  height: 48%;
  border-width: 12px;
  filter: blur(10px);
  box-shadow: 0 0 50px #f4c367;
  opacity: 0.85;
}
[data-light-hero] [data-light-canvas] {
  z-index: 1;
  display: block;
  opacity: 0;
}
[data-light-hero] [data-light-canvas][data-render-state='ready'] {
  opacity: 1;
}
[data-light-hero] .light-scrim {
  z-index: 2;
  background:
    linear-gradient(180deg, #05060355, transparent 20%, #07080517 62%, #070805c0),
    radial-gradient(ellipse at 50% 39%, #03050233, transparent 61%);
}

.hero-shell {
  position: relative;
  isolation: isolate;
  min-height: 760px;
  height: 100svh;
  max-height: 1250px;
  overflow: hidden;
  background: #080906;
  color: #f0ece3;
  display: grid;
  place-items: center;
}
.hero-copy {
  position: relative;
  z-index: 3;
  text-align: center;
  width: 100%;
  max-width: 900px;
  padding: 100px 24px 140px;
}
.hero-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-size: 10px;
  letter-spacing: 0.23em;
  color: #efdbc1;
  margin: 0 0 31px;
}
.hero-eyebrow > span {
  width: 4px;
  height: 4px;
  background: #efd1a5;
  border-radius: 50%;
  box-shadow: 0 0 8px #f5d099;
}
.hero-title {
  font-size: clamp(68px, 7.9vw, 118px);
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -0.085em;
  margin: 0;
  text-shadow: 0 2px 30px #0005;
}
.hero-title > span {
  display: block;
}
.hero-title > span + span {
  color: #e6dccb;
}
.hero-subtitle {
  white-space: pre-line;
  color: #d4d7cb;
  font-size: 13px;
  line-height: 1.9;
  letter-spacing: -0.03em;
  margin: 30px 0 0;
  text-shadow: 0 1px 15px #000;
}
.hero-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 30px;
}
.hero-actions :deep(.public-action) {
  justify-content: center;
  text-align: center;
  font-size: 12px;
  min-width: 128px;
  min-height: 49px;
  padding: 14px 22px;
  border-radius: 999px;
}
.hero-actions :deep(.public-action--outline) {
  color: #f0ece3;
  border-color: #ffffff40;
  background: #0d100b40;
  backdrop-filter: blur(8px);
}
.hero-motion {
  position: absolute;
  z-index: 4;
  bottom: 33px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  max-width: calc(100% - 44px);
}
.hero-motion p {
  color: #c7c6b7;
  font-size: 9px;
  line-height: 1.8;
  white-space: nowrap;
  margin: 0 0 10px;
}
.hero-motion-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  min-width: 112px;
  padding: 10px 18px;
  border: 1px solid #ffffff2c;
  border-radius: 999px;
  background: #0809067d;
  backdrop-filter: blur(12px);
  color: #dfdece;
  font-size: 10px;
  cursor: pointer;
}
.hero-motion-button:disabled {
  color: #a3a596;
  cursor: default;
}
.hero-motion-button .play-mark {
  display: none;
}
.hero-motion-button[aria-pressed='true'] .play-mark {
  display: block;
}
.hero-motion-button[aria-pressed='true'] .pause-mark {
  display: none;
}
.hero-scroll-control {
  position: absolute;
  z-index: 4;
  bottom: 43px;
  left: clamp(24px, 5vw, 72px);
  display: flex;
  align-items: center;
  gap: 18px;
  border: 0;
  background: none;
  color: #bfc3b4;
  font-size: 8px;
  letter-spacing: 0.14em;
  padding: 0;
  min-height: 40px;
  cursor: pointer;
}
.hero-scroll-control > span:last-child {
  font-size: 21px;
}
.hero-motion-button:focus-visible,
.hero-scroll-control:focus-visible {
  outline: 2px solid #e4c99b;
  outline-offset: 5px;
}
@media (max-width: 700px) {
  .hero-shell {
    min-height: max(800px, 100svh);
    height: max(800px, 100svh);
    max-height: none;
  }
  .hero-copy {
    padding: 95px 22px 190px;
  }
  .hero-eyebrow {
    font-size: 8px;
    letter-spacing: 0.17em;
    margin-bottom: 29px;
  }
  .hero-title {
    font-size: clamp(53px, 12.7vw, 73px);
    line-height: 1.12;
    letter-spacing: -0.08em;
  }
  .hero-subtitle {
    font-size: 12px;
    line-height: 1.9;
    margin-top: 26px;
  }
  .hero-actions {
    margin-top: 28px;
    gap: 8px;
  }
  .hero-actions :deep(.public-action) {
    font-size: 11px;
    min-width: 110px;
    padding: 13px 19px;
    min-height: 46px;
  }
  .hero-motion {
    bottom: 112px;
  }
  .hero-motion p {
    font-size: 8px;
  }
  .hero-scroll-control {
    bottom: 48px;
    left: 24px;
    font-size: 7px;
    gap: 10px;
  }
  .hero-scroll-control > span:last-child {
    font-size: 18px;
  }
}
@media (max-width: 360px) {
  .hero-copy {
    padding: 100px 18px 195px;
  }
  .hero-title {
    font-size: 50px;
  }
  .hero-eyebrow {
    font-size: 7px;
    letter-spacing: 0.13em;
  }
  .hero-subtitle {
    font-size: 11px;
  }
  .hero-actions :deep(.public-action) {
    min-width: 100px;
    padding-inline: 15px;
    font-size: 10px;
  }
  .hero-scroll-control {
    left: 20px;
    font-size: 6px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero-actions :deep(.public-action) {
    transition: none;
  }
}
</style>
