<script setup lang="ts">
import ProductCard from '@/components/products/ProductCard.vue'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  productClick: [product: Product]
}>()

const handleProductClick = (product: Product) => {
  emit('productClick', product)
}
</script>

<template>
  <div class="df-product-grid">
    <div v-for="product in products" :key="product.id">
      <ProductCard :product="product" @click="handleProductClick" />
    </div>
  </div>
</template>

<style scoped>
.df-product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 48px 28px;
}
.df-product-grid > div {
  min-width: 0;
}
@media (max-width: 1050px) {
  .df-product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .df-product-grid {
    grid-template-columns: 1fr;
    gap: 38px;
  }
}
</style>
