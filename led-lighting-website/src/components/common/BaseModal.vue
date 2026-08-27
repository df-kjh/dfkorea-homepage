<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 flex items-center justify-center p-4"
        :class="overlayClass"
        :style="{ zIndex }"
        @click.self="handleOverlayClick"
      >
        <Transition
          enter-active-class="transition-all duration-300"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-300"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="modelValue"
            ref="dialogElement"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="title ? titleId : undefined"
            tabindex="-1"
            class="relative bg-white rounded-2xl shadow-2xl overflow-auto"
            :class="contentClass"
            :style="{ width, maxWidth, maxHeight }"
          >
            <!-- Close Button (if showCloseButton is true) -->
            <button
              v-if="showCloseButton"
              @click="handleClose"
              aria-label="모달 닫기"
              class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
            >
              <span class="material-symbols-outlined text-gray-600">close</span>
            </button>

            <!-- Title (if provided) -->
            <div v-if="title" class="px-6 pt-6 pb-4" :class="{ 'pr-14': showCloseButton }">
              <h3 :id="titleId" class="text-2xl font-bold text-text-main">{{ title }}</h3>
              <p v-if="subtitle" class="text-text-secondary mt-1">{{ subtitle }}</p>
            </div>

            <!-- Content Slot -->
            <div :class="contentPadding">
              <slot />
            </div>

            <!-- Footer Slot (optional) -->
            <div v-if="$slots.footer" class="px-6 pb-6 pt-4 border-t border-gray-100">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { modalStack } from './modal-stack'

interface Props {
  modelValue: boolean
  title?: string
  subtitle?: string
  width?: string
  maxWidth?: string
  maxHeight?: string
  zIndex?: number
  overlayClass?: string
  contentClass?: string
  contentPadding?: string
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '90vh',
  maxWidth: '90vw',
  maxHeight: '90vh',
  zIndex: 50,
  overlayClass: 'bg-black/70',
  contentClass: '',
  contentPadding: 'p-6',
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEsc: true,
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}

const emit = defineEmits<Emits>()
const dialogElement = ref<HTMLElement | null>(null)
const titleId = `modal-title-${Math.random().toString(36).slice(2)}`
const modalId = `modal-${Math.random().toString(36).slice(2)}`

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick && modalStack.isTop(modalId)) {
    handleClose()
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!modalStack.isTop(modalId)) return
  if (event.key === 'Escape' && props.closeOnEsc && props.modelValue) {
    handleClose()
    return
  }

  if (event.key !== 'Tab' || !props.modelValue) return
  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    dialogElement.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const getFocusableElements = (): HTMLElement[] => {
  const dialog = dialogElement.value
  if (!dialog || typeof window === 'undefined') return []
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(',')
  return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    const style = window.getComputedStyle(element)
    return !element.hidden && element.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden'
  })
}

const focusInitialElement = () => {
  const [firstFocusable] = getFocusableElements()
  const initialFocus = firstFocusable ?? dialogElement.value
  initialFocus?.focus()
}

// Body scroll lock
watch(
  () => props.modelValue,
  async (isOpen) => {
    // Teleported dialogs are not rendered in the server DOM.
    if (typeof document === 'undefined') return
    if (isOpen) {
      modalStack.register({
        id: modalId,
        restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        focus: focusInitialElement,
      })
      await nextTick()
      if (modalStack.isTop(modalId)) focusInitialElement()
    } else {
      modalStack.unregister(modalId)
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeyDown)
  modalStack.unregister(modalId)
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
