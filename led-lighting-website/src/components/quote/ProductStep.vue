<script setup lang="ts">
import { nextTick, ref } from 'vue'
import ProductPicker from './ProductPicker.vue'
import CustomProductForm from './CustomProductForm.vue'
import QuoteItemList from './QuoteItemList.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { revealQuoteElement } from './quote-focus'
const { draft } = useQuoteDraft()
const custom = ref(false)
const picker = ref<InstanceType<typeof ProductPicker> | null>(null)
const customForm = ref<InstanceType<typeof CustomProductForm> | null>(null)
const summary = ref<HTMLElement | null>(null)
const added = ref('')
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
async function onAdded(name: string) {
  custom.value = false
  added.value = `${name} 제품을 담았습니다. 담은 사양과 수량을 확인한 뒤 제품을 더 선택하거나 아래 ‘요청 확인하기’로 진행해 주세요.`
  await nextTick()
  revealQuoteElement(summary.value)
}
defineExpose({ isEditing: () => custom.value || !!picker.value?.isEditing() })
</script>
<template>
  <fieldset :disabled="draft.busy || !!draft.pendingSubmission">
    <ProductPicker ref="picker" v-show="!custom" @custom="startCustom" @added="onAdded">
      <div ref="summary" tabindex="-1" class="q-item-summary">
        <p v-if="added" class="q-status" role="status">{{ added }}</p>
        <QuoteItemList />
        <QuoteButton v-if="added" class="q-wide" @click="picker?.focusSearch()"
          >제품 더 선택하기</QuoteButton
        >
      </div>
    </ProductPicker>
    <CustomProductForm ref="customForm" v-show="custom" @done="onAdded" @cancel="cancelCustom" />
  </fieldset>
</template>
