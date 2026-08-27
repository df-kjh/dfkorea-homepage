<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return 'check_circle'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'info'
  }
}

const getColorClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-500'
    case 'error':
      return 'bg-red-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'info':
      return 'bg-blue-500'
    default:
      return 'bg-gray-500'
  }
}
</script>

<template>
  <div class="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="[
        'flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl text-white min-w-[300px] animate-slide-in',
        getColorClass(toast.type),
      ]"
    >
      <span class="material-symbols-outlined">{{ getIcon(toast.type) }}</span>
      <span class="flex-1">{{ toast.message }}</span>
      <button
        @click="remove(toast.id)"
        class="hover:bg-white/20 rounded-full p-1 transition-colors"
      >
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
</style>
