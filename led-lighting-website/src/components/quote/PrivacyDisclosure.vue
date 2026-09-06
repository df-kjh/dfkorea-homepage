<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
const { draft } = useQuoteDraft()
</script>
<template>
  <details class="q-privacy">
    <summary>개인정보 수집·이용 안내 전문</summary>
    <div v-if="draft.session">
      <p><strong>수집·이용 목적</strong><br />사업자 등록정보 확인, 견적 요청 접수 및 상담·회신</p>
      <p>
        <strong>필수 항목</strong><br />회사명, 사업자등록번호, 대표자명, 개업일자, 담당자명,
        이메일, 요청 제품 및 사양
      </p>
      <p>
        <strong>선택 항목</strong><br />전화번호, 사진, 추가 요청사항, 희망 납기일. 사진에 불필요한
        개인정보가 포함되지 않도록 확인해 주세요.
      </p>
      <p>
        <strong>견적 정보 및 첨부 기록 보유기간</strong><br />회사·담당자 정보, 요청 내용과 첨부
        기록은 접수일로부터 {{ draft.session.privacy.retentionDays }}일간 보관합니다.
      </p>
      <p>
        <strong>사진 파일 임시 보관기간</strong><br />사진 파일은 접수 전 최대 24시간, 접수 후 최대
        {{ Math.min(7, draft.session.privacy.retentionDays) }}일간 서버에 임시 보관합니다. 메일
        서비스가 발송을 수락하면 서버에 보관된 사진 파일을 즉시 삭제합니다.
      </p>
      <p>
        서버의 사진 파일을 삭제해도 수신 메일의 첨부 사본은 삭제되지 않으며, 수신함의 보유 정책을
        따릅니다. 백업 데이터의 삭제 시점은 별도 백업 보유 정책을 따릅니다.
      </p>
      <p>
        동의를 거부할 수 있으며, 거부하면 온라인 견적 접수가 제한됩니다. 사업자 확인은 등록정보의
        일치 여부를 확인하며 담당자의 재직·대표권·이메일 소유권 확인을 의미하지 않습니다.
      </p>
    </div>
    <p v-else>개인정보 안내를 불러오는 중입니다. 연결을 확인한 후 다시 시도해 주세요.</p>
  </details>
</template>
<style scoped>
.q-privacy {
  font-size: 12px;
  color: #586779;
  line-height: 1.7;
  margin: 10px 0;
}
.q-privacy summary {
  cursor: pointer;
  color: #0066ff;
  min-height: 32px;
  display: flex;
  align-items: center;
}
.q-privacy p {
  margin: 10px 0;
}
.q-privacy > div {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 9px;
}
</style>
