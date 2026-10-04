<script setup lang="ts">
import { ref, watch } from 'vue'
import PublicPageHeader from '@/components/common/site/PublicPageHeader.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ProductFilterPopover from './ProductFilterPopover.vue'
import type { ProductFilters, ProductFilterOptions } from '@/types/quote'

interface Props {
  title?: string
  totalItems?: number
  searchQuery?: string
  filters: ProductFilters
  filterOptions: ProductFilterOptions
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Collections',
  totalItems: 0,
  searchQuery: '',
})

const emit = defineEmits<{
  search: [query: string]
  applyFilters: [filters: ProductFilters]
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
  <div v-bind="$attrs" class="df-products-header">
    <PublicPageHeader
      eyebrow="PRODUCT COLLECTION"
      :title="title"
      description="공간에 맞는 조명, 선택의 기준을 선명하게."
      index="02"
      ><template #actions
        ><p v-if="totalItems > 0" class="df-collection-total">
          총 {{ totalItems }}개의 제품
        </p></template
      ></PublicPageHeader
    >
    <div class="products-search">
      <SearchBar
        v-model="localSearchQuery"
        class="products-search__input"
        max-width="max-w-none"
        placeholder="제품명 또는 모델명으로 검색..."
        :debounce-ms="300"
        @search="handleSearch"
      /><ProductFilterPopover
        :model-value="filters"
        :options="filterOptions"
        @apply="emit('applyFilters', $event)"
      />
    </div>
  </div>
</template>
<style scoped>
/* This header is already inside the collection container and fixed-header inset. */
.df-products-header :deep(.public-page-header) {
  padding: 0 0 43px;
}
.df-products-header :deep(.public-container) {
  padding-inline: 0;
}

.products-search {
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 26px 0;
  border-top: 1px solid #d4c8b4;
}
.products-search__input {
  flex: 1;
  min-width: 0;
}
.df-collection-total {
  font-size: 11px;
  letter-spacing: 0.02em;
  color: #8b7d65;
}
.products-search :deep(input) {
  background: transparent;
  border-color: #c5b89f;
  color: #302c24;
  border-radius: 0;
}
.products-search :deep(input:focus) {
  border-color: #987340;
  box-shadow: 0 0 0 1px #987340;
}
@media (max-width: 640px) {
  .products-search {
    padding-block: 20px;
    gap: 8px;
  }
}
</style>
