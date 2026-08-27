<template>
  <button
    class="text-white flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    :class="buttonClass"
    @click="triggerAiGeneration"
    :disabled="aiGenerating"
  >
    <span class="material-symbols-outlined" :class="{ 'animate-spin': aiGenerating }">
      {{ aiGenerating ? 'progress_activity' : 'auto_awesome' }}
    </span>
    <span>{{ aiGenerating ? 'AI 생성 중...' : label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { schedulerAPI } from '@/api'
import { useToast } from '@/composables/useToast'

type AiPostType = 'industryTrend' | 'productNews'

const props = withDefaults(
  defineProps<{
    type?: AiPostType
    label?: string
  }>(),
  {
    type: 'industryTrend',
    label: '산업동향 AI 자동생성',
  },
)

const toast = useToast()
const aiGenerating = ref(false)

const emit = defineEmits<{
  success: []
}>()

const buttonClass = computed(() =>
  props.type === 'productNews'
    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
    : 'bg-gradient-to-r from-purple-500 to-blue-500',
)

const confirmMessage = computed(() =>
  props.type === 'productNews'
    ? 'AI가 DB에 저장된 제품 중 하나를 선택해 "제품소식" 카테고리의 블로그 글을 자동으로 생성합니다.\n계속하시겠습니까?'
    : 'AI가 "LED 산업 동향" 카테고리의 블로그 글을 자동으로 생성합니다.\n계속하시겠습니까?',
)

const triggerAiGeneration = async (): Promise<void> => {
  if (aiGenerating.value) return

  if (!confirm(confirmMessage.value)) {
    return
  }

  try {
    aiGenerating.value = true
    toast.info('AI가 블로그 글을 생성 중입니다...')

    if (props.type === 'productNews') {
      await schedulerAPI.triggerProductNewsPost()
    } else {
      await schedulerAPI.triggerAiPost()
    }

    // 잠시 대기 후 성공 알림 (AI 생성 시간 고려)
    setTimeout(() => {
      toast.success('AI 블로그 글이 성공적으로 생성되었습니다!')
      aiGenerating.value = false
      emit('success')
    }, 3000)
  } catch (error: unknown) {
    console.error('Failed to trigger AI generation:', error)
    aiGenerating.value = false

    const err = error as { response?: { status?: number; data?: { message?: string } } }
    if (err.response?.status === 401) {
      toast.error('로그인이 필요합니다')
    } else if (err.response?.data?.message) {
      toast.error(err.response.data.message)
    } else {
      toast.error('AI 블로그 생성에 실패했습니다. GEMINI_API_KEY를 확인해주세요.')
    }
  }
}
</script>

<style scoped>
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
