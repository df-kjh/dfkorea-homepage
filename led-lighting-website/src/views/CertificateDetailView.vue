<template>
  <div class="w-full bg-background font-inter min-h-screen">
    <!-- Navigation Header -->
    <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="flex items-center justify-center size-10 text-black rounded-lg"
          >
            <span class="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div class="flex-1">
            <h1 class="text-xl font-bold text-primary">{{ categoryName }}</h1>
            <p class="text-sm text-secondary">{{ certificates.length }}개의 인증서</p>
          </div>
        </div>
      </div>
    </nav>

    <!-- Loading State -->
    <LoadingSpinner v-if="loading" message="인증서 정보를 불러오는 중..." :size="48" />

    <!-- Error State -->
    <div v-else-if="error" class="max-w-4xl mx-auto px-4 py-20 text-center">
      <p class="text-red-500 text-lg mb-4">{{ error }}</p>
      <button
        @click="goBack"
        class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        목록으로 돌아가기
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="certificates.length === 0" class="max-w-4xl mx-auto px-4 py-20 text-center">
      <p class="text-gray-500 text-lg mb-4">해당 구분에 등록된 인증서가 없습니다.</p>
      <button
        @click="goBack"
        class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        목록으로 돌아가기
      </button>
    </div>

    <!-- Certificates Content -->
    <div v-else-if="selectedCertificate" class="max-w-7xl mx-auto px-4 py-8">
      <!-- Selected Certificate -->
      <!-- PDF Viewer -->
      <!-- Download Button -->
      <div class="pdf-controls flex justify-end gap-4">
        <BaseSelectBox v-model="selectedCertificateId" :options="certificateOptions" />
        <BaseButton
          :disabled="!selectedCertificate.certificatePdf"
          variant="primary"
          icon-left="download"
          @click="downloadPdf(selectedCertificate?.certificatePdf ?? '', selectedCertificate.name)"
        >
          <span v-if="!isMobile">다운로드</span>
        </BaseButton>
      </div>

      <!-- PDF Content -->
      <div v-if="selectedCertificate.certificatePdf" class="pdf-viewer-container">
        <VuePdfEmbed :source="selectedCertificate.certificatePdf" class="pdf-embed" />
      </div>

      <!-- No PDF Message -->
      <div v-else class="p-12 text-center bg-gray-50">
        <span class="material-symbols-outlined text-gray-300 text-6xl mb-4">description</span>
        <p class="text-gray-500">등록된 인증서 PDF가 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import { useSEO } from '@/composables/useSEO'
import { useResponsive } from '@/composables/useResponsive'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BaseSelectBox from '@/components/common/BaseSelectBox.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import VuePdfEmbed from 'vue-pdf-embed'

const router = useRouter()
const route = useRoute()
const { isMobile } = useResponsive()
const certificates = ref<Certificate[]>([])
const selectedCertificateId = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// URL에서 category 파라미터 가져오기 (디코딩)
const categoryParam = route.params.id as string
const categoryName = decodeURIComponent(categoryParam)

// 선택된 인증서 computed
const selectedCertificate = computed(() => {
  if (selectedCertificateId.value === null || certificates.value.length === 0) {
    return null
  }
  return certificates.value.find((cert) => cert.id === selectedCertificateId.value) || null
})

// 인증서 옵션 computed
const certificateOptions = computed(() => {
  return certificates.value.map((cert) => ({
    label: cert.name,
    value: cert.id,
  }))
})

// SEO 초기 설정
const { setMeta } = useSEO({
  title: `${categoryName} | 인증 현황 | (주)디에프코리아`,
  description: `(주)디에프코리아 ${categoryName} 인증서 목록을 확인하세요.`,
  keywords: `(주)디에프코리아, ${categoryName}, 인증서, 인증 현황`,
  ogType: 'article',
})

// 선택된 인증서가 변경되면 SEO 업데이트
watch(selectedCertificate, (newCertificate) => {
  if (newCertificate) {
    setMeta({
      title: `${newCertificate.name} | ${categoryName} | (주)디에프코리아`,
      description: `(주)디에프코리아 ${categoryName} - ${newCertificate.name} 인증서`,
      keywords: `(주)디에프코리아, ${categoryName}, ${newCertificate.name}, 인증서`,
      ogType: 'article',
    })
  }
})

const fetchCertificates = async () => {
  try {
    loading.value = true
    error.value = null
    // 모든 인증서를 가져온 후 해당 category로 필터링
    const { data } = await certificatesAPI.getAll()
    certificates.value = data.filter((cert: Certificate) => {
      const certCategory = cert.category || '기타'
      return certCategory === categoryName
    })

    // 첫 번째 인증서를 기본으로 선택
    if (certificates.value.length > 0 && certificates.value[0]) {
      selectedCertificateId.value = certificates.value[0].id
    }
  } catch (err) {
    console.error('Failed to fetch certificates:', err)
    error.value = '인증서 정보를 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/certificates')
}

const downloadPdf = (pdfUrl: string, certificateName: string) => {
  const link = document.createElement('a')
  link.href = pdfUrl
  link.download = `${certificateName}.pdf`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  fetchCertificates()
})
</script>

<style scoped>
.pdf-controls {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.pdf-viewer-container {
  width: 100%;
  min-height: 600px;
  background: #525252;
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.pdf-embed {
  width: 100%;
  max-width: 900px;
}
</style>
