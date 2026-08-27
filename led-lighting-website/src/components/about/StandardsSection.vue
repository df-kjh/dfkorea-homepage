<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import BaseModal from '@/components/common/BaseModal.vue'
import VuePdfEmbed from 'vue-pdf-embed'

const certificates = ref<Certificate[]>([])
const loading = ref(true)
const selectedCertificate = ref<Certificate | null>(null)
const showModal = ref(false)
const pdfLoading = ref(false)
const containerWidth = ref(800) // PDF 컨테이너 너비

const fetchCertificates = async () => {
  try {
    const { data } = await certificatesAPI.getAll()
    certificates.value = data
  } catch (error) {
    console.error('Failed to fetch certificates:', error)
  } finally {
    loading.value = false
  }
}

const openModal = (certificate: Certificate) => {
  if (certificate.certificatePdf) {
    selectedCertificate.value = certificate
    showModal.value = true
    pdfLoading.value = true
  }
}

const closeModal = () => {
  showModal.value = false
  selectedCertificate.value = null
}

const pdfContainer = ref<HTMLElement | null>(null)

const updateContainerWidth = () => {
  if (pdfContainer.value) {
    console.log('PDF Container Width:', pdfContainer.value.clientWidth) // 디버그용 로그
    // 패딩을 제외한 실제 사용 가능한 너비
    const width = pdfContainer.value.clientWidth - 32 // 패딩 2rem (16px * 2)
    containerWidth.value = Math.max(width, 300) // 최소 300px (모바일 대응)
  }
}

const handlePdfLoad = () => {
  pdfLoading.value = false
}

onMounted(() => {
  fetchCertificates()
  
  // 윈도우 리사이즈 시 PDF 크기 조정
  window.addEventListener('resize', updateContainerWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)
})
</script>

<template>
  <section class="py-24 px-8">
    <div class="max-w-md mx-auto md:max-w-5xl">
      <h2 class="text-text-main text-2xl md:text-3xl font-bold mb-12">인증 현황</h2>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="certificates.length === 0" class="text-center py-12 text-gray-500">
        등록된 인증서가 없습니다.
      </div>

      <!-- Certificates Grid -->
      <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div
          v-for="certificate in certificates"
          :key="certificate.id"
          class="p-6 bg-surface rounded-2xl transition-all duration-300 flex flex-col items-center cursor-pointer hover:shadow-lg hover:scale-[1.02]"
          :class="{ 'cursor-pointer': certificate.certificatePdf }"
          @click="openModal(certificate)"
        >
          <!-- Certificate Mark Image or Default Icon -->
          <div class="w-20 h-20 mb-4 flex items-center justify-center">
            <img
              v-if="certificate.markImage"
              :src="certificate.markImage"
              :alt="certificate.name"
              class="w-full h-full object-contain"
              loading="lazy"
            />
            <span v-else class="material-symbols-outlined text-primary" style="font-size: 64px;">
              verified
            </span>
          </div>
          
          <!-- Certificate Name -->
          <h3 class="text-text-main font-bold text-base mb-1 text-center">
            {{ certificate.name }}
          </h3>
          
          <!-- Issuing Organization -->
          <p class="text-text-secondary text-sm text-center">
            {{ certificate.issuingOrganization }}
          </p>
        </div>
      </div>
    </div>

    <!-- Modal for Certificate PDF -->
    <BaseModal
      v-model="showModal"
      :title="selectedCertificate?.name"
      :subtitle="selectedCertificate?.issuingOrganization"
      width="90vh"
      content-padding="p-0"
      @close="closeModal"
    >
      <!-- Certificate PDF Viewer -->
      <div v-if="selectedCertificate?.certificatePdf" class="pdf-viewer-container">
        <!-- Loading State -->
        <div v-if="pdfLoading" class="flex items-center justify-center py-20">
          <div class="flex flex-col items-center gap-3">
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
            <p class="text-sm text-gray-600">PDF 로딩중...</p>
          </div>
        </div>

        <!-- PDF Content -->
        <div class="pdf-content" ref="pdfContainer">
          <VuePdfEmbed
            v-if="selectedCertificate"
            :source="selectedCertificate.certificatePdf"
            class="pdf-page"
            @loaded="handlePdfLoad"
          />
        </div>
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
.bg-primary {
  background-color: #22a8c3;
}

.text-primary {
  color: #22a8c3;
}

.border-primary {
  border-color: #22a8c3;
}

/* PDF Viewer Styles */
.pdf-viewer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.pdf-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #525252;
  width: 100%;
  height: 100%;
}

.pdf-page {
  width: 100%;
  height: 100%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.pdf-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: #22a8c3;
  color: white;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}

.control-btn:hover:not(.disabled) {
  background: #1a8a9f;
  transform: scale(1.05);
}

.control-btn.disabled {
  background: #d1d5db;
  cursor: not-allowed;
  opacity: 0.5;
}

.page-info {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 4rem;
  text-align: center;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
