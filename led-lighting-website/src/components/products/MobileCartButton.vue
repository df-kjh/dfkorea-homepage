<script setup lang="ts">
interface Props {
  productName: string
  price: number
}

defineProps<Props>()

defineEmits<{
  addToCart: []
}>()

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price)
}
</script>

<template>
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
    <div
      class="bg-white/90 backdrop-blur-lg px-6 py-4 rounded-3xl border border-gray-100 shadow-2xl flex items-center gap-6"
    >
      <div>
        <p class="text-[10px] text-text-desc font-bold uppercase">{{ productName }}</p>
        <p class="text-text-main font-bold">{{ formatPrice(price) }}</p>
      </div>
      <button
        @click="$emit('addToCart')"
        class="bg-primary text-white font-bold px-8 h-12 rounded-2xl shadow-lg shadow-primary/20"
      >
        Add to Cart
      </button>
    </div>
  </div>
</template>
