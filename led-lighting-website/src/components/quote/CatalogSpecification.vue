<script setup lang="ts">
import { reactive } from 'vue'
import type { Product } from '@/types'
import type { QuoteItem } from '@/types/quote'
import QuoteField from '@/components/common/quote/QuoteField.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ added: []; cancel: [] }>()
const { add, uid } = useQuoteDraft()
const selection = reactive({
  power: '',
  colorTemp: '',
  options: [] as string[],
  certifications: [] as string[],
  quantity: 1,
})
function save() {
  const item: QuoteItem = {
    clientId: uid(),
    kind: 'catalog',
    productId: props.product.id,
    name: props.product.name,
    modelName: props.product.modelName,
    quantity: Number(selection.quantity),
    power: selection.power ? Number(selection.power) : undefined,
    colorTemp: selection.colorTemp ? Number(selection.colorTemp) : undefined,
    options: [...selection.options],
    certifications: [...selection.certifications],
    attachmentIds: [],
  }
  if (add(item)) emit('added')
}
</script>
<template>
  <div class="q-specification">
    <h4 class="q-subtitle">{{ product.name }} · 희망 사양</h4>
    <p class="q-help">확정하지 않은 항목은 상담 후 결정할 수 있어요.</p>
    <div class="q-pair">
      <QuoteField label="소비전력"
        ><select v-model="selection.power">
          <option value="">상담 후 결정</option>
          <option v-for="power in product.power || []" :key="power" :value="String(power)">
            {{ power }}W
          </option>
        </select></QuoteField
      ><QuoteField label="색온도"
        ><select v-model="selection.colorTemp">
          <option value="">상담 후 결정</option>
          <option v-for="temp in product.colorTemp || []" :key="temp" :value="String(temp)">
            {{ temp }}K
          </option>
        </select></QuoteField
      >
    </div>
    <fieldset v-if="product.options?.length" class="q-choice-group">
      <legend>희망 옵션 · 미선택 시 상담 후 결정</legend>
      <label v-for="option in product.options" :key="option" class="q-check"
        ><input v-model="selection.options" type="checkbox" :value="option" />{{ option }}</label
      >
    </fieldset>
    <fieldset v-if="product.certifications?.length" class="q-choice-group">
      <legend>필요한 인증 · 선택</legend>
      <label v-for="certification in product.certifications" :key="certification" class="q-check"
        ><input v-model="selection.certifications" type="checkbox" :value="certification" />{{
          certification
        }}</label
      >
    </fieldset>
    <QuoteField label="수량(개)" required
      ><input
        v-model.number="selection.quantity"
        type="number"
        min="1"
        max="999999"
        step="1"
        inputmode="numeric"
    /></QuoteField>
    <p class="q-help">
      표시된 인증은 제품의 등록 정보입니다. 선택한 사양·인증 조합의 공급 가능 여부는 담당자가
      검토합니다.
    </p>
    <div class="q-actions">
      <QuoteButton @click="emit('cancel')">취소</QuoteButton
      ><QuoteButton variant="primary" @click="save">견적 목록에 담기</QuoteButton>
    </div>
  </div>
</template>
