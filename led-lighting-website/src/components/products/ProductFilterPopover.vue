<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { ProductFilters, ProductFilterOptions } from '@/types/quote'
import { emptyFilters } from '@/composables/quote-draft'
import ProductFiltersForm from '@/components/common/quote/ProductFilters.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'

const props = defineProps<{ modelValue: ProductFilters; options: ProductFilterOptions }>()
const emit = defineEmits<{ apply: [value: ProductFilters] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof QuoteButton> | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<CSSProperties>()
let visualViewport: VisualViewport | null = null
const open = ref(false)
const draft = ref<ProductFilters>(emptyFilters())
const appliedCount = computed(() =>
  Object.values(props.modelValue).reduce((count, values) => count + values.length, 0),
)

function copyFilters(filters: ProductFilters): ProductFilters {
  return {
    power: [...filters.power],
    colorTemp: [...filters.colorTemp],
    certifications: [...filters.certifications],
    options: [...filters.options],
  }
}

function updatePanelPosition() {
  if (!open.value || !panel.value || typeof window === 'undefined') return
  if (window.innerWidth > 639) {
    panelStyle.value = undefined
    return
  }
  const anchor = (trigger.value?.$el as HTMLElement | undefined)?.getBoundingClientRect()
  if (!anchor) return
  const visual = window.visualViewport
  const viewportTop = visual?.offsetTop ?? 0
  const viewportLeft = visual?.offsetLeft ?? 0
  const viewportWidth = visual?.width ?? window.innerWidth
  const viewportHeight = visual?.height ?? window.innerHeight
  const inset = 16
  const width = Math.max(0, Math.min(430, viewportWidth - inset * 2))
  // Reflow at the target width before measuring: keyboard/zoom width changes
  // can wrap labels and grow content, invalidating an above-trigger placement.
  panel.value.style.width = `${width}px`
  const topEdge = viewportTop + inset
  const bottomEdge = viewportTop + viewportHeight - inset
  const heightLimit = Math.max(0, Math.min(620, viewportHeight - inset * 2))
  // scrollHeight includes all expanded filter rows even while max-height clips
  // the panel. The extra 2px includes its border in the visible viewport clamp.
  const contentHeight = Math.min(heightLimit, panel.value.scrollHeight + 2)
  const below = Math.max(topEdge, anchor.bottom + 10)
  const above = anchor.top - 10 - contentHeight
  let top: number
  let maxHeight = heightLimit
  if (below + contentHeight <= bottomEdge) {
    top = below
    maxHeight = Math.min(heightLimit, bottomEdge - top)
  } else if (above >= topEdge && above + contentHeight <= bottomEdge) {
    top = above
  } else {
    // With a keyboard or expanded rows, neither side may fit. Keep the full
    // scrollable panel inside the visible region, even if it overlaps the trigger.
    top = Math.max(topEdge, Math.min(below, bottomEdge - contentHeight))
  }
  const left = Math.max(
    viewportLeft + inset,
    Math.min(anchor.right - width, viewportLeft + viewportWidth - inset - width),
  )
  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function schedulePanelPosition() {
  void nextTick(updatePanelPosition)
}

watch(open, schedulePanelPosition)
watch(() => props.options, schedulePanelPosition, { deep: true })

function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  draft.value = copyFilters(props.modelValue)
  open.value = true
}

async function closeAndRestoreFocus() {
  open.value = false
  await nextTick()
  ;(trigger.value?.$el as HTMLButtonElement | undefined)?.focus()
}

function apply() {
  emit('apply', copyFilters(draft.value))
  open.value = false
}

function onPointerDown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}

function onKeyDown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    event.preventDefault()
    void closeAndRestoreFocus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, { capture: true, passive: true })
  visualViewport = window.visualViewport
  visualViewport?.addEventListener('resize', updatePanelPosition)
  visualViewport?.addEventListener('scroll', updatePanelPosition)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
  visualViewport?.removeEventListener('resize', updatePanelPosition)
  visualViewport?.removeEventListener('scroll', updatePanelPosition)
})
</script>

<template>
  <div ref="root" class="product-filter-popover">
    <QuoteButton
      ref="trigger"
      class="product-filter-trigger"
      :aria-label="open ? '제품 필터 닫기' : '제품 필터 열기'"
      :aria-expanded="open"
      aria-controls="product-filter-panel"
      @click="toggle"
    >
      <span class="material-symbols-outlined" aria-hidden="true">tune</span>
      <span class="product-filter-trigger__label">필터</span>
      <span v-if="appliedCount" class="product-filter-count" aria-label="적용된 필터 수">
        {{ appliedCount }}
      </span>
    </QuoteButton>

    <section
      v-if="open"
      id="product-filter-panel"
      ref="panel"
      :style="panelStyle"
      @toggle.capture="schedulePanelPosition"
      class="product-filter-panel"
      role="dialog"
      aria-label="제품 필터"
    >
      <div class="product-filter-panel__header">
        <div>
          <h2>제품 필터</h2>
          <p>원하는 제품 사양을 선택해 주세요.</p>
        </div>
        <button type="button" aria-label="제품 필터 닫기" @click="closeAndRestoreFocus">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      <ProductFiltersForm v-model="draft" :options="options" :show-chips="false" />
      <div class="product-filter-panel__actions">
        <QuoteButton @click="draft = emptyFilters()">초기화</QuoteButton>
        <QuoteButton
          data-test="apply-product-filters"
          variant="primary"
          class="product-filter-panel__apply"
          @click="apply"
          >필터 적용</QuoteButton
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.product-filter-popover {
  position: relative;
  flex: none;
}
.product-filter-trigger {
  min-width: 106px;
  height: 50px;
  border-color: #cbbca2;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
}
.product-filter-trigger .material-symbols-outlined {
  font-size: 21px;
}
.product-filter-count {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding-inline: 6px;
  border-radius: 999px;
  background: #4c412e;
  color: #f6f1e7;
  font-size: var(--df-font-meta, 13px);
}
.product-filter-panel {
  position: absolute;
  z-index: 35;
  top: calc(100% + 10px);
  right: 0;
  width: min(430px, calc(100vw - 48px));
  max-height: min(620px, calc(100vh - 190px));
  overflow-y: auto;
  padding: 20px 20px 0;
  box-sizing: border-box;
  overscroll-behavior: contain;
  border: 1px solid #d4c5ab;
  border-radius: 4px;
  background: #f6f1e7;
  box-shadow: 0 20px 55px rgb(48 38 19 / 16%);
}
.product-filter-panel__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  overflow-wrap: anywhere;
  gap: 16px;
}
.product-filter-panel__header h2 {
  color: #342c20;
  font-size: 18px;
  font-weight: 700;
}
.product-filter-panel__header p {
  margin-top: 4px;
  color: #746044;
  line-height: 1.7;
  overflow-wrap: anywhere;
  font-size: var(--df-font-label, 14px);
}
.product-filter-panel__header button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 9px;
  color: #827154;
}
.product-filter-panel__header button:focus-visible {
  outline: 3px solid #a98954;
}
.product-filter-panel__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px -20px 0;
  padding: 14px 20px 20px;
  border-top: 1px solid #ded1ba;
  background: #f6f1e7;
}
.product-filter-panel :deep(.q-filter-row > details),
.product-filter-panel :deep(fieldset) {
  border-color: #d4c4a8;
  background: transparent;
}
.product-filter-panel :deep(.q-filters) {
  color: #675235;
}
.product-filter-panel :deep(input) {
  accent-color: #8d703f;
}
.product-filter-panel__apply {
  flex: 1;
}
@media (max-width: 639px) {
  .product-filter-trigger {
    min-width: 50px;
    width: 50px;
    padding-inline: 0;
  }
  .product-filter-trigger__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .product-filter-count {
    position: absolute;
    top: -7px;
    right: -7px;
  }
  .product-filter-panel {
    position: fixed;
    /* Expanded mobile filters can cover the floating launcher and navigation.
       Keep their actions above that UI (10000), below the quote modal (10002). */
    z-index: 10001;
    right: auto;
    bottom: auto;
    max-height: min(620px, calc(100dvh - 32px));
    border-radius: 5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .product-filter-panel {
    scroll-behavior: auto;
  }
}
</style>
