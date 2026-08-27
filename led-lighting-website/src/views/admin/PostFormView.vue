<template>
  <div class="min-h-screen bg-background-light pb-32 font-display text-[#121617]">
    <!-- TopAppBar -->
    <header
      class="sticky top-0 z-50 flex items-center bg-background-light/80 backdrop-blur-md p-4 pb-2 justify-between border-b border-border-muted/50"
    >
      <div
        @click="handleBack"
        class="text-[#121617] flex size-10 shrink-0 items-center justify-center cursor-pointer hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </div>
      <h2
        class="text-[#121617] text-base font-bold leading-tight tracking-tight flex-1 text-center"
      >
        {{ isEditMode ? 'Edit News' : 'Add News' }}
      </h2>
    </header>

    <main class="flex-1 mx-auto">
      <!-- HeadlineText -->
      <div class="px-4 pt-8 pb-4">
        <h1 class="text-[#121617] tracking-tight text-[32px] font-bold leading-tight">
          {{ isEditMode ? '게시글 수정' : '신규 게시글 등록' }}
        </h1>
      </div>

      <!-- Form Content -->
      <div class="space-y-2">
        <!-- Title TextField -->
        <div class="flex flex-col gap-2 px-4 py-3">
          <label class="flex flex-col w-full">
            <p class="text-[#121617] text-xs font-bold uppercase tracking-wider pb-2">제목</p>
            <input
              v-model="formData.title"
              class="form-input flex w-full rounded border border-border-muted bg-white text-[#121617] focus:outline-0 focus:ring-1 focus:ring-primary focus:border-primary h-14 placeholder:text-[#658086] p-[15px] text-base font-normal leading-normal transition-all"
              placeholder="제목을 입력해주세요..."
            />
          </label>
        </div>

        <!-- Summary TextField -->
        <div class="flex flex-col gap-2 px-4 py-3">
          <label class="flex flex-col w-full">
            <p class="text-[#121617] text-xs font-bold uppercase tracking-wider pb-2">요약</p>
            <textarea
              v-model="formData.excerpt"
              class="form-input flex w-full min-w-0 flex-1 resize-none rounded text-[#121617] focus:outline-0 focus:ring-1 focus:ring-primary border border-border-muted bg-white focus:border-primary min-h-32 placeholder:text-[#658086] p-[15px] text-base font-normal leading-normal transition-all"
            ></textarea>
          </label>
        </div>

        <!-- SectionHeader: Media -->
        <div class="px-4 pt-4">
          <h3 class="text-[#121617] text-xs font-bold uppercase tracking-wider">커버 이미지</h3>
        </div>

        <!-- Custom Media Upload Component -->
        <div class="px-4 py-3">
          <ImageUploader
            v-model="formData.image"
            tipTitle="Tap to upload banner"
            tipDescription="권장 크기: 1200x630px"
            :aspect-ratio="'video'"
          />
        </div>

        <!-- Metadata Row (Category & Date) -->
        <div class="flex gap-4 px-4 py-3">
          <label class="flex flex-col flex-1">
            <p class="text-[#121617] text-xs font-bold uppercase tracking-wider pb-2">카테고리</p>
            <BaseSelectBox
              v-model="formData.category"
              :options="categoryOptions"
              placeholder="카테고리 선택..."
              custom-class="h-14"
            />
          </label>
        </div>

        <!-- SectionHeader: Editor -->
        <div class="px-4 pt-4">
          <h3 class="text-[#121617] text-xs font-bold uppercase tracking-wider">본문 내용</h3>
        </div>

        <!-- RichHTML Editor -->
        <div class="px-4 py-2">
          <MarkdownEditor v-model="formData.content" />
        </div>
      </div>
    </main>

    <!-- Fixed Action Footer -->
    <footer
      class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 z-50"
    >
      <div class="max-w-xl mx-auto flex gap-4">
        <button
          @click="handlePublish"
          :disabled="saving"
          class="flex-[2] h-12 bg-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span v-if="!saving">{{ isEditMode ? '게시글 수정' : '게시글 등록' }}</span>
          <span v-else>저장 중...</span>
          <span v-if="!saving" class="material-symbols-outlined text-xl">send</span>
        </button>
      </div>
    </footer>

    <!-- Mobile Nav Indicator -->
    <div
      class="h-1 w-32 bg-zinc-200 rounded-full mx-auto mb-2 fixed bottom-2 left-1/2 -translate-x-1/2 z-[60]"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { postsAPI } from '@/api'
import { useToast } from '@/composables/useToast'
import { useImageUpload } from '@/composables/useImageUpload'
import ImageUploader from '@/components/common/ImageUploader.vue'
import BaseSelectBox from '@/components/common/BaseSelectBox.vue'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const imageUpload = useImageUpload('posts')

// ImageUploader에서 사용할 수 있도록 provide
provide('imageUpload', imageUpload)

const isEditMode = computed(() => !!route.params.id)
const saving = ref(false)
const loading = ref(false)

// 카테고리 옵션
const categoryOptions = [
  { label: '회사소식', value: '회사소식' },
  { label: '제품소식', value: '제품소식' },
  { label: '기술정보', value: '기술정보' },
  { label: '산업동향', value: '산업동향' },
]

const formData = reactive({
  id: '',
  title: '',
  excerpt: '',
  content: '',
  category: '',
  image: '',
})

const fetchPost = async (id: string): Promise<void> => {
  loading.value = true
  try {
    const { data } = await postsAPI.getOne(id)
    Object.assign(formData, data)
  } catch (error) {
    console.error('Failed to fetch post:', error)
    toast.error('게시글 정보를 불러오는데 실패했습니다')
    router.push('/admin/dashboard')
  } finally {
    loading.value = false
  }
}

const validateForm = (): boolean => {
  if (!formData.title.trim()) {
    toast.error('제목을 입력해주세요')
    return false
  }
  if (!formData.category) {
    toast.error('카테고리를 선택해주세요')
    return false
  }
  if (!formData.excerpt.trim()) {
    toast.error('요약을 입력해주세요')
    return false
  }
  if (!formData.image) {
    toast.error('커버 이미지를 업로드해주세요')
    return false
  }
  if (!formData.content.trim()) {
    toast.error('내용을 입력해주세요')
    return false
  }
  return true
}

const handlePublish = async (): Promise<void> => {
  if (!validateForm()) return

  saving.value = true
  try {
    if (isEditMode.value) {
      await postsAPI.update(formData.id, {
        title: formData.title,
        excerpt: formData.excerpt,
        content: formData.content,
        category: formData.category,
        image: formData.image,
      })
      toast.success('게시글이 수정되었습니다')
    } else {
      await postsAPI.create({
        title: formData.title,
        excerpt: formData.excerpt,
        content: formData.content,
        category: formData.category,
        image: formData.image,
      })
      toast.success('게시글이 추가되었습니다')
    }

    // 등록 완료 후 사용되지 않은 임시 이미지 삭제
    await imageUpload.cleanupUnusedImages([formData.image])

    const fromTab = route.query.from as string || 'news'
    router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
  } catch (error) {
    console.error('Failed to save post:', error)
    toast.error('저장에 실패했습니다')
  } finally {
    saving.value = false
  }
}

const handleBack = async (): Promise<void> => {
  if (confirm('작성 중인 내용이 저장되지 않을 수 있습니다. 페이지를 나가시겠습니까?')) {
    // 취소 시 모든 임시 이미지 삭제
    await imageUpload.clearTempImages()
    const fromTab = route.query.from as string || 'news'
    router.push({ path: '/admin/dashboard', query: { tab: fromTab } })
  }
}

onMounted(async () => {
  if (isEditMode.value) {
    await fetchPost(route.params.id as string)
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

.ring-primary {
  --tw-ring-color: #22a8c3;
}

.border-primary {
  border-color: #22a8c3;
}

.bg-background-light {
  background-color: #ffffff;
}

.border-border-muted {
  border-color: #dce3e5;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
}
</style>
