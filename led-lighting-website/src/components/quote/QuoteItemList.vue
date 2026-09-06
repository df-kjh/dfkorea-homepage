<script setup lang="ts">
import { useQuoteDraft } from '@/composables/useQuoteDraft'
import { validateItem } from '@/composables/quote-draft'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import QuotePhotos from './QuotePhotos.vue'
defineProps<{ readonly?: boolean }>()
const { draft, removeItem } = useQuoteDraft()
</script>
<template>
  <section v-if="draft.items.length" class="q-cart" aria-label="담은 제품">
    <h4 class="q-subtitle">담은 제품 {{ draft.items.length }} / 20품목</h4>
    <article v-for="item in draft.items" :key="item.clientId" class="q-cart-item">
      <div class="q-row">
        <strong>{{ item.name }}</strong
        ><span class="q-badge">{{ item.kind === 'custom' ? '직접 입력' : '카탈로그' }}</span>
      </div>
      <p v-if="item.modelName" class="q-help">{{ item.modelName }}</p>
      <p class="q-item-spec">
        {{ item.power ? `${item.power}W` : '소비전력 상담 후 결정' }} ·
        {{ item.colorTemp ? `${item.colorTemp}K` : '색온도 상담 후 결정' }}<br />옵션:
        {{ item.options.join(', ') || '상담 후 결정' }}<br />필요한 인증:
        {{ item.certifications.join(', ') || '선택 없음'
        }}<template v-if="item.dimensions"><br />규격: {{ item.dimensions }}</template>
      </p>
      <p v-if="item.description" class="q-item-description">{{ item.description }}</p>
      <div class="q-row">
        <label class="q-quantity"
          >수량
          <input
            v-if="!readonly"
            v-model.number="item.quantity"
            type="number"
            min="1"
            max="999999"
            step="1"
            :aria-label="`${item.name} 수량`"
            :disabled="draft.busy || !!draft.pendingSubmission"
          /><strong v-else>{{ item.quantity.toLocaleString() }}</strong> 개</label
        ><QuoteButton
          v-if="!readonly"
          variant="link"
          :disabled="draft.busy || !!draft.pendingSubmission"
          :aria-label="`${item.name} 삭제`"
          @click="removeItem(item.clientId)"
          >삭제</QuoteButton
        >
      </div>
      <p v-if="validateItem(item)" class="q-error">{{ validateItem(item) }}</p>
      <QuotePhotos v-if="!readonly && item.kind === 'custom'" :item-id="item.clientId" />
      <p v-else-if="draft.photos.some((photo) => photo.itemId === item.clientId)" class="q-help">
        사진 {{ draft.photos.filter((photo) => photo.itemId === item.clientId).length }}장
      </p>
    </article>
  </section>
</template>
