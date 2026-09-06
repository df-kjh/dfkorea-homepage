<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import QuoteField from '@/components/common/quote/QuoteField.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import QuoteItemList from './QuoteItemList.vue'
import PrivacyDisclosure from './PrivacyDisclosure.vue'
const { draft } = useQuoteDraft()
</script>
<template>
  <div>
    <h3 class="q-title">요청 내용을 확인해 주세요</h3>
    <p class="q-help">담당자가 사양과 수량을 확인해 견적을 안내드립니다.</p>
    <fieldset :disabled="draft.busy || !!draft.pendingSubmission">
      <section class="q-summary">
        <div class="q-row">
          <h4 class="q-subtitle">기업 정보</h4>
          <QuoteButton variant="link" @click="draft.step = 1">수정</QuoteButton>
        </div>
        <p>
          <strong>{{ draft.company.companyName }}</strong
          ><br />{{ draft.company.businessNumber }}<br />대표자
          {{ draft.company.representativeName }} · 개업 {{ draft.company.openingDate }}<br />{{
            draft.company.contactName
          }}
          · {{ draft.company.email }}<br v-if="draft.company.phone" />{{ draft.company.phone }}
        </p>
      </section>
      <div class="q-row q-gap">
        <h4 class="q-subtitle">요청 제품</h4>
        <QuoteButton variant="link" @click="draft.step = 2">수정</QuoteButton>
      </div>
      <QuoteItemList readonly /><QuoteField label="추가 요청사항" optional>
        <textarea
          v-model="draft.notes"
          rows="3"
          maxlength="2000"
          placeholder="납품 장소, 견적 시 참고할 내용을 적어 주세요."
        /></QuoteField
      ><QuoteField label="희망 납기일" optional
        ><input v-model="draft.requestedDeliveryDate" type="date"
      /></QuoteField>
    </fieldset>
    <div class="q-status">
      {{
        draft.consent
          ? '✓ 개인정보 수집·이용 동의 완료'
          : '기업 정보에서 필수 동의를 확인해 주세요.'
      }}
    </div>
    <PrivacyDisclosure />
    <p v-if="draft.pendingSubmission && !draft.busy" class="q-help">
      접수 결과를 확인 중입니다. 중복 요청을 막기 위해 작성 내용을 보관했습니다. 아래 버튼으로 같은
      요청의 결과를 다시 확인해 주세요.
    </p>
  </div>
</template>
