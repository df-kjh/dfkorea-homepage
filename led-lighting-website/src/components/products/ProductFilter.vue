<template>
  <section class="filter-section">
    <div class="container">
      <el-radio-group v-model="localCategory" size="large" @change="handleChange">
        <el-radio-button
          v-for="category in categories"
          :key="category.value"
          :value="category.value"
        >
          {{ category.label }}
        </el-radio-button>
      </el-radio-group>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Category } from '@/types'

interface Props {
  modelValue: string
  categories: Category[]
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localCategory = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newValue) => {
    localCategory.value = newValue
  },
)

const handleChange = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.filter-section {
  padding: 40px 20px;
  background-color: var(--toss-white);
  border-bottom: 1px solid #e5e8eb;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.filter-section :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.filter-section :deep(.el-radio-button) {
  margin: 0;
}

.filter-section :deep(.el-radio-button__inner) {
  border-radius: 20px;
  padding: 12px 30px;
  font-size: 1rem;
  font-weight: 600;
  border: 1px solid #e5e8eb;
  transition: all 0.3s ease;
}

.filter-section :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--toss-blue);
  border-color: var(--toss-blue);
  color: white;
  box-shadow: 0 4px 12px rgba(49, 130, 246, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .filter-section {
    padding: 30px 15px;
  }

  .filter-section :deep(.el-radio-button__inner) {
    padding: 10px 20px;
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .filter-section :deep(.el-radio-button__inner) {
    padding: 8px 16px;
    font-size: 0.9rem;
  }
}
</style>
