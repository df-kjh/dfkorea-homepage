<template>
  <ProductsView />
</template>

<script setup lang="ts">
import ProductsView from "@/views/ProductsView.vue";

const siteUrl = useRuntimeConfig().public.siteUrl;
const title = "제품 목록 | (주)디에프코리아 - 다양한 LED 조명 제품";
const description =
  "(주)디에프코리아의 다양한 LED 조명 제품을 만나보세요. 산업용, 상업용, 가정용 LED 조명 솔루션을 제공합니다. 에너지 효율적이고 고품질의 LED 제품을 확인하세요.";

useSeoMeta({
  title,
  description,
  keywords:
    "LED 제품, LED 조명 제품, 산업용 LED, 상업용 LED, 가정용 조명, LED 솔루션, 에너지 절약 조명",
  robots: "index, follow",
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
  ogUrl: `${siteUrl}/products`,
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  meta: [{ name: "twitter:url", content: `${siteUrl}/products` }],
  link: [{ rel: "canonical", href: `${siteUrl}/products` }],
});
</script>
