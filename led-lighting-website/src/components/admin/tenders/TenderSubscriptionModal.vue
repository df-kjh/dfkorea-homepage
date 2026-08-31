<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { TenderSubscription, UpdateTenderSubscription } from '@/types'

interface Props { modelValue: boolean; subscription: TenderSubscription; loading?: boolean; loaded?: boolean; error?: string | null }
const props = withDefaults(defineProps<Props>(), { loading: false, loaded: true, error: null })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; retry: []; save: [subscription: UpdateTenderSubscription] }>()
const form = reactive<TenderSubscription>({ enabled: false, deliveryTime: '09:00', recipients: [] })
const email = ref('')
const recipientError = ref<string | null>(null)
const timeError = ref<string | null>(null)

const restore = () => { Object.assign(form, { ...props.subscription, recipients: [...props.subscription.recipients] }); email.value = ''; recipientError.value = null; timeError.value = null }
watch(() => props.modelValue, (open) => { if (open) restore() }, { immediate: true })
watch(() => props.subscription, () => { if (props.modelValue) restore() }, { deep: true })

const addRecipient = () => {
  const normalized = email.value.trim().toLowerCase()
  recipientError.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { recipientError.value = '올바른 이메일 주소를 입력하세요.'; return }
  if (form.recipients.includes(normalized)) { recipientError.value = '이미 등록된 이메일 주소입니다.'; return }
  if (form.recipients.length >= 20) { recipientError.value = '수신 이메일은 최대 20개까지 등록할 수 있습니다.'; return }
  form.recipients.push(normalized); email.value = ''
}
const removeRecipient = (recipient: string) => { form.recipients = form.recipients.filter((item) => item !== recipient) }
const validTime = computed(() => /^([01]\d|2[0-3]):[0-5]\d$/.test(form.deliveryTime))
const save = () => {
  if (!props.loaded) return
  recipientError.value = null; timeError.value = null
  if (!validTime.value) { timeError.value = 'HH:mm 형식의 올바른 발송 시각을 선택하세요.'; return }
  if (form.recipients.length === 0) { recipientError.value = '수신 이메일 주소를 한 개 이상 등록하세요.'; return }
  emit('save', { enabled: true, deliveryTime: form.deliveryTime, recipients: [...form.recipients] })
}

const disableReception = () => {
  if (!props.loaded) return
  emit('save', { enabled: false, deliveryTime: form.deliveryTime, recipients: [...form.recipients] })
}
</script>

<template>
  <BaseModal :model-value="modelValue" title="수신 설정" width="600px" max-width="95vw" @update:model-value="emit('update:modelValue', $event)">
    <form class="subscription-form" @submit.prevent="save"><div class="subscription-status" :class="{ 'is-enabled': form.enabled }"><strong>{{ form.enabled ? '메일 수신 중' : '메일 수신 중지됨' }}</strong><span>{{ form.enabled ? '설정한 시각에 신규 공고를 발송합니다.' : '저장하면 메일 수신이 자동으로 시작됩니다.' }}</span></div><p class="subscription-note">캘린더 필터와 무관하게 모든 신규 관련 공고가 발송됩니다.</p><label><span class="subscription-label">공통 발송 시각</span><input data-test="delivery-time" v-model="form.deliveryTime" type="time" :disabled="!loaded" /><small v-if="timeError" class="subscription-error">{{ timeError }}</small></label><div><span class="subscription-label">수신 이메일 ({{ form.recipients.length }}/20)</span><div class="subscription-add"><input data-test="recipient-email" v-model="email" type="email" autocomplete="email" placeholder="name@dfkorea.co.kr" :disabled="!loaded" @keyup.enter.prevent="addRecipient" /><BaseButton data-test="add-recipient" type="button" size="small" :disabled="!loaded" @click="addRecipient">추가</BaseButton></div><small v-if="recipientError" data-test="recipient-error" class="subscription-error">{{ recipientError }}</small><ul class="subscription-chips"><li v-for="recipient in form.recipients" :key="recipient" data-test="recipient-chip"><span>{{ recipient }}</span><button type="button" :aria-label="`${recipient} 삭제`" :disabled="!loaded" @click="removeRecipient(recipient)">×</button></li></ul></div><div v-if="error" class="subscription-load-error"><p class="subscription-error" role="alert">{{ error }}</p><BaseButton v-if="!loaded" data-test="retry-subscription" type="button" size="small" variant="default" :disabled="loading" @click="emit('retry')">다시 시도</BaseButton></div><div class="subscription-actions"><BaseButton v-if="form.enabled" data-test="disable-subscription" type="button" variant="danger" :disabled="!loaded || loading" @click="disableReception">메일 수신 중지</BaseButton><span class="subscription-actions__spacer"></span><BaseButton type="button" variant="default" :disabled="loading" @click="emit('update:modelValue', false)">취소</BaseButton><BaseButton data-test="save-subscription" type="submit" variant="primary" :disabled="!loaded || loading" :loading="loading">{{ form.enabled ? '저장' : '저장 및 수신 시작' }}</BaseButton></div></form>
  </BaseModal>
</template>

<style scoped>
.subscription-form { display: grid; gap: 1rem; }.subscription-status { display: grid; gap: .2rem; border-radius: .5rem; padding: .75rem; background: #fff7ed; color: #9a3412; }.subscription-status.is-enabled { background: #ecfdf3; color: #176b45; }.subscription-status span { font-size: .82rem; }.subscription-note { border-radius: .5rem; padding: .75rem; background: #f0fbfd; color: #0f8198; font-size: .875rem; }.subscription-label { display: block; margin-bottom: .35rem; font-size: .875rem; font-weight: 700; color: #374151; }.subscription-form input[type="time"], .subscription-add input { width: 100%; border: 1px solid #d1d5db; border-radius: .45rem; padding: .6rem .7rem; }.subscription-add { display: flex; gap: .5rem; }.subscription-add input { min-width: 0; }.subscription-chips { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: .7rem; }.subscription-chips li { display: flex; align-items: center; gap: .35rem; max-width: 100%; border-radius: 9999px; padding: .3rem .45rem .3rem .65rem; background: #eef2f7; font-size: .82rem; color: #374151; }.subscription-chips span { overflow-wrap: anywhere; }.subscription-chips button { line-height: 1; font-size: 1.2rem; color: #6b7280; }.subscription-load-error { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }.subscription-error { display: block; margin-top: .35rem; color: #b42318; }.subscription-actions { display: flex; align-items: center; gap: .5rem; margin-top: .5rem; }.subscription-actions__spacer { flex: 1; }
</style>
