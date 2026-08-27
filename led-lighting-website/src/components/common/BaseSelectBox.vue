<template>
  <div
    ref="selectRef"
    :class="[
      'base-select',
      `base-select--${size}`,
      {
        'base-select--disabled': disabled,
        'base-select--error': error,
        'base-select--open': isOpen,
      },
      customClass,
    ]"
    @click="toggleDropdown"
  >
    <!-- Selected Value Display -->
    <div class="base-select__display">
      <span v-if="selectedLabel" class="base-select__text">{{ selectedLabel }}</span>
      <span v-else class="base-select__placeholder">{{ placeholder || '선택하세요' }}</span>
      <span class="base-select__arrow" :class="{ 'base-select__arrow--open': isOpen }">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 9L1 4h10z" />
        </svg>
      </span>
    </div>

    <!-- Dropdown Options -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="base-select__dropdown">
        <div class="base-select__options">
          <div
            v-for="option in computedOptions"
            :key="option.value"
            :class="[
              'base-select__option',
              {
                'base-select__option--selected': isSelected(option.value),
                'base-select__option--disabled': option.disabled,
              },
            ]"
            @click.stop="selectOption(option)"
          >
            {{ option.label }}
            <span v-if="isSelected(option.value)" class="base-select__check">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.5 3.5L6 11 2.5 7.5l1-1L6 8.94l6.5-6.44 1 1z" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  modelValue: string | number | null
  options: SelectOption[] | string[] | number[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  size?: 'small' | 'default' | 'large'
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  error: false,
  size: 'default',
  customClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

// options를 정규화하여 { label, value } 형태로 변환
const computedOptions = computed(() => {
  if (!props.options || props.options.length === 0) return []

  const firstOption = props.options[0]

  // 이미 { label, value } 형태인 경우
  if (typeof firstOption === 'object' && 'label' in firstOption && 'value' in firstOption) {
    return props.options as SelectOption[]
  }

  // 문자열이나 숫자 배열인 경우
  return (props.options as (string | number)[]).map((item) => ({
    label: String(item),
    value: item,
    disabled: false,
  }))
})

// 선택된 옵션의 label 표시
const selectedLabel = computed(() => {
  if (props.modelValue === null || props.modelValue === '') return ''
  const option = computedOptions.value.find(opt => opt.value === props.modelValue)
  return option ? option.label : ''
})

const isSelected = (value: string | number) => {
  return props.modelValue === value
}

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

const selectOption = (option: SelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  isOpen.value = false
}

// 외부 클릭 시 드롭다운 닫기
const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

// ESC 키로 드롭다운 닫기
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.base-select {
  position: relative;
  width: 100%;
  cursor: pointer;
  user-select: none;
}

.base-select--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Display Area */
.base-select__display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border-muted, #e5e7eb);
  border-radius: 0.5rem;
  background-color: white;
  color: var(--color-text-main, #121617);
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s ease;
  min-height: 48px;
}

.base-select:not(.base-select--disabled) .base-select__display:hover {
  border-color: var(--color-border-hover, #d1d5db);
}

.base-select--open .base-select__display {
  border-color: var(--color-primary, #22a8c3);
  box-shadow: 0 0 0 2px rgba(34, 168, 195, 0.1);
}

.base-select--error .base-select__display {
  border-color: var(--color-danger, #ef4444);
}

.base-select--error.base-select--open .base-select__display {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
}

.base-select__text {
  flex: 1;
  color: var(--color-text-main, #121617);
  font-weight: 500;
}

.base-select__placeholder {
  flex: 1;
  color: var(--color-text-muted, #9ca3af);
}

.base-select__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.5rem;
  color: var(--color-text-secondary, #6b7280);
  transition: transform 0.2s ease;
}

.base-select__arrow--open {
  transform: rotate(180deg);
}

/* Dropdown */
.base-select__dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: white;
  border: 1px solid var(--color-border-muted, #e5e7eb);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-height: 300px;
  overflow: hidden;
}

.base-select__options {
  overflow-y: auto;
  max-height: 300px;
  padding: 0.25rem;
}

.base-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.95rem;
  color: var(--color-text-main, #121617);
}

.base-select__option:hover:not(.base-select__option--disabled) {
  background-color: var(--color-background-hover, #f3f4f6);
}

.base-select__option--selected {
  background-color: rgba(34, 168, 195, 0.08);
  color: var(--color-primary, #22a8c3);
  font-weight: 600;
}

.base-select__option--selected:hover {
  background-color: rgba(34, 168, 195, 0.12);
}

.base-select__option--disabled {
  color: var(--color-text-muted, #9ca3af);
  cursor: not-allowed;
  opacity: 0.5;
}

.base-select__check {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary, #22a8c3);
  margin-left: 0.5rem;
}

/* Size variants */
.base-select--small .base-select__display {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  min-height: 40px;
}

.base-select--small .base-select__option {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.base-select--large .base-select__display {
  padding: 1rem 1.25rem;
  font-size: 1.125rem;
  min-height: 56px;
}

.base-select--large .base-select__option {
  padding: 1rem 1.25rem;
  font-size: 1.0625rem;
}

/* Dropdown Animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
  transform-origin: top;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* Scrollbar Styling */
.base-select__options::-webkit-scrollbar {
  width: 6px;
}

.base-select__options::-webkit-scrollbar-track {
  background: transparent;
}

.base-select__options::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}

.base-select__options::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}
</style>
