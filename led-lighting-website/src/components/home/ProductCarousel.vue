<script setup lang="ts">
import { ref } from 'vue'
import ProductCard from '@/components/products/ProductCard.vue'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  title?: string
  subtitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Featured Collection',
  subtitle: '',
})

const emit = defineEmits<{
  productClick: [product: Product]
}>()

const scrollContainer = ref<HTMLElement | null>(null)

const canScrollLeft = ref(false)
const canScrollRight = ref(true)

const checkScroll = () => {
  if (!scrollContainer.value) return
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 10
}

const scroll = (direction: 'left' | 'right') => {
  if (!scrollContainer.value) return
  const scrollAmount = 400
  scrollContainer.value.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth',
  })
  setTimeout(checkScroll, 300)
}

const handleProductClick = (product: Product) => {
  emit('productClick', product)
}
</script>

<template>
  <section class="py-32 px-6 overflow-hidden bg-gray-50">
    <div class="max-w-screen-xl mx-auto">
      <!-- Header -->
      <div class="flex items-end justify-between mb-12">
        <div>
          <p v-if="subtitle" class="text-primary text-xs uppercase tracking-widest font-bold mb-3">
            {{ subtitle }}
          </p>
          <h2 class="text-gray-900 text-4xl md:text-5xl font-bold">{{ title }}</h2>
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
          <button
            @click="scroll('left')"
            :disabled="!canScrollLeft"
            class="size-12 rounded-full bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-900 transition-all shadow-sm"
          >
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <button
            @click="scroll('right')"
            :disabled="!canScrollRight"
            class="size-12 rounded-full bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-900 transition-all shadow-sm"
          >
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <!-- Carousel -->
      <div
        ref="scrollContainer"
        @scroll="checkScroll"
        class="flex gap-6 overflow-x-auto scrollbar-hide p-4"
        style="scroll-snap-type: x mandatory"
      >
        <article
          v-for="product in products"
          :key="product.id"
          class="flex-shrink-0 w-80"
          style="scroll-snap-align: start"
        >
          <ProductCard :product="product" @click="handleProductClick" />
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
