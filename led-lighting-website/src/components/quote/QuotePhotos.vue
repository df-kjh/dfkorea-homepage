<script setup lang="ts">
import { computed } from 'vue'
import QuoteButton from '@/components/common/quote/QuoteButton.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
const props = defineProps<{ itemId: string }>()
const { draft, addPhoto, removePhoto, replacePhoto } = useQuoteDraft()
const photos = computed(() => draft.photos.filter((photo) => photo.itemId === props.itemId))
function choose(event: Event, replacement?: string) {
  const input = event.target as HTMLInputElement
  for (const file of Array.from(input.files || [])) {
    if (replacement) {
      void replacePhoto(replacement, file)
      break
    }
    if (!addPhoto(props.itemId, file)) break
  }
  input.value = ''
}
</script>
<template>
  <div class="q-upload">
    <p class="q-subtitle">
      예시 사진 <span class="q-help">전체 {{ draft.photos.length }}/3장</span>
    </p>
    <p class="q-help">JPEG, PNG, WebP · 장당 5MB 이하</p>
    <label class="q-file-label"
      >사진 선택<input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        :disabled="draft.busy || !!draft.pendingSubmission"
        @change="choose($event)"
    /></label>
    <div class="q-photo-grid">
      <div v-for="photo in photos" :key="photo.clientId" class="q-photo">
        <img :src="photo.preview" :alt="photo.file.name" />
        <p>{{ photo.file.name }}</p>
        <div class="q-row">
          <label class="q-file-label q-file-small"
            >교체<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :aria-label="`${photo.file.name} 교체`"
              @change="choose($event, photo.clientId)" /></label
          ><QuoteButton
            variant="link"
            :aria-label="`${photo.file.name} 삭제`"
            @click="removePhoto(photo.clientId)"
            >삭제</QuoteButton
          >
        </div>
        <p v-if="photo.error" class="q-error">{{ photo.error }}</p>
      </div>
    </div>
  </div>
</template>
