<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface FeatureSection {
  title: string
  description: string
  images: [string, string]
  align: 'left' | 'right'
}

// 3개 섹션 데이터
const features: FeatureSection[] = [
  {
    title: '믿을 수 있는<br/><span class="text-primary">검증된</span> 조명',
    description:
      '10년간의 노하우로 검증된 완벽한 LED를 경험해보세요. 최소 40,000 시간 이상 지속되는 놀라운 수명으로 장기간 안정적인 조명 환경을 제공합니다.',
    images: ['/images/home/home-feature-1.webp', '/images/home/home-feature-2.webp'],
    align: 'left',
  },
  {
    title: '다양한 <span class="text-primary">색 온도</span><br/>완벽한 재현',
    description:
      '공간의 용도와 분위기에 맞춘 최적의 색 온도를 제공합니다. 따뜻한 백색부터 차가운 백색까지 다양한 옵션으로 원하는 분위기를 연출하세요.',
    images: ['/images/home/home-feature-3.jpg', '/images/home/home-feature-4.jpg'],
    align: 'right',
  },
  {
    title: '확실한<br/><span class="text-primary">사후 지원</span> 서비스',
    description:
      '제품 설치부터 유지보수까지 전문가의 체계적인 지원을 받으실 수 있습니다. (주)디에프코리아는 고객만족을 최우선으로 생각합니다.',
    images: ['/images/home/home-feature-5.webp', '/images/home/home-feature-6.webp'],
    align: 'left',
  },
]

// refs - 3개 섹션을 각각 추적
const sectionRefs = ref<HTMLElement[]>([])
const isVisible = ref<boolean[]>([false, false, false])

// ref 배열에 요소 할당하는 함수
const setRef = (el: any, index: number) => {
  if (el) {
    sectionRefs.value[index] = el as HTMLElement
  }
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = sectionRefs.value.findIndex((ref) => ref === entry.target)
          if (index !== -1) {
            isVisible.value[index] = true
          }
        }
      })
    },
    {
      threshold: 0.2, // 20% 이상 보이면 트리거
    },
  )

  // 각 섹션 observe
  sectionRefs.value.forEach((ref) => {
    if (ref && observer) {
      observer.observe(ref)
    }
  })
})

onUnmounted(() => {
  if (observer) {
    sectionRefs.value.forEach((ref) => {
      if (ref) {
        observer!.unobserve(ref)
      }
    })
  }
})
</script>

<template>
  <div class="bg-white">
    <!-- 3개 섹션 순회 -->
    <section
      v-for="(feature, index) in features"
      :key="index"
      :ref="(el) => setRef(el, index)"
      class="py-16 md:py-24 px-6 overflow-hidden"
    >
      <div class="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <!-- 텍스트 영역 -->
        <div
          :class="[
            'will-change-[opacity,transform]',
            feature.align === 'right' ? 'order-2 lg:order-1' : 'order-2',
          ]"
          :style="{
            opacity: isVisible[index] ? 1 : 0,
            transform: isVisible[index] ? 'translateY(0)' : 'translateY(80px)',
            transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
          }"
        >
          <h2
            class="text-gray-900 text-3xl md:text-4xl lg:text-6xl lg:leading-[1.2] font-bold mb-6"
            v-html="feature.title"
          ></h2>
          <p class="text-gray-600 text-base md:text-lg leading-relaxed">
            {{ feature.description }}
          </p>
        </div>

        <!-- 이미지 영역 -->
        <div :class="['relative', feature.align === 'right' ? 'order-1 lg:order-2' : 'order-1']">
          <div class="relative z-10 grid grid-cols-2 gap-4">
            <!-- 첫 번째 이미지 -->
            <div
              class="aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden shadow-xl border border-gray-200 will-change-[opacity,transform]"
              :style="{
                backgroundImage: `url('${feature.images[0]}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: isVisible[index] ? 1 : 0,
                transform: isVisible[index] ? 'translateY(0)' : 'translateY(80px)',
                transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
              }"
            ></div>
            <!-- 두 번째 이미지 (스태거 효과) -->
            <div
              :class="[
                'aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden shadow-xl border border-gray-200 will-change-[opacity,transform]',
                index % 2 === 0 ? 'mt-12' : '-mt-12',
              ]"
              :style="{
                backgroundImage: `url('${feature.images[1]}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: isVisible[index] ? 1 : 0,
                transform: isVisible[index] ? 'translateY(0)' : 'translateY(80px)',
                transition: 'opacity 0.7s ease-out 0.2s, transform 0.7s ease-out 0.2s',
              }"
            ></div>
          </div>
          <!-- 장식 배경 blur -->
          <div
            :class="[
              'absolute size-80 bg-primary/20 blur-[100px] rounded-full',
              feature.align === 'left' ? '-top-20 -left-20' : '-top-20 -right-20',
            ]"
          ></div>
        </div>
      </div>
    </section>
  </div>
</template>
