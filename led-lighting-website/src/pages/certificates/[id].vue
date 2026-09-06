<template>
  <ClientOnly>
    <CertificateDetailView :key="category" @select="selectedCertificate = $event" />
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import type { Certificate } from "@/types";
import { normalizeCertificateCategory } from "@/utils/certificate-category";

// vue-pdf-embed touches browser globals during module evaluation, so loading the
// certificate view on the server would prevent its route metadata from rendering.
const CertificateDetailView = defineAsyncComponent(
  () => import("@/views/CertificateDetailView.vue"),
);

const route = useRoute();
const siteUrl = useRuntimeConfig().public.siteUrl;
const category = computed(() => normalizeCertificateCategory(String(route.params.id || "")));
const selectedCertificate = ref<Certificate | null>(null);
watch(category, () => { selectedCertificate.value = null; });
const canonicalUrl = computed(
  () => `${siteUrl}/certificates/${encodeURIComponent(category.value)}`,
);
const title = computed(() => selectedCertificate.value
  ? `${selectedCertificate.value.name} | ${category.value} | (주)디에프코리아`
  : `${category.value} | 인증 현황 | (주)디에프코리아`);
const description = computed(
  () => selectedCertificate.value
    ? `(주)디에프코리아 ${category.value} - ${selectedCertificate.value.name} 인증서`
    : `(주)디에프코리아의 ${category.value} 인증서와 품질 기준을 확인하세요. 국제 표준을 준수하는 LED 조명 전문 기업입니다.`,
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
