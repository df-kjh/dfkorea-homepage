<template>
  <div class="relative">
    <!-- Upload Area -->
    <label
      class="relative group cursor-pointer flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50 transition-colors overflow-hidden"
      :class="[{ 'border-primary': isDragging }, aspectRatio === 'video' ? 'aspect-video' : 'h-40']"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <!-- Preview Image -->
      <img
        v-if="modelValue"
        :src="modelValue"
        :alt="alt"
        class="absolute inset-0 w-full h-full object-cover"
      />

      <!-- Upload Icon and Text (shown when no image) -->
      <template v-if="!modelValue">
        <span
          class="material-symbols-outlined text-3xl text-gray-400 group-hover:text-primary transition-colors"
        >
          add_photo_alternate
        </span>
        <p class="text-sm font-medium text-gray-500">{{ tipTitle }}</p>
        <p class="text-[10px] text-gray-400">{{ tipDescription }}</p>
      </template>

      <!-- Change Image Overlay (shown on hover when image exists) -->
      <div
        v-if="modelValue"
        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <span class="material-symbols-outlined text-3xl text-white">edit</span>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        class="hidden"
        @change="handleFileChange"
      />
    </label>

    <!-- Remove Button (shown when image exists) -->
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
        <p class="text-sm font-medium">Uploading...</p>
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
  alt?: string
  showTip?: boolean
  tipTitle?: string
  tipDescription?: string
  fieldName?: string
  accept?: string
  aspectRatio?: 'square' | 'video'
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  alt: '이미지 추가',
  showTip: true,
  tipTitle: '이미지를 추가해주세요.',
  tipDescription: 'JPG, PNG 또는 WebP 형식, 최대 5MB',
  fieldName: UPLOAD_CONFIG.FIELD_NAME,
  accept: 'image/*',
  aspectRatio: 'square',
})

const emit = defineEmits<Emits>()
const toast = useToast()

// Form에서 provide한 imageUpload 인스턴스 받기
const imageUpload = inject<ReturnType<typeof useImageUpload>>('imageUpload')

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const isDragging = ref(false)

const validateFile = (file: File): boolean => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    toast.error('이미지 파일만 업로드할 수 있습니다')
    return false
  }

  const maxSize = UPLOAD_CONFIG.MAX_SIZE_MB * 1024 * 1024
  if (file.size > maxSize) {
    toast.error(`파일 크기는 ${UPLOAD_CONFIG.MAX_SIZE_MB}MB를 초과할 수 없습니다`)
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
    const imageUrl = await imageUpload.upload(file)
    if (imageUrl) {
      emit('update:modelValue', imageUrl)
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
