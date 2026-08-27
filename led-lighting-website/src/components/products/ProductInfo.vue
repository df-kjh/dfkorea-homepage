<script setup lang="ts">
import ProductBadge from '@/components/common/ProductBadge.vue'

interface SpecItem {
  icon: string
  label: string
  value: string
}

interface Props {
  series?: string
  productName: string
  price?: number
  specs: SpecItem[]
  description?: string
  isNew?: boolean
  isFeatured?: boolean
}

withDefaults(defineProps<Props>(), {
  series: 'Smart Series',
  price: 0,
  description: 'Complimentary shipping on orders over $500. Available for immediate dispatch.',
  isNew: false,
  isFeatured: false,
})

defineEmits<{
  addToCart: []
  addToWishlist: []
}>()

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price)
}
</script>

<template>
  <div class="lg:col-span-5 lg:sticky top-[100px]">
    <div class="max-w-md">
      <!-- Badges -->
      <div v-if="isNew || isFeatured" class="flex gap-2 mb-4">
        <ProductBadge v-if="isNew" type="new" />
        <ProductBadge v-if="isFeatured" type="main" />
      </div>

      <!-- Series Badge -->
      <span class="text-primary font-bold text-sm tracking-widest uppercase mb-4 block">
        {{ series }}
      </span>

      <!-- Product Name -->
      <h1
        class="text-text-main text-5xl font-bold tracking-tight mb-4 leading-tight"
        v-html="productName"
      ></h1>

      <!-- Price -->
      <p v-if="price > 0" class="text-text-main text-3xl font-bold mb-10">
        {{ formatPrice(price) }}
      </p>

      <!-- Specs Grid -->
      <div class="grid grid-cols-2 gap-4 mb-10">
        <div
          v-for="(spec, index) in specs"
          :key="index"
          class="bg-surface p-5 rounded-2xl border border-divider"
        >
          <span class="material-symbols-outlined text-primary mb-2">{{ spec.icon }}</span>
          <p class="text-[10px] text-text-desc font-bold uppercase tracking-wider">
            {{ spec.label }}
          </p>
          <p class="text-text-main font-bold text-sm">{{ spec.value }}</p>
        </div>
      </div>

      <!-- TODO 제품 구매 기능 추가 Action Buttons -->
      <!-- <div class="flex flex-col gap-4">
        <button
          @click="$emit('addToCart')"
          class="w-full bg-primary text-white font-bold h-16 rounded-2xl text-xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all transform hover:-translate-y-1"
        >
          Add to Cart
        </button>
        <button
          @click="$emit('addToWishlist')"
          class="w-full bg-white border border-gray-200 text-text-main font-bold h-16 rounded-2xl text-lg hover:bg-surface transition-colors flex items-center justify-center gap-2"
        >
          <span class="material-symbols-outlined">favorite</span>
          Save to Wishlist
        </button>
      </div> -->
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
