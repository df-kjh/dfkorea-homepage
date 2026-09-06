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
  title: '현장에 맞는 빛을,<br/>믿을 수 있는 기준으로.',
  subtitle: '',
  heroImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600',
  description: `디에프코리아는 2013년부터 다양한 현장에 필요한 LED 조명을 만들어왔습니다.
      교육시설과 주차장, 상업·산업 공간까지 사용 환경을 세심하게 살피고, 제품 개발부터 생산과 품질관리까지 책임 있게 이어갑니다.
      공간에 맞는 제품과 기능을 제안하며 오래 신뢰할 수 있는 조명 제조사가 되겠습니다.`,
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
