<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Props {
  title?: string
  subtitle?: string
  backgroundImage?: string
  primaryButtonText?: string
  secondaryButtonText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Light Your Life.',
  subtitle:
    'Experience the future of architectural illumination. Precision-engineered for modern spaces.',
  backgroundImage: '/images/main-hero.jpg',
  primaryButtonText: '제품 보기',
  secondaryButtonText: '회사 소개',
})

const emit = defineEmits<{
  primaryClick: []
  secondaryClick: []
}>()

// 동영상 로딩 상태
const videoLoading = ref(true)

const handleVideoLoaded = () => {
  videoLoading.value = false
}

const scrollDown = (): void => {
  window.scrollTo({
    top: window.innerHeight * 0.9,
    behavior: 'smooth',
  })
}

// Parallax 효과를 위한 ref
const scrollY = ref(0)
const bgTransform = ref('')
const contentTransform = ref('')
const contentOpacity = ref(1)

const handleScroll = () => {
  scrollY.value = window.scrollY
  const heroHeight = window.innerHeight

  // 스크롤 진행도 (0~1)
  const progress = Math.min(scrollY.value / heroHeight, 1)

  // 배경 이미지: 느리게 이동 (parallax) + scale + 3D rotation
  const bgY = scrollY.value * 0.5 // 50% 속도로 이동
  const bgScale = 1.1 + progress * 0.1 // 1.1에서 1.2로 확대
  const bgRotateX = progress * -5 // 최대 -5도 회전

  bgTransform.value = `translateY(${bgY}px) scale(${bgScale}) rotateX(${bgRotateX}deg)`

  // 콘텐츠: 빠르게 이동 + fade out + 3D효과
  const contentY = scrollY.value * 0.3 // 30% 속도로 이동
  contentOpacity.value = Math.max(1 - progress * 1.5, 0)
  const contentScale = 1 - progress * 0.2 // 약간 축소
  const contentRotateX = progress * 10 // 최대 10도 회전

  contentTransform.value = `translateY(${contentY}px) scale(${contentScale}) rotateX(${contentRotateX}deg)`
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll() // 초기 상태 설정
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <section
    class="relative h-[100dvh] flex flex-col items-center justify-center overflow-hidden"
    style="perspective: 1000px"
  >
    <!-- Background Video with Overlay -->
    <div class="absolute inset-0 z-0">
      <!-- 로딩 스피너 -->
      <div
        v-if="videoLoading"
        class="absolute inset-0 bg-black z-20 flex items-center justify-center"
      >
        <LoadingSpinner message="동영상 로딩 중..." :size="60" />
      </div>

      <!-- Black Overlay -->
      <div class="absolute inset-0 bg-black opacity-20 z-10"></div>
      <!-- Gradient Overlay - 하단을 흰색으로 페이드 -->
      <div
        class="absolute inset-0 z-10"
        style="
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.2) 0%,
            transparent 80%,
            white 100%
          );
        "
      ></div>
      <video
        class="w-full h-full object-cover will-change-transform"
        :style="`transform: ${bgTransform}; transform-style: preserve-3d;`"
        autoplay
        loop
        muted
        playsinline
        @loadeddata="handleVideoLoaded"
      >
        <source src="/videos/HeroSection.mp4" type="video/mp4" />
      </video>
    </div>

    <!-- Content -->
    <div
      class="relative z-20 text-center px-6 max-w-3xl will-change-transform"
      :style="`transform: ${contentTransform}; transform-style: preserve-3d; opacity: ${contentOpacity};`"
    >
      <h1 class="text-white text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
        {{ title }}
      </h1>
      <p class="text-white text-lg md:text-xl font-medium leading-relaxed mb-10 max-w-md mx-auto">
        {{ subtitle }}
      </p>

      <!-- CTA Buttons -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          @click="emit('primaryClick')"
          class="bg-transparent border border-white text-white px-10 py-4 rounded-md font-bold text-md transition-all hover:bg-primary hover:border-primary hover:text-background-dark"
        >
          {{ primaryButtonText }}
        </button>
        <!-- <button
          @click="emit('secondaryClick')"
          class="bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-4 rounded-sm font-bold text-sm tracking-widest uppercase hover:bg-white/20 transition-all"
        >
          {{ secondaryButtonText }}
        </button> -->
      </div>
    </div>

    <!-- Scroll Down Arrow -->
    <div
      @click="scrollDown"
      class="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce opacity-50 cursor-pointer"
    >
      <span class="material-symbols-outlined text-gray-700 text-[60px]">expand_more</span>
    </div>
  </section>
</template>

<style scoped>
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0) translateX(-50%);
  }
  50% {
    transform: translateY(-10px) translateX(-50%);
  }
}

.animate-bounce {
  animation: bounce 2s infinite;
}
</style>
