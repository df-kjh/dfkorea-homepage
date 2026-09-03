<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import HangingBulbScene from './HangingBulbScene.vue'

interface Props {
  title?: string
  subtitle?: string
  eyebrow?: string
  primaryButtonText?: string
  secondaryButtonText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Light Your Life.',
  subtitle:
    'Experience the future of architectural illumination. Precision-engineered for modern spaces.',
  eyebrow: 'DF KOREA · ARCHITECTURAL LIGHTING',
  primaryButtonText: '제품 보기',
  secondaryButtonText: '회사 소개',
})

const emit = defineEmits<{
  primaryClick: []
  secondaryClick: []
}>()

const heroSection = ref<HTMLElement | null>(null)

const scrollDown = (): void => {
  if (!heroSection.value) return
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: window.scrollY + heroSection.value.getBoundingClientRect().bottom,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <section ref="heroSection" class="hero-shell hero-shell--viewport-fill">
    <div class="hero-ambient hero-ambient--left"></div>
    <div class="hero-ambient hero-ambient--right"></div>
    <div class="hero-grid-lines"></div>
    <div
      data-test="hero-transition"
      class="hero-transition"
      aria-hidden="true"
    ></div>

    <div
      data-test="hero-layout"
      class="absolute inset-0 z-10 mx-auto flex w-full max-w-[1440px] items-center justify-center gap-8 px-6 py-20 sm:relative sm:inset-auto sm:grid sm:h-full sm:justify-normal sm:pb-20 sm:pt-28 md:px-12 lg:grid-cols-2 lg:gap-4 lg:px-16 lg:pb-12 lg:pt-24 xl:px-24"
    >
      <div
        data-test="hero-copy"
        class="relative z-20 flex w-full flex-col items-center text-center sm:block sm:text-left lg:pr-8 xl:pr-14"
      >
        <p class="hero-eyebrow">{{ eyebrow }}</p>
        <h1 class="hero-title">{{ title }}</h1>
        <p class="hero-subtitle">{{ subtitle }}</p>

        <div
          data-test="hero-actions"
          class="mt-9 flex flex-wrap justify-center gap-3 sm:justify-start md:mt-11"
        >
          <BaseButton
            variant="primary"
            size="large"
            icon-right="arrow_forward"
            custom-class="hero-button-primary"
            @click="emit('primaryClick')"
          >
            {{ primaryButtonText }}
          </BaseButton>
          <BaseButton
            variant="default"
            size="large"
            custom-class="hero-button-secondary"
            @click="emit('secondaryClick')"
          >
            {{ secondaryButtonText }}
          </BaseButton>
        </div>

        <div
          class="mt-12 hidden items-center gap-4 text-[11px] font-medium tracking-[0.22em] text-white/36 md:flex"
        >
          <span class="h-px w-12 bg-cyan-100/35"></span>
          LIGHT · EFFICIENCY · PRECISION
        </div>
      </div>

      <div
        data-test="hero-visual"
        class="hero-visual pointer-events-none absolute inset-x-0 bottom-8 top-16 z-0 min-h-[340px] w-full opacity-[0.32] sm:pointer-events-auto sm:relative sm:inset-auto sm:min-h-[420px] sm:opacity-100 lg:h-[72vh] lg:min-h-0 lg:max-h-[760px]"
      >
        <HangingBulbScene />
      </div>
    </div>

    <button
      type="button"
      data-test="hero-scroll-down"
      class="hero-scroll-control"
      aria-label="다음 섹션으로 이동"
      @click="scrollDown"
    >
      <span class="hero-scroll-control__line"></span>
      <span class="material-symbols-outlined text-[20px]">south</span>
    </button>
  </section>
</template>

<style scoped>
.hero-shell {
  position: relative;
  min-height: 760px;
  height: 100svh;
  max-height: 1040px;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at 73% 45%, rgba(31, 88, 109, 0.22), transparent 33%),
    linear-gradient(135deg, #111a21 0%, #080d12 55%, #05080b 100%);
}

.hero-transition {
  position: absolute;
  z-index: 4;
  right: 0;
  bottom: -1px;
  left: 0;
  height: clamp(140px, 18vh, 210px);
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(5, 8, 11, 0.18) 24%,
    rgba(45, 51, 55, 0.44) 52%,
    rgba(207, 210, 212, 0.82) 84%,
    #ffffff 100%
  );
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 34%, black 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 34%, black 100%);
}

.hero-ambient {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(8px);
}

.hero-ambient--left {
  top: 13%;
  left: -10%;
  width: 44vw;
  height: 44vw;
  background: radial-gradient(circle, rgba(63, 118, 141, 0.09), transparent 67%);
}

.hero-ambient--right {
  top: 25%;
  right: -8%;
  width: 42vw;
  height: 42vw;
  background: radial-gradient(circle, rgba(139, 225, 255, 0.1), transparent 65%);
}

.hero-grid-lines {
  position: absolute;
  inset: 0;
  opacity: 0.14;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 76px 76px;
  mask-image: linear-gradient(to right, black, transparent 68%);
}

.hero-eyebrow {
  margin-bottom: 1.25rem;
  color: rgba(191, 236, 249, 0.7);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.24em;
}

.hero-title {
  max-width: 720px;
  color: #f6f8f9;
  font-size: clamp(3.25rem, 5.8vw, 6.8rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.065em;
  text-wrap: balance;
}

.hero-subtitle {
  max-width: 530px;
  margin-top: 1.75rem;
  color: rgba(227, 235, 239, 0.62);
  font-size: clamp(1rem, 1.35vw, 1.25rem);
  font-weight: 400;
  line-height: 1.75;
}

.hero-shell :deep(.base-button.hero-button-primary),
.hero-shell :deep(.base-button.hero-button-secondary) {
  min-width: 148px;
  border-radius: 999px;
  padding: 0.9rem 1.65rem;
  font-size: 0.95rem;
}

.hero-shell :deep(.base-button.hero-button-primary) {
  border: 1px solid #eefbff;
  background: #eefbff;
  color: #0c151b;
  box-shadow: 0 10px 34px rgba(122, 222, 255, 0.12);
}

.hero-shell :deep(.base-button.hero-button-primary:hover) {
  border-color: white;
  background: white;
  box-shadow: 0 12px 42px rgba(122, 222, 255, 0.22);
}

.hero-shell :deep(.base-button.hero-button-secondary) {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
}

.hero-shell :deep(.base-button.hero-button-secondary:hover) {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.08);
}

.hero-scroll-control {
  position: absolute;
  z-index: 6;
  right: clamp(1.5rem, 4vw, 4.5rem);
  bottom: 2.1rem;
  display: flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  cursor: pointer;
  transition: color 200ms ease;
}

.hero-scroll-control:hover {
  color: rgba(255, 255, 255, 0.82);
}

.hero-scroll-control__line {
  display: block;
  width: 38px;
  height: 1px;
  background: currentColor;
}

@media (max-width: 1023px) {
  .hero-shell {
    min-height: 900px;
    height: auto;
  }

  .hero-title {
    max-width: 660px;
  }
}

@media (max-width: 639px) {
  .hero-shell--viewport-fill {
    width: 100%;
    min-height: max(820px, 100svh);
    height: max(820px, 100svh);
    max-height: none;
  }

  .hero-title {
    margin-inline: auto;
    font-size: clamp(2.8rem, 14vw, 4rem);
    text-shadow: 0 3px 28px rgba(2, 5, 8, 0.9);
  }

  .hero-subtitle {
    max-width: 320px;
    margin-top: 1.25rem;
    margin-inline: auto;
    line-height: 1.65;
    text-shadow: 0 2px 18px rgba(2, 5, 8, 0.95);
  }

  .hero-eyebrow {
    text-shadow: 0 2px 14px rgba(2, 5, 8, 0.95);
  }

  .hero-visual {
    mask-image: radial-gradient(ellipse 72% 58% at 50% 43%, black 8%, transparent 76%);
  }

  .hero-scroll-control {
    right: 1rem;
    bottom: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.base-button),
  .hero-scroll-control {
    transition: none;
  }
}
</style>
