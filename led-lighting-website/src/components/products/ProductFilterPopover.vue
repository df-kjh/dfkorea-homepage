<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ProductFilters, ProductFilterOptions } from '@/types/quote'
import { emptyFilters } from '@/composables/quote-draft'
import ProductFiltersForm from '@/components/common/quote/ProductFilters.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'

const props = defineProps<{ modelValue: ProductFilters; options: ProductFilterOptions }>()
const emit = defineEmits<{ apply: [value: ProductFilters] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<InstanceType<typeof QuoteButton> | null>(null)
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
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
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
  border-color: #cfd8e6;
  font-size: 14px;
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
  background: #0066ff;
  color: #fff;
  font-size: 11px;
}
.product-filter-panel {
  position: absolute;
  z-index: 35;
  top: calc(100% + 10px);
  right: 0;
  width: min(430px, calc(100vw - 48px));
  max-height: min(620px, calc(100vh - 190px));
  overflow-y: auto;
  padding: 20px;
  border: 1px solid #dce3ec;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 55px rgb(23 42 72 / 18%);
}
.product-filter-panel__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
.product-filter-panel__header h2 {
  color: #182234;
  font-size: 18px;
  font-weight: 700;
}
.product-filter-panel__header p {
  margin-top: 4px;
  color: #637083;
  font-size: 12px;
}
.product-filter-panel__header button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  color: #536177;
}
.product-filter-panel__header button:focus-visible {
  outline: 3px solid #91baff;
}
.product-filter-panel__actions {
  position: sticky;
  bottom: -20px;
  display: flex;
  gap: 8px;
  margin: 14px -20px -20px;
  padding: 14px 20px 20px;
  border-top: 1px solid #e7ebf1;
  background: #fff;
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
    top: auto;
    right: 16px;
    /* Reserve the full quote + back-to-top stack used after the page scrolls. */
    bottom: max(156px, calc(136px + env(safe-area-inset-bottom)));
    left: 16px;
    width: auto;
    max-height: min(72dvh, 620px);
    border-radius: 18px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .product-filter-panel {
    scroll-behavior: auto;
  }
}
</style>
