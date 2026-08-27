<template>
  <MdEditor
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :language="language"
    :preview="preview"
    :toolbars="toolbars"
    :placeholder="placeholder"
    :on-upload-img="handleUploadImage"
    :style="{ height: height }"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { MdEditor, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { DEFAULT_TOOLBAR, DEFAULT_MARKDOWN_PLACEHOLDER } from '@/constants'
import type { useImageUpload } from '@/composables/useImageUpload'

interface Props {
  modelValue: string
  language?: string
  preview?: boolean
  toolbars?: ToolbarNames[]
  placeholder?: string
  height?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

withDefaults(defineProps<Props>(), {
  language: 'ko-KR',
  preview: true,
  toolbars: () => DEFAULT_TOOLBAR,
  placeholder: DEFAULT_MARKDOWN_PLACEHOLDER,
  height: '500px',
})

const emit = defineEmits<Emits>()

// Form에서 provide한 imageUpload 인스턴스 받기
const imageUpload = inject<ReturnType<typeof useImageUpload>>('imageUpload')

const handleUploadImage =
  imageUpload?.createMarkdownUploadHandler() ||
  (async () => {
    console.error('imageUpload is not provided')
  })
</script>

<style scoped>
/* 마크다운 에디터 스타일 */
:deep(.md-editor) {
  border-radius: 8px;
}

:deep(.md-editor-preview-wrapper) {
  padding: 20px;
}

:deep(.md-editor-preview) {
  color: #303133;
  font-size: 15px;
  line-height: 1.8;
}

:deep(.md-editor-preview h1) {
  font-size: 24px;
  font-weight: 700;
  margin: 20px 0 12px 0;
  color: #303133;
}

:deep(.md-editor-preview h2) {
  font-size: 20px;
  font-weight: 700;
  margin: 18px 0 10px 0;
  color: #303133;
}

:deep(.md-editor-preview h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: #303133;
}

:deep(.md-editor-preview img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
}

:deep(.md-editor-preview code) {
  padding: 2px 6px;
  background: #f4f4f5;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
}

:deep(.md-editor-preview pre) {
  margin: 16px 0;
  padding: 16px;
  background: #282c34;
  border-radius: 8px;
  overflow-x: auto;
}

:deep(.md-editor-preview pre code) {
  padding: 0;
  background: transparent;
  color: #abb2bf;
}

:deep(.md-editor-preview table) {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
}

:deep(.md-editor-preview th),
:deep(.md-editor-preview td) {
  padding: 8px 12px;
  border: 1px solid #e4e7ed;
}

:deep(.md-editor-preview th) {
  background: #f4f4f5;
  font-weight: 600;
}
</style>
