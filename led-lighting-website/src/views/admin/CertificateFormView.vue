<template>
  <div class="min-h-screen bg-background-light pb-24 font-display text-[#121617]">
    <!-- Top Navigation Bar -->
    <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="flex items-center justify-between p-4 h-16">
        <div class="flex items-center gap-3">
          <button
            @click="handleBack"
            class="flex items-center justify-center size-10 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span class="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 class="text-xl font-bold tracking-tight">
            {{ isEditMode ? '인증서 정보 수정' : '신규 인증서 등록' }}
          </h1>
        </div>
      </div>
    </nav>

    <main class="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <!-- General Information Card -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">기본 정보</h2>
        <div class="space-y-5">
          <!-- 1. 인증서 이름 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">인증서 이름 <span class="text-red-500">*</span></label>
            <input
              v-model="formData.name"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all placeholder:text-gray-400"
              placeholder="예: KS 인증"
              type="text"
              required
            />
          </div>

          <!-- 2. 인증 업체 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">인증 업체 <span class="text-red-500">*</span></label>
            <input
              v-model="formData.issuingOrganization"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all placeholder:text-gray-400"
              placeholder="예: 한국표준협회"
              type="text"
              required
            />
          </div>

          <!-- 3. 구분 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">구분 (선택)</label>
            <div class="flex gap-2">
              <BaseSelectBox
                v-model="selectedCategory"
                :options="categoryOptions"
                @update:modelValue="handleCategoryChange"
                custom-class="flex-1 h-12"
              />
              <input
                v-if="isCustomCategory"
                v-model="customCategory"
                class="flex-1 bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all placeholder:text-gray-400"
                placeholder="구분을 입력하세요"
                type="text"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Images Card -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">이미지</h2>
        <div class="space-y-5">
          <!-- 3. 인증 마크 이미지 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">인증 마크 이미지 (선택)</label>
            <p class="text-xs text-gray-500 mb-2">
              투명 배경의 PNG 이미지 업로드를 권장합니다. 업로드하지 않으면 기본 아이콘이 표시됩니다.
            </p>
            <ImageUploader v-model="formData.markImage" />
          </div>

          <!-- 4. 인증서 PDF -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">인증서 PDF (선택)</label>
            <p class="text-xs text-gray-500 mb-2">
              사용자가 인증 카드를 클릭하면 팝업으로 PDF 내용이 표시됩니다.
            </p>
            <PDFUploader v-model="formData.certificatePdf" />
          </div>
        </div>
      </section>

      <!-- Submit Button -->
      <div
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <div class="flex items-center justify-between">
          <button
            @click="handleBack"
            class="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            type="button"
          >
            취소
          </button>
          <button
            @click="handleSubmit"
            :disabled="submitting || !isFormValid"
            class="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {{ submitting ? '처리 중...' : isEditMode ? '수정 완료' : '등록하기' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useImageUpload } from '@/composables/useImageUpload'
import { certificatesAPI } from '@/api'
import type { Certificate, CreateCertificateDto } from '@/types'
import ImageUploader from '@/components/common/ImageUploader.vue'
import BaseSelectBox from '@/components/common/BaseSelectBox.vue'
import PDFUploader from '@/components/common/PDFUploader.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const imageUpload = useImageUpload('certificates')

// ImageUploader에서 사용할 수 있도록 provide
provide('imageUpload', imageUpload)

const certificateId = route.params.id as string
const isEditMode = computed(() => !!certificateId && certificateId !== 'new')

const formData = ref<CreateCertificateDto>({
  name: '',
  issuingOrganization: '',
  category: '',
  markImage: '',
  certificatePdf: '',
})

const submitting = ref(false)
const existingCategories = ref<string[]>([])
const selectedCategory = ref<string>('')
const customCategory = ref<string>('')
const isCustomCategory = computed(() => selectedCategory.value === '__custom__')

const isFormValid = computed(() => {
  return formData.value.name.trim() && formData.value.issuingOrganization.trim()
})

// 카테고리 옵션
const categoryOptions = computed(() => {
  const options: { label: string; value: string }[] = [
    { label: '선택 안 함', value: '' },
    ...existingCategories.value.map(cat => ({ label: cat, value: cat })),
    { label: '직접 입력', value: '__custom__' },
  ]
  return options
})

const handleCategoryChange = () => {
  if (selectedCategory.value === '__custom__') {
    formData.value.category = customCategory.value
  } else {
    formData.value.category = selectedCategory.value
    customCategory.value = ''
  }
}

// customCategory가 변경될 때마다 formData 업데이트
watch(customCategory, (newValue) => {
  if (isCustomCategory.value) {
    formData.value.category = newValue
  }
})

const handleBack = (): void => {
  const fromTab = route.query.from as string || 'certificates'
  router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
}

const loadExistingCategories = async (): Promise<void> => {
  try {
    const { data } = await certificatesAPI.getAll()
    const categories = data
      .map((cert: Certificate) => cert.category)
      .filter((cat): cat is string => !!cat) // null/undefined/빈 문자열 제거
    existingCategories.value = [...new Set(categories)] // 중복 제거
  } catch (error) {
    console.error('Failed to fetch existing categories:', error)
  }
}

const loadCertificate = async (): Promise<void> => {
  if (!isEditMode.value) return

  try {
    const { data } = await certificatesAPI.getOne(certificateId)
    formData.value = {
      name: data.name,
      issuingOrganization: data.issuingOrganization,
      category: data.category || '',
      markImage: data.markImage || '',
      certificatePdf: data.certificatePdf || '',
    }
    // 기존 카테고리가 있으면 선택
    if (data.category) {
      if (existingCategories.value.includes(data.category)) {
        selectedCategory.value = data.category
      } else {
        selectedCategory.value = '__custom__'
        customCategory.value = data.category
      }
    }
  } catch {
    toast.error('인증서 정보를 불러오는데 실패했습니다')
    handleBack()
  }
}

const handleSubmit = async (): Promise<void> => {
  if (!isFormValid.value) {
    toast.error('필수 항목을 모두 입력해주세요')
    return
  }

  submitting.value = true

  try {
    // 빈 문자열을 undefined로 변환
    const payload = {
      name: formData.value.name.trim(),
      issuingOrganization: formData.value.issuingOrganization.trim(),
      category: formData.value.category?.trim() || undefined,
      markImage: formData.value.markImage?.trim() || undefined,
      certificatePdf: formData.value.certificatePdf?.trim() || undefined,
    }

    if (isEditMode.value) {
      await certificatesAPI.update(certificateId, payload)
      toast.success('인증서가 수정되었습니다')
    } else {
      await certificatesAPI.create(payload as CreateCertificateDto)
      toast.success('인증서가 등록되었습니다')
    }

    const fromTab = route.query.from as string || 'certificates'
    router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '저장에 실패했습니다'
    toast.error(errorMessage)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadExistingCategories()
  await loadCertificate()
})
</script>

<style scoped>
.bg-primary {
  background-color: #22a8c3;
}

.hover\:bg-primary\/90:hover {
  background-color: rgba(34, 168, 195, 0.9);
}

.focus\:border-primary:focus {
  border-color: #22a8c3;
}

.text-primary {
  color: #22a8c3;
}
</style>
