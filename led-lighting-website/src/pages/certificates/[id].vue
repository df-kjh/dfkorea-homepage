<template>
  <ClientOnly>
    <CertificateDetailView />
  </ClientOnly>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";

// vue-pdf-embed touches browser globals during module evaluation, so loading the
// certificate view on the server would prevent its route metadata from rendering.
const CertificateDetailView = defineAsyncComponent(
  () => import("@/views/CertificateDetailView.vue"),
);

const route = useRoute();
const siteUrl = useRuntimeConfig().public.siteUrl;
const category = computed(() => String(route.params.id || "기타"));
const canonicalUrl = computed(
  () => `${siteUrl}/certificates/${encodeURIComponent(category.value)}`,
);
const title = computed(() => `${category.value} | 인증 현황 | (주)디에프코리아`);
const description = computed(
  () =>
    `(주)디에프코리아의 ${category.value} 인증서와 품질 기준을 확인하세요. 국제 표준을 준수하는 LED 조명 전문 기업입니다.`,
);

useSeoMeta({
  title: () => title.value,
  description: () => description.value,
  robots: "index, follow",
  ogTitle: () => title.value,
  ogDescription: () => description.value,
  ogType: "website",
  ogUrl: () => canonicalUrl.value,
  twitterTitle: () => title.value,
  twitterDescription: () => description.value,
});

useHead({
  meta: [{ name: "twitter:url", content: canonicalUrl }],
  link: [{ rel: "canonical", href: canonicalUrl }],
});
</script>
