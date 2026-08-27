<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import ProductBadge from '@/components/common/ProductBadge.vue'
import type { Product } from '@/types'
import { getFirstImageUrl } from '@/utils/image'
import { formatWithUnit } from '@/constants/units'

interface Props {
  product: Product
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [product: Product]
}>()

const handleClick = () => {
  emit('click', props.product)
}

const getCertificationIcons = (product: Product): string[] => {
  const icons: string[] = []

  // certifications 배열 사용
  if (product.certifications && product.certifications.length > 0) {
    // KS 인증이 있으면 verified 아이콘
    if (product.certifications.includes('KS')) {
      icons.push('/images/certifications/ks.png')
    }
    // 고효율 인증이 있으면 energy 아이콘
    if (product.certifications.includes('고효율')) {
      icons.push('/images/certifications/high-efficency.png')
    }
    // 친환경 인증이 있으면 eco-friendly 아이콘
    if(product.certifications.includes('친환경')) {
      icons.push('/images/certifications/eco-friendly.webp')
    }
  }

  return icons
}
</script>

<template>
  <BaseCard :clickable="true" :hoverable="true" :body-style="{ padding: '0' }" @click="handleClick">
    <!-- Product Image -->
    <div
      class="aspect-[4/3] rounded-t-3xl overflow-hidden bg-white border-b border-divider relative"
    >
      <img
        :src="getFirstImageUrl(product.images)"
        :alt="product.name"
        class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <!-- Badges -->
      <div class="absolute top-3 right-3 flex gap-2">
        <ProductBadge v-if="product.isNew" type="new" />
        <ProductBadge v-if="product.isFeatured" type="main" />
      </div>
    </div>

    <!-- Product Info -->
    <div class="flex flex-col gap-1 p-4">
      <h3 class="text-lg font-bold text-text-main group-hover:text-primary transition-colors">{{ product.name }}</h3>
      <p class="text-sm text-text-desc font-medium overflow-hidden whitespace-nowrap text-ellipsis">
        {{ formatWithUnit(product.power, 'power') }} /
        {{ formatWithUnit(product.colorTemp, 'colorTemp') }} /
        {{ formatWithUnit(product.lifespan, 'lifespan') }}
      </p>

      <!-- Certification Icons -->
      <div class="flex gap-1 mt-2">
        <span v-for="icon in getCertificationIcons(product)" :key="icon" class="w-6 h-6">
          <img
            :src="icon"
            :alt="product.name + ' certification icon'"
            class="w-full h-full object-contain"
            loading="lazy"
          />
        </span>
      </div>
    </div>
  </BaseCard>
</template>
