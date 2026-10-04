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
  <div class="df-categories" aria-label="분류">
    <button
      v-for="category in categories"
      :key="category"
      type="button"
      :aria-pressed="selectedCategory === category"
      :class="{ 'is-selected': selectedCategory === category }"
      @click="handleCategoryClick(category)"
    >
      {{ category }}
    </button>
  </div>
</template>
<style scoped>
.df-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  padding: 21px 0;
  border-top: 1px solid #d6c9b3;
  border-bottom: 1px solid #d6c9b3;
}
.df-categories button {
  min-height: 42px;
  padding: 10px 20px;
  border: 1px solid #d7c9b0;
  border-radius: 999px;
  background: transparent;
  color: #8a7758;
  font-size: 12px;
  line-height: 1.6;
  transition:
    background 0.2s,
    color 0.2s;
}
.df-categories button:hover {
  background: #e6ddcb;
}
.df-categories button.is-selected {
  background: #29291e;
  border-color: #29291e;
  color: #f3e8d2;
}
.df-categories button:focus-visible {
  outline: 2px solid #92703d;
  outline-offset: 4px;
}
@media (max-width: 640px) {
  .df-categories {
    gap: 7px;
    padding-block: 17px;
  }
  .df-categories button {
    padding: 9px 15px;
    font-size: 11px;
    min-height: 38px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .df-categories button {
    transition: none;
  }
}
</style>
