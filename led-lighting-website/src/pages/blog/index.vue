<template>
  <BlogView />
</template>

<script setup lang="ts">
import BlogView from "@/views/BlogView.vue";

useSeoMeta({
  title: "회사 소식 | (주)디에프코리아 - LED 조명 업계 뉴스 및 정보",
  description:
    "(주)디에프코리아의 최신 소식과 LED 조명 산업 동향을 확인하세요. 신제품 출시, 기술 혁신, 업계 트렌드 등 다양한 정보를 제공합니다.",
  keywords:
    "회사 소식, LED 뉴스, 조명 산업, 제품 출시, 기술 혁신, LED 트렌드, (주)디에프코리아 뉴스",
  ogType: "website",
});

useHead({
  link: [{ rel: "canonical", href: "https://www.dfkorealed.com/blog" }],
});
</script>
