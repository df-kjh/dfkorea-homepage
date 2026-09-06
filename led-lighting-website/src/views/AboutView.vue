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
    '(주)디에프코리아는 2013년부터 교육시설, 주차장, 상업·산업 현장에 맞는 LED 조명을 개발·생산해 온 조명 제조사입니다.',
  keywords: '(주)디에프코리아, 회사 소개, LED 조명 기업, 조명 전문, 기업 비전, LED 기술',
  ogType: 'website',
})
</script>
