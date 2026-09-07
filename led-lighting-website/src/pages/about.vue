<template>
  <AboutView />
</template>

<script setup lang="ts">
import AboutView from "@/views/AboutView.vue";

const siteUrl = useRuntimeConfig().public.siteUrl;
const title = "회사 소개 | (주)디에프코리아 - LED 조명 전문 기업";
const description =
  "(주)디에프코리아는 2013년부터 교육시설, 주차장, 상업·산업 현장에 맞는 LED 조명을 개발·생산해 온 조명 제조사입니다.";

useHead({ meta: [{ name: "keywords", content: "(주)디에프코리아, 회사 소개, LED 조명 기업, 조명 전문, 기업 비전, LED 기술" }] });

useSeoMeta({
  title,
  description,
  robots: "index, follow",
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
  ogUrl: `${siteUrl}/about`,
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  meta: [{ name: "twitter:url", content: `${siteUrl}/about` }],
  link: [{ rel: "canonical", href: `${siteUrl}/about` }],
});
</script>
