<template>
  <div class="w-full bg-background font-inter min-h-screen">
    <!-- Hero Section -->
    <section class="relative py-32 px-8 bg-gradient-to-b from-primary/5 to-transparent">
      <div class="max-w-md mx-auto md:max-w-5xl">
        <h1 class="text-text-main text-4xl md:text-5xl font-bold mb-6">인증 현황</h1>
        <p class="text-secondary text-lg md:text-xl max-w-2xl">
          총 {{ certificates.length }}개의 인증서
        </p>
      </div>
    </section>

    <!-- Certificates Section -->
    <section class="py-24 px-8">
      <div class="max-w-md mx-auto md:max-w-5xl">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div
            class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
          ></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="certificates.length === 0" class="text-center py-12 text-gray-500">
          등록된 인증서가 없습니다.
        </div>

        <!-- Certificates by Category -->
        <div v-else class="space-y-12">
          <!-- Category Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              v-for="(certs, category) in groupedCertificates"
              :key="category"
              class="p-8 bg-surface rounded-2xl transition-all duration-300 flex flex-col items-center cursor-pointer hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-primary"
              @click="goToCategoryDetail(category)"
            >
              <!-- Category Icon -->
              <div
                class="w-24 h-24 mb-4 flex items-center justify-center bg-primary/10 rounded-full"
              >
                <span class="material-symbols-outlined text-primary" style="font-size: 48px">
                  verified
                </span>
              </div>

              <!-- Category Name -->
              <h3 class="text-text-main font-bold text-xl mb-2 text-center">
                {{ category }}
              </h3>

              <!-- Certificate Count -->
              <p class="text-secondary text-sm text-center">{{ certs.length }}개의 인증서</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import { useSEO } from '@/composables/useSEO'

// SEO 설정
useSEO({
  title: '인증 현황 | (주)디에프코리아 - LED 조명 전문 기업',
  description:
    '(주)디에프코리아가 보유한 다양한 인증서와 품질 기준을 확인하세요. 국제 표준을 준수하는 LED 조명 전문 기업입니다.',
  keywords: '(주)디에프코리아, 인증 현황, 품질 인증, LED 조명 인증, 국제 표준, 품질 관리',
  ogType: 'website',
})

const router = useRouter()
const certificates = ref<Certificate[]>([])
const loading = ref(true)

// 구분별로 인증서 그룹화
const groupedCertificates = computed(() => {
  const groups: Record<string, Certificate[]> = {}

  certificates.value.forEach((cert) => {
    const category = cert.category || '기타'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(cert)
  })

  return groups
})

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

const goToCategoryDetail = (category: string) => {
  // URL에서 사용할 수 있도록 인코딩
  const encodedCategory = encodeURIComponent(category)
  router.push(`/certificates/${encodedCategory}`)
}

onMounted(() => {
  fetchCertificates()
})
</script>

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
</style>
