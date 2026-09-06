<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
const { draft, reset } = useQuoteDraft()
</script>
<template>
  <div class="q-success" role="status">
    <div class="q-success-mark" aria-hidden="true">✓</div>
    <h3 class="q-title">견적 요청이 접수되었습니다</h3>
    <p class="q-help">담당자가 요청을 확인한 후 입력하신 이메일로 연락드립니다.</p>
    <p class="q-status">
      접수번호<br /><strong>{{ draft.reference }}</strong>
    </p>
    <QuoteButton variant="link" @click="reset">새 견적 요청 작성</QuoteButton>
  </div>
</template>
