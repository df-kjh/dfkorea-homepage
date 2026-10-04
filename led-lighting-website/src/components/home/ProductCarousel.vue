<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import ProductCard from '@/components/products/ProductCard.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  title?: string
  subtitle?: string
}
const props = withDefaults(defineProps<Props>(), {
  title: '주요 제품',
  subtitle: 'SELECTED PRODUCTS',
})
const emit = defineEmits<{ productClick: [product: Product] }>()
const scrollContainer = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let observer: ResizeObserver | null = null
let disposed = false

function checkScroll() {
  if (!scrollContainer.value || disposed) return
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  canScrollLeft.value = scrollLeft > 2
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 2
}
function scroll(direction: 'left' | 'right') {
  if (!scrollContainer.value) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scrollContainer.value.scrollBy({
    left: (direction === 'left' ? -1 : 1) * scrollContainer.value.clientWidth * 0.8,
    behavior: reduced ? 'auto' : 'smooth',
  })
}
onMounted(() => {
  checkScroll()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(checkScroll)
    if (scrollContainer.value) observer.observe(scrollContainer.value)
  }
})
watch(
  () => props.products,
  async () => {
    await nextTick()
    checkScroll()
  },
)
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section class="home-products" aria-labelledby="home-products-title">
    <div class="public-container">
      <div class="products-heading">
        <div>
          <p v-if="subtitle" class="public-eyebrow">{{ subtitle }}</p>
          <h2 id="home-products-title">{{ title }}<span aria-hidden="true">.</span></h2>
        </div>
        <PublicAction to="/products" variant="text"
          >전체 제품 보기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
      <div ref="scrollContainer" class="products-track" @scroll.passive="checkScroll">
        <article v-for="product in products" :key="product.id" class="product-slide">
          <ProductCard :product="product" @click="emit('productClick', $event)" />
        </article>
      </div>
      <div class="products-bottom">
        <p>공간에 필요한 빛, 제품별로 만나보세요.</p>
        <div class="products-navigation">
          <PublicAction
            variant="outline"
            class="products-arrow"
            aria-label="이전 제품 보기"
            :disabled="!canScrollLeft"
            @click="scroll('left')"
            ><span aria-hidden="true">←</span></PublicAction
          >
          <PublicAction
            variant="outline"
            class="products-arrow"
            aria-label="다음 제품 보기"
            :disabled="!canScrollRight"
            @click="scroll('right')"
            ><span aria-hidden="true">→</span></PublicAction
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-products {
  padding: 110px 0 120px;
  background: #e9e5da;
}
.products-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 50px;
}
.products-heading h2 {
  font-size: clamp(38px, 4.8vw, 64px);
  font-weight: 400;
  letter-spacing: -0.065em;
  line-height: 1.25;
  margin-top: 18px;
}
.products-heading h2 span {
  color: #a6885a;
}
.products-track {
  display: flex;
  gap: 28px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  scrollbar-color: #9d9678 transparent;
  padding: 8px 4px 24px;
  margin-inline: -4px;
}
.product-slide {
  min-width: 0;
  flex: 0 0 calc((100% - 56px) / 3);
  scroll-snap-align: start;
}
.products-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-top: 34px;
  padding-top: 26px;
  border-top: 1px solid #b8b39e70;
}
.products-bottom p {
  font-size: 12px;
  line-height: 1.8;
  color: #787665;
}
.products-navigation {
  display: flex;
  gap: 10px;
}
.products-navigation :deep(.products-arrow) {
  border-color: #b6b09b;
  min-width: 46px;
  min-height: 46px;
  width: 46px;
  height: 46px;
  padding: 0;
  justify-content: center;
}
@media (max-width: 900px) {
  .product-slide {
    flex-basis: calc((100% - 28px) / 2);
  }
}
@media (max-width: 600px) {
  .home-products {
    padding: 74px 0 80px;
  }
  .products-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 22px;
    margin-bottom: 32px;
  }
  .products-track {
    gap: 18px;
  }
  .product-slide {
    flex-basis: 100%;
  }
  .products-bottom {
    margin-top: 22px;
    gap: 16px;
  }
  .products-bottom p {
    max-width: 145px;
  }
}
</style>
