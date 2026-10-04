<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import { normalizeCertificateCategory } from '@/utils/certificate-category'
import PublicPageHeader from '@/components/common/site/PublicPageHeader.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'

const certificates = ref<Certificate[]>([])
const loading = ref(true)
const error = ref(false)
const groupedCertificates = computed(() => {
  const groups: Record<string, Certificate[]> = {}
  certificates.value.forEach((certificate) => {
    const category = normalizeCertificateCategory(certificate.category)
    ;(groups[category] ||= []).push(certificate)
  })
  return groups
})
async function fetchCertificates() {
  loading.value = true
  error.value = false
  try {
    certificates.value = (await certificatesAPI.getAll()).data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(fetchCertificates)
</script>
<template>
  <div class="certificates-page">
    <PublicPageHeader
      eyebrow="CERTIFICATE ARCHIVE"
      :title="'빛을 만드는\n기준과 기록.'"
      index="03 / CERTIFICATES"
      :description="'디에프코리아의 등록 인증 자료를 살펴보세요.\n구분별로 문서를 선택해 원본 PDF를 확인할 수 있습니다.'"
    />
    <section class="public-container certificate-collection" aria-label="인증 구분별 자료">
      <div v-if="loading" class="public-status" role="status">
        <p>인증 자료를 불러오는 중입니다.</p>
      </div>
      <div v-else-if="error" class="public-status" role="alert">
        <p>인증 자료를 불러오지 못했습니다.<br />잠시 후 다시 확인해 주세요.</p>
        <PublicAction type="button" data-certificate-retry @click="fetchCertificates"
          >다시 불러오기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
      <div v-else-if="!certificates.length" class="public-status">
        <p>등록된 인증서가 없습니다.</p>
      </div>
      <div v-else>
        <div class="certificate-collection__rail">
          <p>{{ certificates.length }}개의 등록 문서</p>
          <span>DOCUMENTS / BY CATEGORY</span>
        </div>
        <div class="certificate-category-grid">
          <NuxtLink
            v-for="(certs, category, index) in groupedCertificates"
            :key="category"
            :to="`/certificates/${encodeURIComponent(category)}`"
            class="certificate-category"
            data-certificate-category
            ><div class="certificate-category__top">
              <span>0{{ index + 1 }}</span
              ><span aria-hidden="true">↗</span>
            </div>
            <svg class="certificate-category__document" viewBox="0 0 48 58" aria-hidden="true">
              <path
                d="M8 2h24l10 10v44H8zM32 2v12h10M16 25h18M16 33h18M16 41h12"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
              />
            </svg>
            <h2>{{ category }}</h2>
            <p>{{ certs.length }}개의 인증서 <span>자료 보기</span></p></NuxtLink
          >
        </div>
        <p class="certificate-collection__note">
          인증의 세부 내용과 적용 범위는 각 등록 문서에서 확인해 주세요.
        </p>
      </div>
    </section>
  </div>
</template>
<style scoped>
.certificates-page {
  background: var(--df-paper, #f0ece3);
  min-height: 70vh;
}
.certificate-collection {
  padding-bottom: 88px;
}
.certificate-collection__rail {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 23px 0;
  border-top: 1px solid var(--df-line);
}
.certificate-collection__rail > p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--df-muted);
}
.certificate-collection__rail > span {
  color: #929982;
  font-family: Arial, sans-serif;
  font-size: 7px;
  letter-spacing: 0.13em;
}
.certificate-category-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}
.certificate-category {
  display: block;
  min-width: 0;
  min-height: 281px;
  padding: 24px 28px;
  color: #34452a;
  background: #e7e8dc;
  border: 1px solid #969f8033;
  text-decoration: none;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}
.certificate-category:hover {
  background: #e0e3d2;
  border-color: #929e7280;
  opacity: 1;
}
.certificate-category__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #909d7b;
  font-family: Arial, sans-serif;
  font-size: 8px;
  letter-spacing: 0.1em;
}
.certificate-category__top > span:last-child {
  font-size: 20px;
  line-height: 1;
}
.certificate-category__document {
  display: block;
  width: 41px;
  height: 50px;
  margin: 26px 0 31px;
  color: #87956f;
}
.certificate-category h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.045em;
}
.certificate-category > p {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin: 16px 0 0;
  color: #889477;
  font-size: 10px;
  line-height: 1.7;
}
.certificate-category > p > span {
  font-size: 9px;
}
.certificate-collection__note {
  margin: 24px 0 0;
  color: #979e88;
  font-size: 9px;
  line-height: 1.8;
}
@media (max-width: 1000px) {
  .certificate-category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .certificate-collection {
    padding-bottom: 55px;
  }
  .certificate-category-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .certificate-category {
    min-height: 225px;
    padding: 23px;
  }
  .certificate-category__document {
    width: 33px;
    height: 42px;
    margin: 18px 0 23px;
  }
  .certificate-category h2 {
    font-size: 20px;
  }
  .certificate-collection__rail > span {
    display: none;
  }
  .certificate-collection__note {
    font-size: 8px;
  }
}
</style>
