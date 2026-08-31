<script setup lang="ts">
import type { TenderOpportunityType } from '@/types'

interface Props {
  opportunityType: TenderOpportunityType
}

defineProps<Props>()

const opportunityMeta = {
  GOODS_SUPPLY: { icon: 'inventory_2', label: '물품 납품', symbol: '📦' },
  MAS: { icon: 'description', label: 'MAS', symbol: '🧾' },
} as const
</script>

<template>
  <span
    role="img"
    :class="['tender-opportunity-badge', `tender-opportunity-badge--${opportunityType.toLowerCase()}`]"
    :aria-label="`${opportunityMeta[opportunityType].symbol} ${opportunityMeta[opportunityType].label}`"
  >
    <span class="material-symbols-outlined tender-opportunity-badge__icon" aria-hidden="true">
      {{ opportunityMeta[opportunityType].icon }}
    </span>
    <span>{{ opportunityMeta[opportunityType].label }}</span>
  </span>
</template>

<style scoped>
.tender-opportunity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 9999px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.tender-opportunity-badge--goods_supply {
  background: #e2f7f5;
  color: #0f766e;
}

.tender-opportunity-badge--mas {
  background: #eef2ff;
  color: #4338ca;
}

.tender-opportunity-badge__icon {
  font-size: 1rem;
}
</style>
