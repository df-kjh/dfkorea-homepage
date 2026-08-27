<template>
  <div class="w-full bg-background font-inter min-h-screen">
    <!-- Hero Section -->
    <AboutHero />

    <!-- Timeline Section -->
    <CompanyTimeline />
  </div>
</template>

<script setup lang="ts">
import { useSEO } from '@/composables/useSEO'
import AboutHero from '@/components/about/AboutHero.vue'
import CompanyTimeline from '@/components/about/CompanyTimeline.vue'

// SEO 설정
useSEO({
  title: '회사 소개 | (주)디에프코리아 - LED 조명 전문 기업',
  description:
    '(주)디에프코리아는 혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 전문 기업입니다. 우리의 비전과 가치, 그리고 LED 조명 산업을 선도하는 기술력을 확인하세요.',
  keywords: '(주)디에프코리아, 회사 소개, LED 조명 기업, 조명 전문, 기업 비전, LED 기술',
  ogType: 'website',
})
</script>
