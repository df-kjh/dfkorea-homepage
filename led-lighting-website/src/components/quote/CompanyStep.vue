<script setup lang="ts">
import QuoteField from '@/components/common/quote/QuoteField.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import PrivacyDisclosure from './PrivacyDisclosure.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
const { draft, verify, isVerified, ensureSession } = useQuoteDraft()
function formatBusiness(event: Event) {
  const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 10)
  draft.company.businessNumber =
    value.length > 5
      ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`
      : value.length > 3
        ? `${value.slice(0, 3)}-${value.slice(3)}`
        : value
}
async function retrySession() {
  try {
    await ensureSession()
    draft.error = ''
  } catch {
    draft.error = '연결을 확인한 후 다시 시도해 주세요.'
  }
}
</script>
<template>
  <div>
    <h3 class="q-title">먼저 기업 정보를 알려주세요</h3>
    <p class="q-help">사업자등록증에 기재된 정보로 입력해 주세요.</p>
    <fieldset :disabled="draft.busy || !!draft.pendingSubmission">
      <QuoteField label="회사명(상호)" required
        ><input
          v-model="draft.company.companyName"
          autocomplete="organization"
          maxlength="100"
          placeholder="예: 주식회사 한빛전기"
          required
      /></QuoteField>
      <QuoteField label="사업자등록번호" required
        ><input
          :value="draft.company.businessNumber"
          inputmode="numeric"
          autocomplete="off"
          maxlength="12"
          placeholder="000-00-00000"
          required
          @input="formatBusiness"
      /></QuoteField>
      <div class="q-pair">
        <QuoteField label="대표자명" required
          ><input
            v-model="draft.company.representativeName"
            maxlength="100"
            autocomplete="off"
            placeholder="대표자 이름"
            required /></QuoteField
        ><QuoteField label="개업일자" required
          ><input
            v-model="draft.company.openingDate"
            type="date"
            :max="new Date().toISOString().slice(0, 10)"
            required
        /></QuoteField>
      </div>
      <PrivacyDisclosure />
      <label class="q-check"
        ><input v-model="draft.consent" :disabled="!draft.session" type="checkbox" />[필수] 견적
        상담을 위한 개인정보 수집·이용에 동의합니다.</label
      >
      <QuoteButton v-if="!draft.session" class="q-wide" @click="retrySession"
        >개인정보 안내 다시 불러오기</QuoteButton
      >
      <QuoteButton v-else class="q-wide" :disabled="draft.busy || !draft.consent" @click="verify">{{
        draft.busy
          ? '사업자 정보 확인 중…'
          : isVerified()
            ? '✓ 사업자 정보 확인 완료 · 다시 확인'
            : '사업자 정보 확인'
      }}</QuoteButton>
      <p v-if="isVerified()" role="status" class="q-status">
        상호와 등록정보가 확인되었습니다. 확인은 30분 동안 유효합니다.
      </p>
      <p class="q-help q-small">
        국세청 등록정보와 대조합니다. 신규 개업은 정보 반영이 늦을 수 있습니다.
      </p>
      <div class="q-pair">
        <QuoteField label="담당자명" required
          ><input
            v-model="draft.company.contactName"
            autocomplete="name"
            maxlength="50"
            required
            placeholder="회신받을 담당자" /></QuoteField
        ><QuoteField label="전화번호" optional
          ><input
            v-model="draft.company.phone"
            type="tel"
            autocomplete="tel"
            maxlength="25"
            placeholder="010-0000-0000"
        /></QuoteField>
      </div>
      <QuoteField label="이메일" required
        ><input
          v-model="draft.company.email"
          type="email"
          autocomplete="email"
          maxlength="254"
          required
          placeholder="name@company.com"
      /></QuoteField>
    </fieldset>
  </div>
</template>
