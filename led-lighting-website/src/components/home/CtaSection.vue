<script setup lang="ts">
import { ref, computed, useId, onBeforeUnmount } from 'vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { useToast } from '@/composables/useToast'

interface Props {
  title?: string
  description?: string
  companyEmail?: string
  companyPhone?: string
}
const props = withDefaults(defineProps<Props>(), {
  title: '다음 공간의 빛을, 함께.',
  description: '필요한 제품과 구성부터 차근히 살펴봅니다.\nDF KOREA에 조명 상담을 남겨주세요.',
  companyEmail: 'kjukym@dfkorealed.com',
  companyPhone: '032-528-2953',
})
const quote = useQuoteDraft()
const toast = useToast()
const contactDialog = ref<HTMLDialogElement | null>(null)
const dialogTitle = `home-contact-${useId()}`
let opener: HTMLElement | null = null
let disposed = false
const isMobile = computed(
  () =>
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
)
function openContact(event: Event) {
  opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  contactDialog.value?.showModal()
}
function closeContact() {
  contactDialog.value?.close()
  if (opener?.isConnected) opener.focus({ preventScroll: true })
}
function handleQuoteContact() {
  // Closing the chooser restores the visible CTA before the existing quote
  // controller captures its opener, so quote-close never focuses a hidden option.
  closeContact()
  quote.open()
}
function backdrop(event: MouseEvent) {
  const dialog = contactDialog.value
  if (!dialog || event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    closeContact()
}
async function copyContact(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    if (disposed) return
    toast.success(`${label}가 클립보드에 복사되었습니다`)
    closeContact()
  } catch (error) {
    if (disposed) return
    console.error(`Failed to copy ${label}:`, error)
    toast.error(`${label} 복사에 실패했습니다`)
  }
}
function handleEmailContact() {
  if (isMobile.value)
    window.location.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(props.companyEmail)}`
  else void copyContact(props.companyEmail, '이메일 주소')
}
function handlePhoneContact() {
  if (isMobile.value) window.location.href = `tel:${props.companyPhone.replace(/-/g, '')}`
  else void copyContact(props.companyPhone, '전화번호')
}
onBeforeUnmount(() => {
  disposed = true
  contactDialog.value?.close()
})
</script>

<template>
  <section class="home-contact">
    <div class="public-container contact-layout">
      <p class="contact-eyebrow">LET'S MAKE LIGHT TOGETHER</p>
      <div class="contact-copy">
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
        <PublicAction data-contact-open variant="light" @click="openContact"
          >상담 문의하기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
    </div>
    <!-- Native modal keeps tab focus and Escape semantics without a second global overlay controller. -->
    <dialog
      ref="contactDialog"
      class="contact-dialog"
      :aria-labelledby="dialogTitle"
      @cancel.prevent="closeContact"
      @click="backdrop"
    >
      <div class="contact-dialog-heading">
        <p>CONTACT DF KOREA</p>
        <h3 :id="dialogTitle">상담 문의 방법 선택</h3>
        <button
          type="button"
          class="contact-close"
          aria-label="문의 방법 창 닫기"
          @click="closeContact"
        >
          ×
        </button>
      </div>
      <div class="contact-options">
        <PublicAction
          data-contact-quote
          class="contact-option contact-option-quote"
          variant="dark"
          @click="handleQuoteContact"
          ><span
            ><strong>온라인 견적</strong><small>제품과 수량을 담아 견적을 요청하세요</small></span
          ><span aria-hidden="true">↗</span></PublicAction
        >
        <PublicAction class="contact-option" variant="outline" @click="handleEmailContact"
          ><span
            ><strong>이메일 문의</strong><small>{{ companyEmail }}</small
            ><em>{{ isMobile ? '지메일로 이동' : '이메일 복사' }}</em></span
          ><span aria-hidden="true">↗</span></PublicAction
        >
        <PublicAction class="contact-option" variant="outline" @click="handlePhoneContact"
          ><span
            ><strong>전화 문의</strong><small>{{ companyPhone }}</small
            ><em>{{ isMobile ? '전화 앱으로 이동' : '전화번호 복사' }}</em></span
          ><span aria-hidden="true">↗</span></PublicAction
        >
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.home-contact {
  position: relative;
  overflow: hidden;
  padding: 120px 0;
  background: #10120d;
  color: #f0ece3;
}
.home-contact::before {
  content: '';
  position: absolute;
  width: 750px;
  height: 750px;
  border: 1px solid #a3865833;
  border-radius: 50%;
  top: -410px;
  right: -270px;
  box-shadow:
    0 0 0 55px #a3865807,
    0 0 0 110px #a3865805;
  pointer-events: none;
}
.contact-layout {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 3fr 1fr;
  gap: 36px;
  align-items: start;
}
.contact-eyebrow {
  font:
    9px/1.8 Arial,
    sans-serif;
  letter-spacing: 0.14em;
  color: #b6a786;
  padding-top: 13px;
}
.contact-copy h2 {
  font-size: clamp(34px, 4.5vw, 62px);
  font-weight: 400;
  letter-spacing: -0.07em;
  line-height: 1.4;
}
.contact-copy p {
  white-space: pre-line;
  color: #b2b1a2;
  font-size: 14px;
  line-height: 1.9;
  margin: 25px 0 36px;
}
.contact-dialog {
  width: min(570px, calc(100vw - 40px));
  max-height: calc(100svh - 48px);
  padding: 0;
  border: 1px solid #c6beab;
  background: #f0ece3;
  color: #25271d;
  margin: auto;
  overflow-y: auto;
  box-shadow: 0 24px 90px #0005;
}
.contact-dialog::backdrop {
  background: #050603b3;
  backdrop-filter: blur(8px);
}
.contact-dialog-heading {
  position: relative;
  padding: 34px 34px 26px;
  border-bottom: 1px solid #c9c3b466;
}
.contact-dialog-heading p {
  font:
    9px/1.6 Arial,
    sans-serif;
  letter-spacing: 0.14em;
  color: #9a8059;
  margin-bottom: 14px;
}
.contact-dialog-heading h3 {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.05em;
  padding-right: 24px;
}
.contact-close {
  position: absolute;
  right: 18px;
  top: 18px;
  width: 44px;
  height: 44px;
  font-size: 27px;
  color: #73715f;
}
.contact-options {
  display: grid;
  gap: 14px;
  padding: 26px 34px 34px;
}
.contact-options :deep(.contact-option) {
  border-radius: 2px;
  text-align: left;
  width: 100%;
  padding: 22px;
  border-color: #beb8a5;
}
.contact-options :deep(.contact-option-quote) {
  border-color: #273021;
}
.contact-option strong {
  display: block;
  font-size: 16px;
  font-weight: 500;
}
.contact-option small {
  display: block;
  font-size: 12px;
  line-height: 1.8;
  opacity: 0.75;
  margin-top: 7px;
  overflow-wrap: anywhere;
}
.contact-option em {
  display: block;
  font-size: 10px;
  font-style: normal;
  opacity: 0.65;
  margin-top: 10px;
}
@media (max-width: 900px) {
  .contact-layout {
    grid-template-columns: 1fr 3fr;
  }
}
@media (max-width: 600px) {
  .home-contact {
    padding: 76px 0 88px;
  }
  .contact-layout {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .contact-eyebrow {
    padding-top: 0;
  }
  .contact-copy p {
    font-size: 13px;
  }
  .contact-dialog-heading {
    padding: 30px 22px 24px;
  }
  .contact-dialog-heading h3 {
    font-size: 23px;
  }
  .contact-options {
    padding: 22px;
  }
  .contact-options :deep(.contact-option) {
    padding: 18px;
  }
}
</style>
