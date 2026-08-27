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
            {{ isEditMode ? '제품 정보 수정' : '신규 제품 등록' }}
          </h1>
        </div>
      </div>
    </nav>

    <main class="mx-auto px-4 py-6 space-y-6">
      <!-- General Information Card -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">일반 정보</h2>
        <div class="space-y-5">
          <!-- 1. 제목 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">제품 제목</label>
            <input
              v-model="formData.name"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all placeholder:text-gray-400"
              placeholder="예: Pro-Series High Bay LED"
              type="text"
            />
          </div>

          <!-- 2. 카테고리 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">카테고리</label>
            <BaseSelectBox
              v-model="formData.category"
              :options="productCategoryOptions"
              placeholder="카테고리 선택..."
              custom-class="h-12"
            />
          </div>

          <!-- 4. 모델명 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">모델명</label>
            <input
              v-model="formData.modelName"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all"
              placeholder="예: LED-PRO-150W"
              type="text"
            />
          </div>
        </div>
      </section>

      <!-- 3. Product Images Card (3장) -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">
          제품 썸네일 이미지 (최대 3장)
        </h2>
        <div class="w-full flex flex-col md:flex-row gap-2 items-start">
          <div
            v-for="(imageItem, index) in formData.images"
            :key="index"
            class="w-full flex flex-col gap-2"
          >
            <label class="text-sm font-semibold">이미지 {{ index + 1 }}</label>
            <ImageUploader v-model="imageItem.image" />
            <input
              v-model="imageItem.description"
              class="w-full bg-gray-50 border border-gray-200 rounded-lg h-10 px-3 text-sm focus:ring-0 focus:border-primary transition-all placeholder:text-gray-400"
              placeholder="이미지 설명 (선택)"
              type="text"
            />
          </div>
        </div>
      </section>

      <!-- Technical Specifications Card -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">기술 사양</h2>
        <div class="space-y-5">
          <!-- 5. 크기 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">크기</label>
            <div class="relative">
              <input
                v-model="formData.dimensions"
                class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-20 focus:ring-0 focus:border-primary transition-all"
                placeholder="예: 1200 x 45 x 60"
                type="text"
              />
              <span
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                >{{ PRODUCT_UNITS.dimensions }}</span
              >
            </div>
          </div>

          <!-- 6. 전력(W) - 여러 개 입력 가능 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">전력 (여러 개 입력 가능)</label>
            <div class="space-y-2">
              <div v-for="(powerItem, index) in formData.power" :key="index" class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="formData.power[index]"
                    class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-20 focus:ring-0 focus:border-primary transition-all"
                    placeholder="150"
                    type="number"
                    step="0.01"
                  />
                  <span
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                    >{{ PRODUCT_UNITS.power }}</span
                  >
                </div>
                <button
                  v-if="formData.power.length > 1"
                  @click="formData.power.splice(index, 1)"
                  class="flex items-center justify-center size-12 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  type="button"
                >
                  <span class="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>
              <button
                @click="formData.power.push(0)"
                class="w-full h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                type="button"
              >
                <span class="material-symbols-outlined text-lg">add</span>
                전력 추가
              </button>
            </div>
          </div>

          <!-- 7. 수명 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">수명</label>
            <div class="relative">
              <input
                v-model="formData.lifespan"
                class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-24 focus:ring-0 focus:border-primary transition-all"
                placeholder="예: 50000"
                type="number"
                step="1"
              />
              <span
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                >{{ PRODUCT_UNITS.lifespan }}</span
              >
            </div>
          </div>

          <!-- 8. 색 온도 - 여러 개 입력 가능 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">색 온도 (여러 개 입력 가능)</label>
            <div class="space-y-2">
              <div v-for="(tempItem, index) in formData.colorTemp" :key="index" class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="formData.colorTemp[index]"
                    class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-16 focus:ring-0 focus:border-primary transition-all"
                    placeholder="예: 3000"
                    type="number"
                    step="1"
                  />
                  <span
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                    >{{ PRODUCT_UNITS.colorTemp }}</span
                  >
                </div>
                <button
                  v-if="formData.colorTemp.length > 1"
                  @click="formData.colorTemp.splice(index, 1)"
                  class="flex items-center justify-center size-12 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  type="button"
                >
                  <span class="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>
              <button
                @click="formData.colorTemp.push(0)"
                class="w-full h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                type="button"
              >
                <span class="material-symbols-outlined text-lg">add</span>
                색 온도 추가
              </button>
            </div>
          </div>

          <!-- 9. LED 칩 제조 회사 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">LED 칩 제조 회사</label>
            <input
              v-model="formData.ledChipManufacturer"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all"
              placeholder="예: Samsung, LG"
              type="text"
            />
          </div>

          <!-- 10. 역률 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">역률</label>
            <div class="relative">
              <input
                v-model="formData.powerFactor"
                class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-20 focus:ring-0 focus:border-primary transition-all"
                placeholder="예: 0.95"
                type="text"
              />
              <span
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                >{{ PRODUCT_UNITS.powerFactor }}</span
              >
            </div>
          </div>

          <!-- 11. 광효율 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">광효율</label>
            <div class="relative">
              <input
                v-model="formData.luminanceEfficiency"
                class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 pl-4 pr-24 focus:ring-0 focus:border-primary transition-all"
                placeholder="150"
                type="number"
                step="0.01"
              />
              <span
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400"
                >{{ PRODUCT_UNITS.luminanceEfficiency }}</span
              >
            </div>
          </div>

          <!-- 12. 연색성 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">연색성</label>
            <input
              v-model="formData.colorRendering"
              class="w-full bg-gray-50 border-gray-200 rounded-lg h-12 px-4 focus:ring-0 focus:border-primary transition-all"
              placeholder="예: Ra 80"
              type="text"
            />
          </div>

          <!-- 13. 인증 (복수 선택) -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">인증</label>
            <div class="grid grid-cols-2 gap-3">
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.certifications"
                  value="KS"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">KS 인증</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.certifications"
                  value="고효율"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">고효율 인증</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.certifications"
                  value="친환경"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">친환경 인증</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.certifications"
                  value="V-CHECK"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">V-CHECK</span>
              </label>
            </div>
          </div>

          <!-- 14. 옵션 (복수 선택) -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold">옵션</label>
            <div class="grid grid-cols-2 gap-3">
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.options"
                  value="개별디밍"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">개별디밍</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.options"
                  value="그룹디밍"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">그룹디밍</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.options"
                  value="센서"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">센서</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.options"
                  value="발전기 비상"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">발전기 비상</span>
              </label>
              <label
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              >
                <input
                  v-model="formData.options"
                  value="밧데리 비상"
                  class="rounded-sm border-gray-300 text-primary focus:ring-0"
                  type="checkbox"
                />
                <span class="text-sm font-medium">밧데리 비상</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- AI 자동생성 섹션 -->
      <section
        class="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-purple-100"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">
              AI 자동 생성
            </h2>
            <p class="text-xs text-gray-600">
              입력한 정보와 썸네일 이미지를 바탕으로 전문적인 제품 설명을 자동 생성합니다
            </p>
          </div>
        </div>

        <button
          @click="generateAIDescription"
          :disabled="!canGenerateDescription || aiGenerating"
          class="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg shadow-lg hover:shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!aiGenerating">AI 제품 설명 자동 생성</span>
          <span v-else>AI 생성 중...</span>
          <span v-if="!aiGenerating" class="material-symbols-outlined text-xl">auto_awesome</span>
          <span v-else class="material-symbols-outlined text-xl animate-spin"
            >progress_activity</span
          >
        </button>
      </section>

      <!-- 11. Description Card with Editor (기타 사항) -->
      <section
        class="bg-white rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50 overflow-hidden"
      >
        <div class="p-5 pb-2">
          <h2 class="text-xs font-bold uppercase tracking-widest text-primary">기타 사항</h2>
        </div>
        <div class="p-5 pt-2">
          <MarkdownEditor
            v-model="formData.description"
            placeholder="마크다운 형식으로 제품 상세 설명을 작성하세요. 이미지는 툴바의 이미지 버튼을 클릭하여 추가할 수 있습니다."
          />
        </div>
      </section>

      <!-- 12. Product Options (신제품, 메인 제품) -->
      <section
        class="bg-white p-5 rounded shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50"
      >
        <h2 class="text-xs font-bold uppercase tracking-widest text-primary mb-4">제품 옵션</h2>
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3">
            <label
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
            >
              <input
                v-model="formData.isNew"
                class="rounded-sm border-gray-300 text-primary focus:ring-0"
                type="checkbox"
              />
              <span class="text-sm font-medium">신제품</span>
            </label>
            <label
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-transparent cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
              :class="{ 'opacity-50 cursor-not-allowed': isFeaturedDisabled }"
            >
              <input
                v-model="formData.isFeatured"
                :disabled="isFeaturedDisabled"
                class="rounded-sm border-gray-300 text-primary focus:ring-0 disabled:opacity-50"
                type="checkbox"
              />
              <span class="text-sm font-medium">메인 제품</span>
            </label>
          </div>
          <p v-if="featuredHint" class="text-xs text-gray-500">{{ featuredHint }}</p>
        </div>
      </section>
    </main>

    <!-- Fixed Footer Action -->
    <div
      class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 z-50"
    >
      <div class="max-w-xl mx-auto flex gap-4">
        <button
          @click="handlePublish"
          :disabled="saving"
          class="flex-[2] h-12 bg-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span v-if="!saving">{{ isEditMode ? '수정' : '등록' }}</span>
          <span v-else>Saving...</span>
          <span v-if="!saving" class="material-symbols-outlined text-xl">send</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { productsAPI } from '@/api'
import type { Product } from '@/types'
import { useToast } from '@/composables/useToast'
import { useImageUpload } from '@/composables/useImageUpload'
import ImageUploader from '@/components/common/ImageUploader.vue'
import BaseSelectBox from '@/components/common/BaseSelectBox.vue'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'
import { PRODUCT_UNITS } from '@/constants/units'
import { productCategories } from '@/utils/category'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const imageUpload = useImageUpload('products')

// ImageUploader에서 사용할 수 있도록 provide
provide('imageUpload', imageUpload)

const isEditMode = computed(() => !!route.params.id)
const saving = ref(false)
const loading = ref(false)
const aiGenerating = ref(false)
const generatedImages = ref<string[]>([])

// 전체 제품 목록 (메인 제품 개수 확인용)
const allProducts = ref<Product[]>([])

// 제품 카테고리 옵션
const productCategoryOptions = productCategories.slice(1).map(cat => ({
  label: cat.label,
  value: cat.value
}))

const formData = reactive({
  id: '',
  name: '',
  category: '',
  images: [
    { image: '', description: '' },
    { image: '', description: '' },
    { image: '', description: '' },
  ] as { image: string; description: string }[],
  modelName: '',
  dimensions: '',
  power: [0] as number[],
  lifespan: 0,
  colorTemp: [0] as number[],
  ledChipManufacturer: '',
  certifications: [] as string[],
  powerFactor: '',
  luminanceEfficiency: 0,
  colorRendering: '',
  options: [] as string[],
  description: '',
  isNew: false,
  isFeatured: false,
})

// 메인 제품 개수 확인
const featuredCount = computed(() => {
  return allProducts.value.filter((p) => p.isFeatured).length
})

// 메인 제품 스위치 비활성화 여부
const isFeaturedDisabled = computed(() => {
  // 수정 모드에서 현재 제품이 이미 메인 제품인 경우 활성화
  if (isEditMode.value && formData.isFeatured) {
    return false
  }
  // 메인 제품이 4개 이상이면 비활성화
  return featuredCount.value >= 4
})

// 메인 제품 힌트 메시지
const featuredHint = computed(() => {
  if (isEditMode.value && formData.isFeatured) {
    return `현재 메인 제품: ${featuredCount.value}개`
  }
  if (featuredCount.value >= 4) {
    return '메인 제품은 최대 4개까지만 설정할 수 있습니다'
  }
  return `현재 메인 제품: ${featuredCount.value}/4개`
})

const fetchAllProducts = async (): Promise<void> => {
  try {
    const { data } = await productsAPI.getAll()
    allProducts.value = data
  } catch (error) {
    console.error('Failed to fetch products:', error)
  }
}

const fetchProduct = async (id: string): Promise<void> => {
  loading.value = true
  try {
    const { data } = await productsAPI.getOne(id)
    Object.assign(formData, data)
    // images 배열이 3개 미만이면 빈 항목으로 채움
    while (formData.images.length < 3) {
      formData.images.push({ image: '', description: '' })
    }
  } catch (error) {
    console.error('Failed to fetch product:', error)
    toast.error('제품 정보를 불러오는데 실패했습니다')
    router.push('/admin/dashboard')
  } finally {
    loading.value = false
  }
}

const validateForm = (): boolean => {
  if (!formData.name.trim()) {
    toast.error('제품명을 입력해주세요')
    return false
  }
  if (!formData.category) {
    toast.error('카테고리를 선택해주세요')
    return false
  }
  if (!formData.images[0]?.image) {
    toast.error('최소 1개의 이미지를 업로드해주세요')
    return false
  }
  if (!formData.modelName.trim()) {
    toast.error('모델명을 입력해주세요')
    return false
  }
  if (!formData.dimensions.trim()) {
    toast.error('크기를 입력해주세요')
    return false
  }
  const validPower = formData.power.filter((p) => p > 0)
  if (validPower.length === 0) {
    toast.error('최소 1개의 전력을 입력해주세요')
    return false
  }
  if (!formData.lifespan || formData.lifespan <= 0) {
    toast.error('수명을 입력해주세요')
    return false
  }
  const validColorTemp = formData.colorTemp.filter((c) => c > 0)
  if (validColorTemp.length === 0) {
    toast.error('최소 1개의 색 온도를 입력해주세요')
    return false
  }
  if (!formData.ledChipManufacturer.trim()) {
    toast.error('LED 칩 제조 회사를 입력해주세요')
    return false
  }
  if (formData.certifications.length === 0) {
    toast.error('최소 1개의 인증을 선택해주세요')
    return false
  }
  if (!formData.description.trim()) {
    toast.error('기타 사항을 입력해주세요')
    return false
  }
  return true
}

const handlePublish = async (): Promise<void> => {
  if (!validateForm()) return

  saving.value = true
  try {
    // 빈 이미지 제거 (image URL이 없는 항목 제거)
    const images = formData.images.filter((img) => img.image.trim() !== '')
    // 빈 전력/색온도 제거 (0 이하 제거)
    const power = formData.power.filter((p) => p > 0)
    const colorTemp = formData.colorTemp.filter((c) => c > 0)
    const luminanceEfficiency =
      formData.luminanceEfficiency > 0 ? formData.luminanceEfficiency : undefined

    if (isEditMode.value) {
      await productsAPI.update(formData.id, {
        name: formData.name,
        category: formData.category,
        images,
        modelName: formData.modelName,
        dimensions: formData.dimensions,
        power,
        lifespan: formData.lifespan,
        colorTemp,
        ledChipManufacturer: formData.ledChipManufacturer,
        certifications: formData.certifications,
        powerFactor: formData.powerFactor || undefined,
        luminanceEfficiency,
        colorRendering: formData.colorRendering || undefined,
        options: formData.options,
        description: formData.description,
        isNew: formData.isNew,
        isFeatured: formData.isFeatured,
      })
      toast.success('제품이 수정되었습니다')
    } else {
      await productsAPI.create({
        name: formData.name,
        category: formData.category,
        images,
        modelName: formData.modelName,
        dimensions: formData.dimensions,
        power,
        lifespan: formData.lifespan,
        colorTemp,
        ledChipManufacturer: formData.ledChipManufacturer,
        certifications: formData.certifications,
        powerFactor: formData.powerFactor || undefined,
        luminanceEfficiency,
        colorRendering: formData.colorRendering || undefined,
        options: formData.options,
        description: formData.description,
        isNew: formData.isNew,
        isFeatured: formData.isFeatured,
      })
      toast.success('제품이 추가되었습니다')
    }

    // 등록 완료 후 사용되지 않은 임시 이미지 삭제
    await imageUpload.cleanupUnusedImages(images.map((img) => img.image))

    const fromTab = route.query.from as string || 'products'
    router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
  } catch (error) {
    console.error('Failed to save product:', error)
    toast.error('저장에 실패했습니다')
  } finally {
    saving.value = false
  }
}

const handleBack = async (): Promise<void> => {
  if (confirm('작성 중인 내용이 저장되지 않을 수 있습니다. 페이지를 나가시겠습니까?')) {
    // 취소 시 모든 임시 이미지 삭제
    await imageUpload.clearTempImages()
    const fromTab = route.query.from as string || 'products'
    router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
  }
}

// AI 자동생성 가능 여부
const canGenerateDescription = computed(() => {
  const validPower = formData.power.filter((p) => p > 0)
  const validColorTemp = formData.colorTemp.filter((c) => c > 0)

  return (
    formData.name.trim() !== '' &&
    formData.category !== '' &&
    (formData.images[0]?.image ?? '') !== '' &&
    formData.modelName.trim() !== '' &&
    formData.dimensions.trim() !== '' &&
    validPower.length > 0 &&
    formData.lifespan > 0 &&
    validColorTemp.length > 0 &&
    formData.ledChipManufacturer.trim() !== ''
  )
})

// AI 제품 설명 및 이미지 생성
const generateAIDescription = async (): Promise<void> => {
  if (!canGenerateDescription.value) {
    toast.error('모든 필수 정보를 입력해주세요')
    return
  }

  aiGenerating.value = true
  generatedImages.value = []

  try {
    const { data } = await productsAPI.generateDescription({
      name: formData.name,
      category: formData.category,
      images: formData.images.filter((img) => img.image.trim() !== '').map((img) => img.image),
      modelName: formData.modelName,
      dimensions: formData.dimensions,
      power: formData.power.filter((p) => p > 0),
      lifespan: formData.lifespan,
      colorTemp: formData.colorTemp.filter((c) => c > 0),
      ledChipManufacturer: formData.ledChipManufacturer,
      certifications: formData.certifications,
    })

    // 생성된 설명을 폼에 채우기
    formData.description = data.description

    // 생성된 이미지 저장
    generatedImages.value = data.generatedImages || []

    toast.success(`제품 설명이 생성되었습니다! (${generatedImages.value.length}개의 이미지 포함)`)
  } catch (error: unknown) {
    console.error('Failed to generate description:', error)
    const axiosError = error as { response?: { status?: number } }
    if (axiosError.response?.status === 503) {
      toast.error('AI 서비스를 사용할 수 없습니다')
    } else {
      toast.error('설명 생성에 실패했습니다')
    }
  } finally {
    aiGenerating.value = false
  }
}

onMounted(async () => {
  await fetchAllProducts()
  if (isEditMode.value) {
    await fetchProduct(route.params.id as string)
  }
})

onBeforeUnmount(async () => {
  // 페이지 이탈 시 임시 이미지 정리 (등록이 완료되지 않은 경우)
  if (!saving.value) {
    await imageUpload.clearTempImages()
  }
})
</script>

<style scoped>
.font-display {
  font-family: 'Space Grotesk', sans-serif;
}

.text-primary {
  color: #22a8c3;
}

.bg-primary {
  background-color: #22a8c3;
}

.border-primary {
  border-color: #22a8c3;
}

.bg-background-light {
  background-color: #f9fafa;
}

.bg-background-dark {
  background-color: #1c1f22;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
}
</style>
