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
  description: '',
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
  <div class="df-product-info">
    <div v-if="isNew || isFeatured" class="df-product-badges">
      <ProductBadge v-if="isNew" type="new" /><ProductBadge v-if="isFeatured" type="main" />
    </div>
    <p class="df-product-series">{{ series }}</p>
    <h1>{{ productName }}</h1>
    <p v-if="price > 0" class="df-product-price">{{ formatPrice(price) }}</p>
    <dl class="grid df-product-summary">
      <div v-for="spec in specs" :key="spec.label">
        <dt>{{ spec.label }}</dt>
        <dd>{{ spec.value }}</dd>
      </div>
    </dl>
    <div v-if="$slots.actions" class="product-info-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.df-product-info {
  min-width: 0;
  position: sticky;
  top: 112px;
  align-self: start;
}
.df-product-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
}
.df-product-series {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: #887b64;
  line-height: 1.8;
  overflow-wrap: anywhere;
  margin-bottom: 22px;
}
.df-product-info h1 {
  font-size: clamp(34px, 3.2vw, 52px);
  font-weight: 500;
  line-height: 1.27;
  letter-spacing: -0.06em;
  overflow-wrap: anywhere;
}
.df-product-price {
  margin-top: 24px;
  font-size: 28px;
}
.df-product-summary {
  display: block;
  margin: 34px 0 30px;
  border-top: 1px solid #d7cdbb;
}
.df-product-summary > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 20px;
  padding: 15px 0;
  border-bottom: 1px solid #ddd3c2;
}
.df-product-summary dt {
  font-size: 11px;
  color: #91816a;
  line-height: 1.8;
}
.df-product-summary dd {
  margin: 0;
  font-size: 13px;
  color: #464034;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.product-info-actions {
  margin-top: 12px;
}
@media (max-width: 800px) {
  .df-product-info {
    position: static;
  }
  .df-product-info h1 {
    font-size: 35px;
  }
  .df-product-summary {
    margin-top: 27px;
  }
}
</style>
