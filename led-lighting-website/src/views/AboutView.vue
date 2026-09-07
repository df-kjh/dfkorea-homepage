<template>
  <div class="w-full bg-background font-inter min-h-screen">
    <!-- Hero Section -->
    <AboutHero />

    <!-- Timeline Section -->
    <CompanyTimeline />
  </div>
</template>

<script setup lang="ts">
import AboutHero from '@/components/about/AboutHero.vue'
import CompanyTimeline from '@/components/about/CompanyTimeline.vue'

const seoTitle = '회사 소개 | (주)디에프코리아 - LED 조명 전문 기업'
const seoDescription =
  '(주)디에프코리아는 2013년부터 교육시설, 주차장, 상업·산업 현장에 맞는 LED 조명을 개발·생산해 온 조명 제조사입니다.'

useHead({ meta: [{ name: "keywords", content: '(주)디에프코리아, 회사 소개, LED 조명 기업, 조명 전문, 기업 비전, LED 기술' }] });

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'website',
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
})
</script>
