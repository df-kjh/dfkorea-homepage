<script setup lang="ts">
interface Props {
  categories: string[]
  selectedCategory: string
}

defineProps<Props>()

const emit = defineEmits<{
  categoryChange: [category: string]
}>()

const handleCategoryClick = (category: string) => {
  emit('categoryChange', category)
}
</script>

<template>
  <div class="px-6 md:px-12 mb-8">
    <div class="flex flex-wrap gap-3">
      <button
        v-for="category in categories"
        :key="category"
        @click="handleCategoryClick(category)"
        :class="[
          'px-5 py-2.5 rounded-full text-sm font-bold transition-all',
          selectedCategory === category
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'bg-surface text-text-sub hover:bg-primary/10 hover:text-primary border border-divider',
        ]"
      >
        {{ category }}
      </button>
    </div>
  </div>
</template>
