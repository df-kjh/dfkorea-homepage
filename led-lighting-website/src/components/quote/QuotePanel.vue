<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { validateCompany } from '@/composables/quote-draft'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import CompanyStep from './CompanyStep.vue'
import ProductStep from './ProductStep.vue'
import ReviewStep from './ReviewStep.vue'
import SuccessState from './SuccessState.vue'
const { draft, close, next, submit, isVerified } = useQuoteDraft()
const panel = ref<HTMLElement | null>(null),
  body = ref<HTMLElement | null>(null),
  productStep = ref<InstanceType<typeof ProductStep> | null>(null)
const mobile = ref(false)
const expanded = ref(true)
const companyStepReady = computed(
  () => !validateCompany(draft.company) && draft.consent && isVerified(),
)
let media: MediaQueryList | null = null
let restoreBackground: (() => void) | null = null
function syncBackground() {
  restoreBackground?.()
  restoreBackground = null
  if (!mobile.value || !draft.open) return
  const overflow = document.body.style.overflow
  const nodes = Array.from(document.body.children).filter(
    (node) => node instanceof HTMLElement && node.id !== 'quote-widget',
  ) as HTMLElement[]
  const previous = nodes.map((node) => node.inert)
  nodes.forEach((node) => {
    node.inert = true
  })
  document.body.style.overflow = 'hidden'
  restoreBackground = () => {
    nodes.forEach((node, index) => {
      node.inert = previous[index]!
    })
    document.body.style.overflow = overflow
  }
}
function viewport() {
  if (!panel.value) return
  const visual = window.visualViewport
  panel.value.style.setProperty('--q-viewport-height', `${visual?.height || window.innerHeight}px`)
  panel.value.style.setProperty(
    '--q-keyboard-offset',
    `${Math.max(0, window.innerHeight - (visual?.height || window.innerHeight) - (visual?.offsetTop || 0))}px`,
  )
}
function syncMedia() {
  mobile.value = media?.matches ?? false
  syncBackground()
  viewport()
}
function keyboard(event: KeyboardEvent) {
  if (!draft.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !mobile.value || !panel.value) return
  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
    ),
  ).filter(
    (node) =>
      node.getClientRects().length && !node.closest('[inert]') && !node.matches(':disabled'),
  )
  const first = focusable[0],
    last = focusable.at(-1)
  if (!first || !last) {
    event.preventDefault()
    panel.value.focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === panel.value)
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !panel.value.contains(document.activeElement))
  ) {
    event.preventDefault()
    first.focus()
  }
}
watch(
  () => draft.open,
  async (open) => {
    syncBackground()
    if (open) {
      await nextTick()
      viewport()
      panel.value?.focus()
    }
  },
)
watch(
  () => draft.step,
  async () => {
    await nextTick()
    body.value?.scrollTo({ top: 0 })
    panel.value?.focus()
  },
)
watch(
  () => draft.error,
  async (error) => {
    if (error) {
      await nextTick()
      panel.value
        ?.querySelector<HTMLElement>('.q-panel-error')
        ?.scrollIntoView({ block: 'nearest' })
    }
  },
)
function previous() {
  draft.step = draft.step === 3 ? 2 : 1
  draft.error = ''
}
function advance() {
  if (draft.step === 2 && productStep.value?.isEditing()) {
    draft.error = '작성한 사양을 견적 목록에 담거나 제품 검색으로 돌아가 주세요.'
    return
  }
  next()
}
onMounted(() => {
  media = window.matchMedia('(max-width: 639px)')
  syncMedia()
  media.addEventListener('change', syncMedia)
  document.addEventListener('keydown', keyboard)
  window.visualViewport?.addEventListener('resize', viewport)
  window.visualViewport?.addEventListener('scroll', viewport)
  if (draft.open) void nextTick(() => panel.value?.focus())
})
onBeforeUnmount(() => {
  restoreBackground?.()
  media?.removeEventListener('change', syncMedia)
  document.removeEventListener('keydown', keyboard)
  window.visualViewport?.removeEventListener('resize', viewport)
  window.visualViewport?.removeEventListener('scroll', viewport)
})
</script>
<template>
  <div v-show="draft.open && mobile" class="q-backdrop" aria-hidden="true" @click="close" />
  <Transition name="q-panel"
    ><section
      v-show="draft.open"
      id="quote-panel"
      ref="panel"
      class="q-panel"
      :class="{ 'q-panel--expanded': expanded && !mobile }"
      role="dialog"
      :aria-modal="mobile ? 'true' : undefined"
      aria-labelledby="quote-title"
      tabindex="-1"
    >
      <header class="q-header">
        <span class="q-header-icon material-symbols-outlined" aria-hidden="true"
          >request_quote</span
        >
        <div>
          <h2 id="quote-title">온라인 견적</h2>
          <p>최대 24시간 이내 답변을 받으실 수 있습니다.</p>
        </div>
        <QuoteButton
          v-if="!mobile"
          variant="link"
          class="q-size-toggle"
          :aria-label="expanded ? '견적 창 축소' : '견적 창 확대'"
          :aria-pressed="expanded"
          @click="expanded = !expanded"
        >
          <span class="material-symbols-outlined" aria-hidden="true">{{
            expanded ? 'close_fullscreen' : 'open_in_full'
          }}</span>
        </QuoteButton>
        <QuoteButton variant="link" class="q-close" aria-label="견적 창 최소화" @click="close"
          >×</QuoteButton
        >
      </header>
      <ol v-if="!draft.reference" class="q-steps" aria-label="견적 요청 단계">
        <li
          v-for="(label, index) in ['기업 정보', '제품 선택', '요청 확인']"
          :key="label"
          :aria-current="draft.step === index + 1 ? 'step' : undefined"
        >
          <span>{{ index + 1 }}</span
          >{{ label }}
        </li>
      </ol>
      <div ref="body" class="q-body">
        <SuccessState v-if="draft.reference" />
        <template v-else
          ><CompanyStep v-show="draft.step === 1" /><ProductStep
            ref="productStep"
            v-show="draft.step === 2" /><ReviewStep v-show="draft.step === 3"
        /></template>
        <div v-if="draft.error" class="q-panel-error q-error" role="alert">
          <p>{{ draft.error }}</p>
          <p class="q-contact">
            도움이 필요하시면 <a href="tel:0325282953">032-528-2953</a> 또는
            <a href="mailto:kymkjh2002@dfkorealed.com">이메일 문의</a>를 이용해 주세요.
          </p>
        </div>
      </div>
      <footer class="q-footer">
        <template v-if="draft.reference"
          ><QuoteButton variant="primary" class="q-wide" @click="close">닫기</QuoteButton></template
        ><template v-else
          ><QuoteButton
            v-if="draft.step > 1"
            :disabled="draft.busy || !!draft.pendingSubmission"
            @click="previous"
            >이전</QuoteButton
          ><QuoteButton
            v-if="draft.step < 3"
            variant="primary"
            :disabled="
              draft.busy ||
              (draft.step === 1 ? !companyStepReady : draft.items.length === 0)
            "
            @click="advance"
            >{{ draft.step === 1 ? '제품 선택하기 →' : '요청 확인하기 →' }}</QuoteButton
          ><QuoteButton v-else variant="primary" :disabled="draft.busy" @click="submit">{{
            draft.busy
              ? '접수 중…'
              : draft.pendingSubmission
                ? '접수 결과 다시 확인'
                : '견적 요청 보내기'
          }}</QuoteButton></template
        >
      </footer>
    </section></Transition
  >
</template>
