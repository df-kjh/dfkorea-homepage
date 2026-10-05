<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import { normalizeCertificateCategory } from '@/utils/certificate-category'
import PublicPageHeader from '@/components/common/site/PublicPageHeader.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
import VuePdfEmbed from 'vue-pdf-embed'

const emit = defineEmits<{ select: [certificate: Certificate | null] }>()
const route = useRoute()
const certificates = ref<Certificate[]>([])
const selectedCertificateId = ref<string | null>(null)
const loading = ref(true)
const error = ref(false)
const pdfError = ref(false)
const pdfAttempt = ref(0)
// Router params are already decoded; a second decode breaks literal % names.
const categoryName = computed(() => normalizeCertificateCategory(String(route.params.id || '')))
const selectedCertificate = computed(
  () =>
    certificates.value.find((certificate) => certificate.id === selectedCertificateId.value) ||
    null,
)
watch(selectedCertificate, (certificate) => {
  pdfError.value = false
  pdfAttempt.value = 0
  emit('select', certificate)
})
function retryPdf() {
  pdfError.value = false
  pdfAttempt.value++
}
async function fetchCertificates() {
  loading.value = true
  error.value = false
  try {
    const { data } = await certificatesAPI.getAll()
    certificates.value = data.filter(
      (certificate: Certificate) =>
        normalizeCertificateCategory(certificate.category) === categoryName.value,
    )
    selectedCertificateId.value = certificates.value[0]?.id || null
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(fetchCertificates)
</script>
<template>
  <div class="certificate-detail-page">
    <PublicPageHeader
      :title="categoryName"
      back-to="/certificates"
      back-label="인증 목록으로"
      description="등록 문서를 선택해 원본 인증 자료를 확인하세요."
    />
    <section class="public-container certificate-documents" aria-label="인증 원본 문서">
      <div v-if="loading" class="public-status" role="status">
        <p>인증서 정보를 불러오는 중입니다.</p>
      </div>
      <div v-else-if="error" class="public-status" role="alert">
        <p>인증서 정보를 불러오지 못했습니다.</p>
        <PublicAction data-certificate-retry @click="fetchCertificates"
          >다시 불러오기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
      <div v-else-if="!certificates.length" class="public-status">
        <p>해당 구분에 등록된 인증서가 없습니다.</p>
        <PublicAction to="/certificates" variant="text"
          >인증 목록으로 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
      <template v-else-if="selectedCertificate">
        <div class="certificate-document-controls">
          <div>
            <label for="certificate-document"
              >인증 문서 선택 <span>{{ certificates.length }} DOCUMENTS</span></label
            ><select id="certificate-document" v-model="selectedCertificateId">
              <option
                v-for="certificate in certificates"
                :key="certificate.id"
                :value="certificate.id"
              >
                {{ certificate.name }}
              </option>
            </select>
          </div>
          <PublicAction
            v-if="selectedCertificate.certificatePdf"
            :href="selectedCertificate.certificatePdf"
            :download="`${selectedCertificate.name}.pdf`"
            target="_blank"
            rel="noopener noreferrer"
            >PDF 다운로드 <span aria-hidden="true">↓</span></PublicAction
          >
        </div>
        <div v-if="selectedCertificate.certificatePdf" class="certificate-pdf">
          <div v-if="pdfError" class="certificate-pdf__fallback">
            <div class="certificate-pdf__error" role="status">
              <p>원본 PDF로 확인하세요.</p>
              <PublicAction variant="light" data-pdf-retry @click="retryPdf"
                >미리보기 다시 표시 <span aria-hidden="true">↗</span></PublicAction
              >
            </div>
            <!-- Public object storage may allow navigation but omit fetch CORS.
              A native document frame keeps the original accessible in that case. -->
            <iframe
              :src="selectedCertificate.certificatePdf"
              :title="`${selectedCertificate.name} 원본 PDF`"
              class="certificate-pdf__original"
            />
          </div>
          <VuePdfEmbed
            v-else
            :key="`${selectedCertificate.id}-${pdfAttempt}`"
            :source="selectedCertificate.certificatePdf"
            class="certificate-pdf__pages"
            @loading-failed="pdfError = true"
            @rendering-failed="pdfError = true"
          />
        </div>
        <div v-else class="public-status"><p>이 문서에 등록된 PDF가 없습니다.</p></div>
        <p class="certificate-document-note">
          원본 문서의 인증 범위와 내용을 확인해 주세요. PDF 다운로드는 원본 자료 링크로 연결됩니다.
        </p>
      </template>
    </section>
  </div>
</template>
<style scoped>
.certificate-detail-page {
  min-height: 75vh;
  background: var(--df-paper, #f0ece3);
}
.certificate-documents {
  padding-bottom: 76px;
}
.certificate-document-controls {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 30px;
  padding: 24px 0;
  border-top: 1px solid var(--df-line);
  flex-wrap: wrap;
}
.certificate-document-controls > div {
  flex: 1;
  max-width: 620px;
  min-width: 0;
}
.certificate-document-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 11px;
  line-height: 1.5;
  font-size: var(--df-font-label, 14px);
  color: var(--df-muted, #625f50);
  flex-wrap: wrap;
}
.certificate-document-controls label > span {
  font-family: inherit;
  letter-spacing: 0.1em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.certificate-document-controls select {
  display: block;
  width: 100%;
  min-height: 49px;
  padding: 12px 35px 12px 16px;
  border: 1px solid #8c9d6f52;
  border-radius: 2px;
  color: #3c4e2e;
  background: #e7e8dd;
  line-height: 1.5;
  text-overflow: ellipsis;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
}
.certificate-document-controls .public-action {
  flex-shrink: 0;
  max-width: 100%;
}
.certificate-pdf {
  display: flex;
  justify-content: center;
  min-height: 600px;
  padding: 34px;
  background: #5c6650;
  border: 1px solid #72826355;
}
.certificate-pdf__pages {
  width: 100%;
  max-width: 850px;
}
.certificate-pdf__fallback {
  width: 100%;
}
.certificate-pdf__original {
  display: block;
  width: 100%;
  height: min(80vh, 1000px);
  min-height: 540px;
  border: 0;
  background: #f0ece3;
}
.certificate-pdf__error {
  padding: 0 0 24px;
  color: #e5e9d8;
  text-align: center;
  line-height: 1.8;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
}
.certificate-pdf__error .public-action {
  margin-top: 20px;
}
.certificate-pdf :deep(canvas) {
  max-width: 100%;
  height: auto !important;
}
.certificate-document-note {
  margin: 20px 0 0;
  line-height: 1.8;
  letter-spacing: -0.025em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
@media (max-width: 700px) {
  .certificate-documents {
    padding-bottom: 49px;
  }
  .certificate-document-controls {
    align-items: start;
    flex-direction: column;
    gap: 17px;
    padding: 22px 0;
  }
  .certificate-document-controls > div {
    width: 100%;
    max-width: none;
  }
  /* Keep native select text at 16px so iOS focus does not zoom this document control. */
  .certificate-document-controls select {
    font-size: max(16px, var(--df-font-control, 16px));
  }
  .certificate-document-controls .public-action {
    align-self: end;
  }
  .certificate-pdf {
    padding: 14px 10px;
    min-height: 380px;
  }
  .certificate-pdf__original {
    min-height: 430px;
  }
}
</style>
