<script setup lang="ts">
import type { Product } from '@/types'
defineProps<{ product: Product; preview: boolean }>()
</script>

<template>
  <nav v-if="product.variantGroup" class="detail-variants" aria-label="제품 구성 선택">
    <p class="detail-variants__title">{{ product.variantGroup.name }} · 구성 선택</p>
    <ul class="detail-variants__choices">
      <li v-for="variant in product.variantGroup.variants" :key="variant.product.id">
        <span
          v-if="preview"
          class="detail-variants__choice"
          :aria-current="variant.product.id === product.id ? 'page' : undefined"
        >
          {{ variant.label }}
        </span>
        <!-- Each original SKU URL owns its photo/specifications and clears the
             previous SKU's image query without adding an artificial history step. -->
        <NuxtLink
          v-else
          :to="`/products/${variant.product.id}`"
          class="detail-variants__choice"
          :aria-current="variant.product.id === product.id ? 'page' : undefined"
        >
          {{ variant.label
          }}<span v-if="variant.product.id === product.id" class="detail-variants__selected"
            >선택됨</span
          >
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.detail-variants {
  margin-top: 28px;
}
.detail-variants__title {
  color: #e6d7bb;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.6;
}
.detail-variants__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.detail-variants__choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid #afa18c;
  border-radius: 2px;
  color: #fff;
  font-size: 16px;
  line-height: 1.5;
}
.detail-variants__choice[aria-current='page'] {
  background: #e6d7bb;
  border-color: #e6d7bb;
  color: #29251e;
  font-weight: 600;
}
.detail-variants__choice:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
}
.detail-variants__selected {
  font-size: 13px;
}
</style>
