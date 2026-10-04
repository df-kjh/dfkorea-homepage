<script setup lang="ts">
import ProductBadge from '@/components/common/ProductBadge.vue'
import type { Product } from '@/types'
import { getFirstImageUrl } from '@/utils/image'
import { productCardSummary, productCertificationLabels } from './presentation'
const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ click: [product: Product] }>()
function handleClick(event: MouseEvent) {
  // Parent-owned selection preserves quote/home/list navigation on an ordinary
  // click. Modified activation belongs to the real anchor (new tab/window).
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  emit('click', props.product)
}
</script>
<template>
  <NuxtLink v-slot="{ href }" custom :to="`/products/${product.id}`">
    <a :href="href ?? `/products/${product.id}`" class="df-product-card" @click="handleClick">
      <div class="df-product-card__image">
        <img :src="getFirstImageUrl(product.images)" :alt="product.name" loading="lazy" />
        <div class="df-product-card__badges">
          <ProductBadge v-if="product.isNew" type="new" /><ProductBadge
            v-if="product.isFeatured"
            type="main"
          />
        </div>
        <span class="df-product-card__arrow" aria-hidden="true">↗</span>
      </div>
      <div class="df-product-card__copy">
        <p class="df-product-card__category">{{ product.category }}</p>
        <h3>{{ product.name }}</h3>
        <p class="df-product-card__model">{{ product.modelName }}</p>
        <p class="df-product-card__spec">{{ productCardSummary(product) }}</p>
        <p v-if="productCertificationLabels(product).length" class="df-product-card__certs">
          인증 표기 · {{ productCertificationLabels(product).join(' / ') }}
        </p>
      </div>
    </a>
  </NuxtLink>
</template>
<style scoped>
.df-product-card {
  display: block;
  color: #25251f;
  min-width: 0;
}
.df-product-card__image {
  position: relative;
  aspect-ratio: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  overflow: hidden;
}
.df-product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 24px;
  transition: transform 0.35s;
}
.df-product-card:hover img {
  transform: scale(1.035);
}
.df-product-card__badges {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  gap: 6px;
}
.df-product-card__arrow {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid #ddd4c4;
  border-radius: 50%;
  font-size: 19px;
}
.df-product-card__copy {
  padding-top: 22px;
}
.df-product-card__category {
  font-size: 11px;
  color: #8a7d6d;
  margin-bottom: 10px;
}
.df-product-card h3 {
  font-size: 23px;
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.df-product-card__model {
  font-size: 11px;
  color: #898276;
  margin-top: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.df-product-card__spec {
  font-size: 12px;
  color: #686156;
  margin-top: 8px;
  line-height: 1.8;
}
.df-product-card__certs {
  font-size: 10px;
  color: #8b816e;
  margin-top: 8px;
  line-height: 1.7;
}
.df-product-card:focus-visible {
  outline: 2px solid #9b793f;
  outline-offset: 6px;
}
@media (max-width: 640px) {
  .df-product-card h3 {
    font-size: 22px;
  }
  .df-product-card__image {
    aspect-ratio: 1.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .df-product-card__image img {
    transition: none;
  }
}
</style>
