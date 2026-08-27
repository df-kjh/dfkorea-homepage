<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
  totalItems?: number
  showInfo?: boolean
}

withDefaults(defineProps<Props>(), {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  showInfo: true,
})

const emit = defineEmits<{
  pageChange: [page: number]
}>()

const handlePageChange = (page: number) => {
  emit('pageChange', page)
}
</script>

<template>
  <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
    <button
      @click="handlePageChange(currentPage - 1)"
      :disabled="currentPage === 1"
      class="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="이전 페이지"
    >
      <span class="material-symbols-outlined">chevron_left</span>
    </button>

    <span v-if="showInfo" class="text-sm text-gray-600 px-2">
      {{ currentPage }} / {{ totalPages }} 페이지
      <span v-if="totalItems > 0" class="text-gray-500">(총 {{ totalItems }}개)</span>
    </span>

    <button
      @click="handlePageChange(currentPage + 1)"
      :disabled="currentPage === totalPages"
      class="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="다음 페이지"
    >
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
</style>
