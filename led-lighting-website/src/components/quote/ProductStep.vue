<script setup lang="ts">
import { nextTick, ref } from 'vue'
import ProductPicker from './ProductPicker.vue'
import CustomProductForm from './CustomProductForm.vue'
import QuoteItemList from './QuoteItemList.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { revealQuoteElement } from './quote-focus'
const { draft } = useQuoteDraft()
const custom = ref(false)
const picker = ref<InstanceType<typeof ProductPicker> | null>(null)
const customForm = ref<InstanceType<typeof CustomProductForm> | null>(null)
const summary = ref<HTMLElement | null>(null)
let customOrigin: HTMLElement | null = null
async function startCustom(event: MouseEvent) {
  customOrigin = event.currentTarget as HTMLElement
  custom.value = true
  await nextTick()
  customForm.value?.reveal()
}
async function cancelCustom() {
  custom.value = false
  await nextTick()
  revealQuoteElement(customOrigin)
}
async function onAdded() {
  custom.value = false
  await nextTick()
  revealQuoteElement(summary.value)
}
defineExpose({ isEditing: () => custom.value || !!picker.value?.isEditing() })
</script>
<template>
  <fieldset :disabled="draft.busy || !!draft.pendingSubmission">
    <ProductPicker ref="picker" v-show="!custom" @custom="startCustom" @added="onAdded">
      <div
        ref="summary"
        tabindex="-1"
        role="region"
        aria-label="담은 제품 요약"
        class="q-item-summary"
      >
        <QuoteItemList />
      </div>
    </ProductPicker>
    <CustomProductForm ref="customForm" v-show="custom" @done="onAdded" @cancel="cancelCustom" />
  </fieldset>
</template>
