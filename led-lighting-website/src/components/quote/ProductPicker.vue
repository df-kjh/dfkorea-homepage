<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { productsAPI } from '@/api'
import type { Product } from '@/types'
import type { ProductFilterOptions } from '@/types/quote'
import { emptyFilters } from '@/composables/quote-draft'
import QuoteField from '@/components/common/quote/QuoteField.vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import ProductFilters from '@/components/common/quote/ProductFilters.vue'
import CatalogSpecification from './CatalogSpecification.vue'
import { revealQuoteElement } from './quote-focus'
const emit = defineEmits<{ custom: [event: MouseEvent]; added: [name: string] }>()
const search = ref(''),
  category = ref(''),
  filters = ref(emptyFilters())
const options = ref<ProductFilterOptions>({ categories: [], ...emptyFilters() })
const products = ref<Product[]>([]),
  total = ref(0),
  page = ref(1)
const loading = ref(false),
  loadingMore = ref(false),
  appendError = ref(''),
  error = ref(''),
  optionsError = ref(false)
const selected = ref<Product | null>(null),
  specification = ref<InstanceType<typeof CatalogSpecification> | null>(null),
  browser = ref<HTMLElement | null>(null)
let selectionOrigin: HTMLElement | null = null
defineExpose({
  isEditing: () => !!selected.value,
  focusSearch: () => revealQuoteElement(browser.value?.querySelector('input') ?? null),
})
let generation = 0,
  debounce: ReturnType<typeof setTimeout> | undefined,
  disposed = false
async function fetchProducts(append = false) {
  if (append && (loading.value || loadingMore.value)) return
  const request = ++generation
  loading.value = !append
  loadingMore.value = append
  error.value = ''
  appendError.value = ''
  try {
    const { data } = await productsAPI.getPaginated(
      append ? page.value + 1 : 1,
      8,
      search.value.trim(),
      category.value,
      filters.value,
    )
    if (request !== generation || disposed) return
    products.value = append ? [...products.value, ...data.data] : data.data
    total.value = data.total
    page.value = data.page
  } catch {
    if (request === generation && !disposed) {
      const message = '제품을 불러오지 못했습니다. 다시 시도해 주세요.'
      if (append) appendError.value = message
      else error.value = message
    }
  } finally {
    if (request === generation && !disposed) {
      loading.value = false
      loadingMore.value = false
    }
  }
}
async function loadOptions() {
  try {
    const { data } = await productsAPI.getFilterOptions()
    if (!disposed) {
      options.value = data
      optionsError.value = false
    }
  } catch {
    if (!disposed) optionsError.value = true
  }
}
watch(
  [search, category, filters],
  () => {
    ++generation
    loading.value = true
    loadingMore.value = false
    appendError.value = ''
    clearTimeout(debounce)
    debounce = setTimeout(() => fetchProducts(), 300)
  },
  { deep: true },
)
function reset() {
  search.value = ''
  category.value = ''
  filters.value = emptyFilters()
}
onMounted(() => {
  void fetchProducts()
  void loadOptions()
})
onBeforeUnmount(() => {
  disposed = true
  ++generation
  clearTimeout(debounce)
})
async function selectProduct(product: Product, event: MouseEvent) {
  selectionOrigin = event.currentTarget as HTMLElement
  selected.value = product
  await nextTick()
  specification.value?.reveal()
}
async function cancelSelection() {
  selected.value = null
  await nextTick()
  if (selectionOrigin?.isConnected) revealQuoteElement(selectionOrigin)
  else revealQuoteElement(browser.value?.querySelector('input') ?? null)
}
function onAdded() {
  const name = selected.value?.name || '선택한'
  selected.value = null
  emit('added', name)
}
</script>
<template>
  <div class="q-product-layout">
    <div ref="browser" class="q-catalog-browser">
      <h3 class="q-title">어떤 제품이 필요하세요?</h3>
      <p class="q-help">
        제품의 사양 선택을 누른 뒤, 사양과 수량을 확인해 견적 목록에 담아 주세요.
      </p>
      <QuoteField label="제품명 또는 모델명 검색"
        ><input v-model="search" type="search" placeholder="예: 주차장 조명, DF-WP"
      /></QuoteField>
      <QuoteField label="카테고리"
        ><select v-model="category">
          <option value="">전체 카테고리</option>
          <option v-for="value in options.categories" :key="value">{{ value }}</option>
        </select></QuoteField
      >
      <ProductFilters v-model="filters" :options="options" />
      <p v-if="optionsError" class="q-help">
        검색 조건을 불러오지 못했습니다.
        <QuoteButton variant="link" @click="loadOptions">다시 불러오기</QuoteButton>
      </p>
      <div class="q-row">
        <span class="q-help">검색 결과 {{ total }}개</span
        ><QuoteButton variant="link" @click="reset">조건 초기화</QuoteButton>
      </div>
      <p v-if="loading" role="status" class="q-status">제품을 불러오는 중…</p>
      <div v-else-if="error" role="alert" class="q-status">
        <p>{{ error }}</p>
        <QuoteButton @click="fetchProducts()">다시 시도</QuoteButton>
      </div>
      <template v-else
        ><p v-if="!products.length" class="q-empty">
          조건에 맞는 제품이 없습니다.<br />조건을 초기화하거나 원하는 사양을 직접 입력해 주세요.
        </p>
        <article v-for="product in products" :key="product.id" class="q-product">
          <img
            v-if="product.images?.[0]?.image"
            :src="product.images[0].image"
            :alt="product.name"
            class="q-thumb"
            loading="lazy"
          /><span v-else class="q-thumb q-placeholder" aria-hidden="true">✦</span>
          <div class="q-product-info">
            <strong>{{ product.name }}</strong
            ><small>{{ product.modelName || '모델명 미등록' }}</small>
            <div class="q-tags">
              <span v-for="power in product.power" :key="power">{{ power }}W</span
              ><span v-for="certification in product.certifications" :key="certification">{{
                certification
              }}</span>
            </div>
          </div>
          <QuoteButton
            :aria-label="`${product.name} 사양 선택하고 담기`"
            @click="selectProduct(product, $event)"
            >사양 선택</QuoteButton
          >
        </article>
        <div v-if="products.length" class="q-load-more q-gap" :aria-busy="loadingMore">
          <p class="q-append-error q-error" :role="appendError ? 'alert' : undefined">
            {{ appendError }}
          </p>
          <QuoteButton
            v-if="products.length < total || appendError"
            class="q-wide"
            :disabled="loadingMore"
            @click="fetchProducts(true)"
          >
            {{
              loadingMore ? '제품을 더 불러오는 중…' : appendError ? '다시 시도' : '제품 더 보기'
            }}
          </QuoteButton>
          <span v-if="loadingMore" role="status" class="q-sr-only">제품을 더 불러오는 중…</span>
        </div>
      </template>
      <QuoteButton class="q-custom-entry q-wide" @click="emit('custom', $event)"
        ><span>원하는 사양 직접 입력</span><span aria-hidden="true">↗</span></QuoteButton
      >
    </div>
    <aside class="q-selection-sidebar" aria-label="사양과 견적 목록">
      <CatalogSpecification
        v-if="selected"
        ref="specification"
        :key="selected.id"
        :product="selected"
        @added="onAdded"
        @cancel="cancelSelection"
      />
      <p v-else class="q-selection-help q-help">
        제품의 ‘사양 선택’을 눌러 필요한 사양을 입력하세요. 목록에 담은 제품은 이곳에서 확인할 수
        있어요.
      </p>
      <slot />
    </aside>
  </div>
</template>
