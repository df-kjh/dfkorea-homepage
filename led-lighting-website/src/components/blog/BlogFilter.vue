<template>
  <section class="blog-filter">
    <div class="container">
      <el-row :gutter="20" align="middle">
        <el-col :xs="24" :sm="12" :md="8">
          <el-select
            v-model="localCategory"
            placeholder="카테고리 선택"
            size="large"
            style="width: 100%"
            @change="handleCategoryChange"
          >
            <el-option
              v-for="category in categories"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8">
          <el-input
            v-model="localKeyword"
            placeholder="검색..."
            size="large"
            clearable
            @input="handleKeywordChange"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
      </el-row>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { Category } from '@/types'

interface Props {
  modelCategory: string
  modelKeyword: string
  categories: Category[]
}

interface Emits {
  (e: 'update:modelCategory', value: string): void
  (e: 'update:modelKeyword', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localCategory = ref(props.modelCategory)
const localKeyword = ref(props.modelKeyword)

watch(
  () => props.modelCategory,
  (newValue) => {
    localCategory.value = newValue
  },
)

watch(
  () => props.modelKeyword,
  (newValue) => {
    localKeyword.value = newValue
  },
)

const handleCategoryChange = (value: string) => {
  emit('update:modelCategory', value)
}

const handleKeywordChange = (value: string) => {
  emit('update:modelKeyword', value)
}
</script>

<style scoped>
.blog-filter {
  padding: 40px 20px;
  background-color: var(--toss-white);
  border-bottom: 1px solid #e5e8eb;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Responsive */
@media (max-width: 768px) {
  .blog-filter {
    padding: 30px 15px;
  }

  .blog-filter :deep(.el-col) {
    margin-bottom: 15px;
  }

  .blog-filter :deep(.el-col:last-child) {
    margin-bottom: 0;
  }
}
</style>
