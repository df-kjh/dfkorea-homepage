<template>
  <CertificatesView />
</template>

<script setup lang="ts">
import CertificatesView from "@/views/CertificatesView.vue";

const siteUrl = useRuntimeConfig().public.siteUrl;
const title = "인증 현황 | (주)디에프코리아 - LED 조명 전문 기업";
const description =
  "(주)디에프코리아가 보유한 다양한 인증서와 품질 기준을 확인하세요. 국제 표준을 준수하는 LED 조명 전문 기업입니다.";

useSeoMeta({
  title,
  description,
  keywords: "(주)디에프코리아, 인증 현황, 품질 인증, LED 조명 인증, 국제 표준, 품질 관리",
  robots: "index, follow",
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
  ogUrl: `${siteUrl}/certificates`,
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  meta: [{ name: "twitter:url", content: `${siteUrl}/certificates` }],
  link: [{ rel: "canonical", href: `${siteUrl}/certificates` }],
});
</script>
