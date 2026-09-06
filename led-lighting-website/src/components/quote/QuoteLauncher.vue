<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import QuotePanel from './QuotePanel.vue'
import './quote.css'
withDefaults(defineProps<{ backToTopVisible?: boolean }>(), { backToTopVisible: false })
const { draft, open, close } = useQuoteDraft()
</script>
<template>
  <Teleport to="body"
    ><div id="quote-widget" :class="{ 'q-widget--with-back-top': backToTopVisible }">
      <button
        id="quote-launcher"
        class="q-launcher"
        :class="{ 'q-launcher--open': draft.open }"
        :aria-expanded="draft.open"
        aria-label="온라인 견적"
        aria-controls="quote-panel"
        aria-haspopup="dialog"
        @click="draft.open ? close() : open($event)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">request_quote</span
        ><span class="q-launcher-label">온라인 견적</span
        ><span v-if="draft.items.length && !draft.reference" class="q-count">{{
          draft.items.length
        }}</span></button
      ><QuotePanel /></div
  ></Teleport>
</template>
