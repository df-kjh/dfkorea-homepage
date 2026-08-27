<template>
  <ProductsView />
</template>

<script setup lang="ts">
import ProductsView from "@/views/ProductsView.vue";

useSeoMeta({
  title: "제품 목록 | (주)디에프코리아 - 다양한 LED 조명 제품",
  description:
    "(주)디에프코리아의 다양한 LED 조명 제품을 만나보세요. 산업용, 상업용, 가정용 LED 조명 솔루션을 제공합니다.",
  keywords:
    "LED 제품, LED 조명 제품, 산업용 LED, 상업용 LED, 가정용 조명, LED 솔루션, 에너지 절약 조명",
  ogType: "website",
});

useHead({
  link: [{ rel: "canonical", href: "https://www.dfkorealed.com/products" }],
});
</script>
