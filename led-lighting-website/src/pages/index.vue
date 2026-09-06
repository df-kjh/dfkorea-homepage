<template>
  <HomeView />
</template>

<script setup lang="ts">
import HomeView from "@/views/HomeView.vue";

const siteUrl = useRuntimeConfig().public.siteUrl;
const title = "(주)디에프코리아 - LED 조명 전문 기업 | 혁신적인 조명 솔루션";
const description =
  "혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아. 고품질 LED 제품과 솔루션을 경험해보세요. 에너지 효율적이고 친환경적인 LED 조명 제품을 만나보세요.";

useSeoMeta({
  title,
  description,
  keywords:
    "LED 조명, LED lighting, 조명, 산업용 조명, 상업용 조명, 에너지 절약, LED 제품, (주)디에프코리아, 친환경 조명, 디에프코리아",
  robots: "index, follow",
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
  ogUrl: siteUrl,
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  meta: [{ name: "twitter:url", content: siteUrl }],
  link: [{ rel: "canonical", href: siteUrl }],
});
</script>
