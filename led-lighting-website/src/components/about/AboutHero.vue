<script setup lang="ts">
interface Props {
  label?: string
  title?: string
  subtitle?: string
  heroImage?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  label: 'About DF KOREA',
  title: '우리의 목표:<br/>더 나은 빛.',
  subtitle: '',
  heroImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600',
  description: `우리 회사는 최고의 품질을 기준으로 모든 LED 조명 제품을 설계하고 생산합니다.
      고객의 환경과 요구에 맞춘 주문 제작 시스템을 통해 최적의 조명 솔루션을 제공합니다.
      주거·상업·산업 현장을 아우르는 다양한 제품군으로 폭넓은 선택지를 제시합니다.
      기술 개발과 품질 관리를 통해 신뢰받는 제품을 지속적으로 선보이고자 합니다.
      끊임없는 개선과 도전을 통해 업계 최고를 위한 노력을 멈추지 않겠습니다.`,
})
</script>

<template>
  <section class="pt-32 pb-16 px-6">
    <!-- Title Section -->
    <div class="max-w-md mx-auto md:max-w-2xl text-center md:text-left">
      <span class="text-primary font-bold text-sm tracking-wide uppercase mb-4 block" v-if="label">
        {{ label }}
      </span>
      <h1
        class="text-text-main text-4xl md:text-6xl font-bold leading-tight mb-12"
        v-html="title"
      ></h1>
    </div>

    <!-- Hero Image -->
    <div class="max-w-screen-xl mx-auto mb-16 px-0 md:px-12">
      <div
        class="aspect-[4/5] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-sm bg-cover bg-center"
        :style="`background-image: url('${heroImage}')`"
      ></div>
    </div>

    <!-- Description -->
    <div class="max-w-md mx-auto md:max-w-3xl">
      <p class="text-text-sub text-lg md:text-xl leading-relaxed font-medium whitespace-pre-line">
        {{ description }}
      </p>
    </div>
  </section>
</template>
