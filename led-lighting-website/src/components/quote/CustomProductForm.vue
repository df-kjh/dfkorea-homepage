<script setup lang="ts">
import { reactive, ref } from 'vue'
import QuoteField from '@/components/common/quote/QuoteField.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import QuotePhotos from './QuotePhotos.vue'
import { normalizeSpecValues } from '@/composables/quote-draft'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { revealQuoteElement } from './quote-focus'
const heading = ref<HTMLElement | null>(null)
defineExpose({ reveal: () => revealQuoteElement(heading.value) })
const emit = defineEmits<{ done: [name: string]; cancel: [] }>()
const { add, uid } = useQuoteDraft()
const itemId = ref(uid())
const form = reactive({
  name: '',
  quantity: 1,
  power: '',
  colorTemp: '',
  dimensions: '',
  certifications: '',
  description: '',
})
function save() {
  if (
    add({
      clientId: itemId.value,
      kind: 'custom',
      name: form.name.trim(),
      quantity: Number(form.quantity),
      power: form.power ? Number(form.power) : undefined,
      colorTemp: form.colorTemp ? Number(form.colorTemp) : undefined,
      dimensions: form.dimensions.trim() || undefined,
      certifications: normalizeSpecValues(form.certifications),
      options: [],
      description: form.description.trim(),
      attachmentIds: [],
    })
  ) {
    const addedName = form.name.trim()
    itemId.value = uid()
    Object.assign(form, {
      name: '',
      quantity: 1,
      power: '',
      colorTemp: '',
      dimensions: '',
      certifications: '',
      description: '',
    })
    emit('done', addedName)
  }
}
</script>
<template>
  <div>
    <QuoteButton variant="link" @click="emit('cancel')">← 제품 검색으로 돌아가기</QuoteButton>
    <h3 ref="heading" tabindex="-1" class="q-title">원하는 사양을 알려주세요</h3>
    <p class="q-help">모르는 세부 사양은 비워두셔도 괜찮아요.</p>
    <div class="q-custom-layout">
      <section class="q-form-section">
        <QuoteField label="제품 종류 / 이름" required
          ><input v-model="form.name" maxlength="100" placeholder="예: 주차장용 LED 방습등"
        /></QuoteField>
        <div class="q-pair">
          <QuoteField label="소비전력(W)" optional
            ><input
              v-model="form.power"
              type="number"
              min="0.1"
              step="any"
              placeholder="예: 40" /></QuoteField
          ><QuoteField label="수량(개)" required
            ><input v-model.number="form.quantity" type="number" min="1" max="999999" step="1"
          /></QuoteField>
        </div>
        <div class="q-pair">
          <QuoteField label="색온도(K)" optional
            ><input
              v-model="form.colorTemp"
              type="number"
              min="1"
              placeholder="예: 5700" /></QuoteField
          ><QuoteField label="규격 / 크기" optional
            ><input v-model="form.dimensions" maxlength="200" placeholder="예: 길이 1200mm"
          /></QuoteField>
        </div>
        <QuoteField label="필요한 인증" optional hint="여러 개는 쉼표로 구분해 주세요."
          ><input v-model="form.certifications" maxlength="200" placeholder="예: KC, 고효율"
        /></QuoteField>
      </section>
      <section class="q-form-section">
        <QuoteField label="요구 사양 설명" required>
          <textarea
            v-model="form.description"
            rows="4"
            maxlength="2000"
            placeholder="설치 장소, 제품 형태, 방수 여부 등 필요한 조건을 적어 주세요."
          /></QuoteField
        ><QuotePhotos :item-id="itemId" /><QuoteButton
          class="q-wide q-gap"
          variant="primary"
          @click="save"
          >견적 목록에 담기</QuoteButton
        >
        <p class="q-help q-small">
          목록에 담아야 요청에 포함됩니다. 검색으로 돌아가도 작성 중인 내용은 유지됩니다.
        </p>
      </section>
    </div>
  </div>
</template>
