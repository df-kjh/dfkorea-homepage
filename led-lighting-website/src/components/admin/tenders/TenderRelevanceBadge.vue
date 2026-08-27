<script setup lang="ts">
import type { TenderRelevance } from '@/types'

interface Props {
  relevance: TenderRelevance
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  compact: false,
})

const relevanceMeta = {
  DIRECT: { icon: 'lightbulb', label: '직접 관련', symbol: '💡' },
  POTENTIAL: { icon: 'bolt', label: '잠재 관련', symbol: '⚡' },
} as const
</script>

<template>
  <span
    :class="[
      'tender-relevance-badge',
      `tender-relevance-badge--${relevance.toLowerCase()}`,
      { 'tender-relevance-badge--compact': compact },
    ]"
    :aria-label="`${relevanceMeta[relevance].symbol} ${relevanceMeta[relevance].label}`"
  >
    <span class="material-symbols-outlined tender-relevance-badge__icon" aria-hidden="true">
      {{ relevanceMeta[relevance].icon }}
    </span>
    <span v-if="!compact">{{ relevanceMeta[relevance].label }}</span>
  </span>
</template>

<style scoped>
.tender-relevance-badge {
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

.tender-relevance-badge--direct {
  background: #e2f7fb;
  color: #0f8198;
}

.tender-relevance-badge--potential {
  background: #fff6d9;
  color: #9a6700;
}

.tender-relevance-badge--compact {
  padding: 0.25rem;
}

.tender-relevance-badge__icon {
  font-size: 1rem;
}
</style>
