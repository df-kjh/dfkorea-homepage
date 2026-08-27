<script setup lang="ts">
import { ref, watch } from 'vue'
import SearchBar from '@/components/common/SearchBar.vue'

interface Props {
  title?: string
  totalItems?: number
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Collections',
  totalItems: 0,
  searchQuery: '',
})

const emit = defineEmits<{
  search: [query: string]
}>()

const localSearchQuery = ref(props.searchQuery)

watch(
  () => props.searchQuery,
  (newVal) => {
    localSearchQuery.value = newVal
  },
)

const handleSearch = (query: string) => {
  emit('search', query)
}
</script>

<template>
  <div v-bind="$attrs">
    <header class="px-6 md:px-12 mb-8">
      <div>
        <h1 class="text-4xl md:text-5xl font-bold text-text-main tracking-tight">{{ title }}</h1>
        <p v-if="totalItems > 0" class="text-text-sub mt-4 text-lg">총 {{ totalItems }}개의 제품</p>
      </div>
    </header>

    <!-- Search Bar -->
    <div class="px-6 md:px-12 mb-8">
      <SearchBar
        v-model="localSearchQuery"
        placeholder="제품명으로 검색..."
        @search="handleSearch"
      />
    </div>
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
