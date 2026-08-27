<template>
  <div class="certificate-management bg-white rounded-lg shadow-sm">
    <div class="toolbar p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
      <h3 class="text-lg sm:text-xl font-bold text-gray-900">인증서 관리</h3>
      <button
        @click="handleCreate"
        class="bg-primary text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-semibold hover:bg-primary/90 transition-colors"
      >
        <span class="hidden sm:inline">인증서 추가</span>
        <span class="sm:hidden">추가</span>
      </button>
    </div>

    <!-- Category Filter -->
    <div v-if="!loading && certificates.length > 0" class="px-4 sm:px-6 pt-4">
      <CategoryFilter
        :categories="allCategories"
        :selected-category="selectedCategory"
        @category-change="handleCategoryChange"
      />
    </div>

    <div class="p-4 sm:p-6">
      <div v-if="loading" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
        ></div>
      </div>

      <div v-else-if="filteredCertificates.length === 0" class="text-center py-12 text-gray-500">
        <span v-if="selectedCategory === '전체'">등록된 인증서가 없습니다.</span>
        <span v-else>"{{ selectedCategory }}" 구분에 등록된 인증서가 없습니다.</span>
      </div>

      <!-- Desktop Table View -->
      <div v-else class="hidden lg:block overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4 font-semibold text-gray-700">구분</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">인증서 이름</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">인증 업체</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">인증 마크</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">인증서 PDF</th>
              <th class="text-left py-3 px-4 font-semibold text-gray-700">등록일</th>
              <th class="text-center py-3 px-4 font-semibold text-gray-700">작업</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="certificate in filteredCertificates"
              :key="certificate.id"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td class="py-3 px-4">
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                  {{ certificate.category || '기타' }}
                </span>
              </td>
              <td class="py-3 px-4">{{ certificate.name }}</td>
              <td class="py-3 px-4">{{ certificate.issuingOrganization }}</td>
              <td class="py-3 px-4">
                <img
                  v-if="certificate.markImage"
                  :src="certificate.markImage"
                  class="w-12 h-12 object-contain"
                  :alt="certificate.name"
                />
                <span v-else class="material-symbols-outlined text-gray-400 text-3xl">verified</span>
              </td>
              <td class="py-3 px-4">
                <span v-if="certificate.certificatePdf" class="text-green-600 text-sm">✓ 등록됨</span>
                <span v-else class="text-gray-400 text-sm">미등록</span>
              </td>
              <td class="py-3 px-4">{{ formatDate(certificate.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button
                    @click="handleEdit(certificate)"
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    @click="handleDelete(certificate)"
                    class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div v-if="!loading && filteredCertificates.length > 0" class="lg:hidden space-y-4">
        <div
          v-for="certificate in filteredCertificates"
          :key="certificate.id"
          class="border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <!-- Header -->
          <div class="flex items-start gap-3">
            <div v-if="certificate.markImage" class="flex-shrink-0">
              <img
                :src="certificate.markImage"
                class="w-16 h-16 object-contain"
                :alt="certificate.name"
              />
            </div>
            <div v-else class="flex-shrink-0">
              <span class="material-symbols-outlined text-gray-400 text-5xl">verified</span>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-gray-900 mb-1">{{ certificate.name }}</h4>
              <p class="text-sm text-gray-600">{{ certificate.issuingOrganization }}</p>
            </div>
          </div>

          <!-- Details -->
          <div class="text-sm space-y-1">
            <div>
              <span class="text-gray-600">구분:</span>
              <span class="ml-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                {{ certificate.category || '기타' }}
              </span>
            </div>
            <div>
              <span class="text-gray-600">인증서 PDF:</span>
              <span v-if="certificate.certificatePdf" class="ml-1 text-green-600">✓ 등록됨</span>
              <span v-else class="ml-1 text-gray-400">미등록</span>
            </div>
            <div>
              <span class="text-gray-600">등록일:</span>
              <span class="ml-1 font-medium">{{ formatDate(certificate.createdAt) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              @click="handleEdit(certificate)"
              class="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
            >
              수정
            </button>
            <button
              @click="handleDelete(certificate)"
              class="flex-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-medium"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { certificatesAPI } from '@/api'
import type { Certificate } from '@/types'
import CategoryFilter from '@/components/blog/CategoryFilter.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const certificates = ref<Certificate[]>([])
const loading = ref(false)
const selectedCategory = ref('전체')

// 모든 구분 목록 (전체 포함)
const allCategories = computed(() => {
  const categories = certificates.value
    .map((cert) => cert.category || '기타')
    .filter((cat, index, self) => self.indexOf(cat) === index) // 중복 제거
    .sort()
  return ['전체', ...categories]
})

// 필터링된 인증서 목록
const filteredCertificates = computed(() => {
  if (selectedCategory.value === '전체') {
    return certificates.value
  }
  return certificates.value.filter((cert) => {
    const category = cert.category || '기타'
    return category === selectedCategory.value
  })
})

const fetchCertificates = async (): Promise<void> => {
  loading.value = true
  try {
    const { data } = await certificatesAPI.getAll()
    certificates.value = data
  } catch {
    toast.error('인증서 목록을 불러오는데 실패했습니다')
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const handleCategoryChange = (category: string): void => {
  selectedCategory.value = category
}

const handleCreate = (): void => {
  const currentTab = route.query.tab || 'certificates'
  router.push({ path: '/admin/certificates/new', query: { from: currentTab } })
}

const handleEdit = (certificate: Certificate): void => {
  const currentTab = route.query.tab || 'certificates'
  router.push({ path: `/admin/certificates/${certificate.id}`, query: { from: currentTab } })
}

const handleDelete = async (certificate: Certificate): Promise<void> => {
  if (!confirm(`"${certificate.name}" 인증서를 삭제하시겠습니까?`)) {
    return
  }

  try {
    await certificatesAPI.delete(certificate.id)
    toast.success('인증서가 삭제되었습니다')
    fetchCertificates()
  } catch {
    toast.error('삭제에 실패했습니다')
  }
}

onMounted(() => {
  fetchCertificates()
})
</script>

<style scoped>
.bg-primary {
  background-color: #22a8c3;
}

.hover\:bg-primary\/90:hover {
  background-color: rgba(34, 168, 195, 0.9);
}
</style>
