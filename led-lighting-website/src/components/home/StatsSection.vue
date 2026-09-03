<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Stat {
  value: string
  label: string
  icon: string
}

interface Props {
  stats?: Stat[]
}

const props = withDefaults(defineProps<Props>(), {
  stats: () => [
    { value: '10+', label: '회사 설립', icon: 'business' },
    { value: '30+', label: '다양한 제품군', icon: 'category' },
    { value: '50+', label: '인증', icon: 'verified' },
    { value: '300+', label: '설치 현장', icon: 'construction' },
  ],
})

// 섹션 element ref
const sectionRef = ref<HTMLElement | null>(null)
// 애니메이션된 값들을 저장할 ref
const animatedValues = ref<string[]>([])
// 애니메이션이 시작되었는지 확인
const hasAnimated = ref(false)

// easing 함수: 처음엔 빠르게, 끝에 가까워질수록 천천히
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// 숫자를 추출하고 애니메이션하는 함수
const animateValue = (index: number, endValue: string, duration: number = 2000) => {
  // 숫자 부분 추출 (예: "95+", "50k", "100" 등)
  const numMatch = endValue.match(/[\d.]+/)
  if (!numMatch) {
    // 숫자가 없으면 그냥 원래 값 사용
    animatedValues.value[index] = endValue
    return
  }

  const endNum = parseFloat(numMatch[0])
  const suffix = endValue.replace(numMatch[0], '') // "+", "k", "%" 등
  const startTime = Date.now()

  const animate = () => {
    const currentTime = Date.now()
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    // easing 적용
    const easedProgress = easeOutExpo(progress)
    const currentValue = easedProgress * endNum

    // 숫자 포맷팅 (소수점 처리)
    const formattedValue =
      endNum >= 10 ? Math.floor(currentValue).toString() : currentValue.toFixed(1)

    animatedValues.value[index] = formattedValue + suffix

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  animate()
}

// 애니메이션 시작 함수
const startAnimation = () => {
  if (hasAnimated.value) return

  hasAnimated.value = true
  props.stats.forEach((stat, index) => {
    animateValue(index, stat.value, 2000)
  })
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  // 초기값 설정 (모두 0 또는 빈 문자열)
  animatedValues.value = props.stats.map((stat) => {
    const numMatch = stat.value.match(/[\d.]+/)
    if (!numMatch) return stat.value
    const suffix = stat.value.replace(numMatch[0], '')
    return '0' + suffix
  })

  // Intersection Observer 설정
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 컴포넌트가 화면에 보이면 애니메이션 시작
          startAnimation()
        }
      })
    },
    {
      threshold: 0.3, // 30% 이상 보이면 트리거
    },
  )

  if (sectionRef.value) {
    observer.observe(sectionRef.value)
  }
})

onUnmounted(() => {
  if (observer && sectionRef.value) {
    observer.unobserve(sectionRef.value)
  }
})
</script>

<template>
  <section ref="sectionRef" class="py-20 px-6 border-b border-gray-100 bg-white">
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="(stat, index) in stats"
        :key="index"
        class="relative bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:bg-gray-100 hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
      >
        <!-- Icon (좌상단) -->
        <div class="flex justify-between items-start mb-8">
          <div
            class="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"
          >
            <span class="material-symbols-outlined text-primary text-2xl">{{ stat.icon }}</span>
          </div>

          <!-- Value (우상단) -->
          <span
            class="text-gray-900 text-3xl md:text-4xl font-bold group-hover:scale-110 transition-transform"
          >
            {{ animatedValues[index] || stat.value }}
          </span>
        </div>

        <!-- Label (하단) -->
        <div class="mt-auto">
          <p class="text-gray-600 text-sm font-medium tracking-wide">
            {{ stat.label }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
