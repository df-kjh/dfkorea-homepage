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
  <div class="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-12">
    <div v-for="(product, index) in products" :key="product.id">
      <ProductCard :product="product" @click="handleProductClick" />

      <!-- Divider (hidden on last item on mobile) -->
      <hr class="mt-8 border-divider" :class="{ 'md:hidden': index === products.length - 1 }" />
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
