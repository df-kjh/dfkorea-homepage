<template>
  <div class="relative">
    <!-- Upload Area -->
    <label
      class="relative group cursor-pointer flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50 transition-colors h-40"
      :class="{ 'border-primary': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <!-- PDF Preview (when file is uploaded) -->
      <template v-if="modelValue">
        <div class="flex flex-col items-center justify-center gap-2 p-4">
          <span class="material-symbols-outlined text-5xl text-red-600">picture_as_pdf</span>
          <p class="text-sm font-medium text-gray-700 text-center">PDF 파일이 업로드되었습니다</p>
          <p class="text-xs text-gray-500">클릭하여 다른 파일로 변경</p>
        </div>
      </template>

      <!-- Upload Icon and Text (shown when no file) -->
      <template v-else>
        <span
          class="material-symbols-outlined text-3xl text-gray-400 group-hover:text-primary transition-colors"
        >
          upload_file
        </span>
        <p class="text-sm font-medium text-gray-500">PDF 파일을 추가해주세요.</p>
        <p class="text-[10px] text-gray-400">PDF 형식, 최대 10MB</p>
      </template>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        class="hidden"
        @change="handleFileChange"
      />
    </label>

    <!-- Remove Button (shown when file exists) -->
    <button
      v-if="modelValue"
      @click.prevent="handleRemove"
      class="absolute -top-2 -right-2 size-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
    >
      <span class="material-symbols-outlined text-lg">close</span>
    </button>

    <!-- Upload Progress -->
    <div
      v-if="uploading"
      class="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-2 text-white">
        <span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
        <p class="text-sm font-medium">업로드 중...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import { UPLOAD_CONFIG } from '@/constants'
import { useToast } from '@/composables/useToast'
import type { useImageUpload } from '@/composables/useImageUpload'

interface Props {
  modelValue?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
})

const emit = defineEmits<Emits>()
const toast = useToast()

// Form에서 provide한 imageUpload 인스턴스 받기 (PDF도 동일한 업로드 서비스 사용)
const imageUpload = inject<ReturnType<typeof useImageUpload>>('imageUpload')

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const isDragging = ref(false)

const validateFile = (file: File): boolean => {
  const isPdf = file.type === 'application/pdf'
  if (!isPdf) {
    toast.error('PDF 파일만 업로드할 수 있습니다')
    return false
  }

  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    toast.error('파일 크기는 10MB를 초과할 수 없습니다')
    return false
  }

  return true
}

const uploadFile = async (file: File): Promise<void> => {
  if (!validateFile(file)) return
  if (!imageUpload) {
    toast.error('업로드 서비스를 사용할 수 없습니다')
    return
  }

  uploading.value = true

  try {
    // uploadPdf 메서드 사용 (PDF 전용)
    const fileUrl = await imageUpload.uploadPdf(file)
    if (fileUrl) {
      emit('update:modelValue', fileUrl)
    }
  } catch (error) {
    console.error('Upload error:', error)
    // useImageUpload에서 이미 에러 토스트를 표시하므로 여기서는 표시하지 않음
  } finally {
    uploading.value = false
  }
}

const handleFileChange = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

const handleDrop = (event: DragEvent): void => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

const handleRemove = (): void => {
  emit('update:modelValue', '')
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<style scoped>
.border-primary {
  border-color: #22a8c3;
}

.text-primary {
  color: #22a8c3;
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
