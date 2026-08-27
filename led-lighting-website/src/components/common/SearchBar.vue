<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
  maxWidth?: string
  debounceMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '검색...',
  maxWidth: 'max-w-md',
  debounceMs: 700,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [query: string]
}>()

const localValue = ref(props.modelValue)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal
  },
)

const handleInput = () => {
  emit('update:modelValue', localValue.value)

  // 기존 타이머 취소
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // debounce 적용: 설정된 시간 후에 search 이벤트 발생
  debounceTimer = setTimeout(() => {
    emit('search', localValue.value)
  }, props.debounceMs)
}

const handleKeyup = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    // Enter 키는 즉시 검색 (debounce 무시)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    emit('search', localValue.value)
  }
}

const clearSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  localValue.value = ''
  emit('update:modelValue', '')
  emit('search', '')
}

// 컴포넌트 unmount 시 타이머 정리
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div :class="['relative flex items-center rounded-xl border border-divider bg-white focus-within:ring-primary', maxWidth]">
    <input
      v-model="localValue"
      type="text"
      :placeholder="placeholder"
      class="w-full px-4 py-3 pl-12 pr-12 text-text-main bg-white placeholder:text-text-desc focus:outline-none focus:border-transparent transition-all"
      @input="handleInput"
      @keyup="handleKeyup"
    />
    <span
      class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-desc text-[20px]"
    >
      search
    </span>
    <button
      v-if="localValue"
      @click="clearSearch"
      class="flex items-center text-text-desc hover:text-text-main transition-colors"
      aria-label="검색어 지우기"
    >
      <span class="material-symbols-outlined text-[20px]">close</span>
    </button>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 24;
}
</style>
