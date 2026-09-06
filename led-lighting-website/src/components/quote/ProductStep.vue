<script setup lang="ts">
import { ref } from 'vue'
import ProductPicker from './ProductPicker.vue'
import CustomProductForm from './CustomProductForm.vue'
import QuoteItemList from './QuoteItemList.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
const { draft } = useQuoteDraft()
const custom = ref(false)
defineExpose({ isEditing: () => custom.value })
</script>
<template>
  <fieldset :disabled="draft.busy || !!draft.pendingSubmission">
    <ProductPicker v-show="!custom" @custom="custom = true" /><CustomProductForm
      v-show="custom"
      @done="custom = false"
      @cancel="custom = false"
    /><QuoteItemList v-show="!custom" />
  </fieldset>
</template>
