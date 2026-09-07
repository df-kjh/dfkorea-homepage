<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import { tendersAPI } from '@/api/tenders'
import type { ReplaceTenderCompanyProfile, TenderCompanyProfile } from '@/types'
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  saved: [profile: TenderCompanyProfile]
}>()
const empty = (): ReplaceTenderCompanyProfile => ({
  companyName: '',
  businessNumber: '',
  headquarters: { sido: '', sigungu: '' },
  g2bRegistered: false,
  supplyProducts: [],
  licenses: [],
  companyTypes: [],
  directProduction: [],
  certifications: [],
  performanceRecords: [],
})
const qualificationGroups = [
  { key: 'supplyProducts', label: '공급물품 분류' },
  { key: 'licenses', label: '업종·면허' },
  { key: 'companyTypes', label: '기업구분' },
  { key: 'directProduction', label: '직접생산확인' },
  { key: 'certifications', label: '보유 인증' },
] as const
const draft = ref(empty()),
  loading = ref(false),
  saving = ref(false),
  loaded = ref(false),
  missing = ref(false),
  advancedOpen = ref(false),
  error = ref(''),
  feedback = ref('')
const displayedQualificationGroups = computed(() =>
  qualificationGroups.filter(
    ({ key }) => key !== 'supplyProducts' || draft.value.supplyProducts.length > 0,
  ),
)
let generation = 0
const load = async () => {
  const request = ++generation
  loading.value = true
  loaded.value = false
  error.value = ''
  feedback.value = ''
  missing.value = false
  draft.value = empty()
  try {
    const { data } = await tendersAPI.getCompanyProfile()
    if (request !== generation) return
    missing.value = data === null
    if (data) {
      // Explicitly select replacement fields, keeping version out of the PUT body.
      const fields = empty()
      for (const key of Object.keys(fields) as (keyof ReplaceTenderCompanyProfile)[])
        Object.assign(fields, { [key]: data[key] })
      draft.value = JSON.parse(JSON.stringify(fields)) as ReplaceTenderCompanyProfile
    }
    loaded.value = true
  } catch {
    if (request === generation) error.value = '회사 자격을 불러오지 못했습니다. 다시 시도해 주세요.'
  } finally {
    if (request === generation) loading.value = false
  }
}
const validate = (payload: ReplaceTenderCompanyProfile) => {
  if (
    !payload.companyName ||
    !/^\d{10}$/.test(payload.businessNumber) ||
    !payload.headquarters.sido ||
    !payload.headquarters.sigungu
  )
    return '회사명, 사업자번호 10자리, 본점 소재지를 입력해 주세요.'
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  for (const group of qualificationGroups) {
    const rows = payload[group.key]
    if (rows.length > 100) return `${group.label}은 최대 100개까지 입력할 수 있습니다.`
    if (rows.some((row) => !row.code || !row.name))
      return `${group.label} 코드와 명칭을 입력해 주세요.`
    if (
      new Set(rows.map((row) => row.code)).size !== rows.length ||
      new Set(rows.map((row) => row.name)).size !== rows.length
    )
      return `${group.label} 코드 또는 명칭이 중복되었습니다.`
    for (const row of rows) {
      if (row.expiresAt === null) continue
      if (!row.expiresAt || Number.isNaN(Date.parse(row.expiresAt)))
        return `${group.label} 유효기간을 입력하거나 만료일 없음을 선택해 주세요.`
      if (row.expiresAt.slice(0, 10) < today)
        return `${group.label} 자격이 만료되었습니다. 유효한 자격만 저장해 주세요.`
    }
  }
  if (payload.performanceRecords.length > 100) return '실적은 최대 100개까지 입력할 수 있습니다.'
  for (const row of payload.performanceRecords) {
    if (!row.itemName || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row.amount))
      return '실적 품목명과 0 이상의 금액을 입력해 주세요.'
    if (
      !row.from ||
      !row.to ||
      Number.isNaN(Date.parse(row.from)) ||
      Number.isNaN(Date.parse(row.to)) ||
      row.from > row.to
    )
      return '실적 기간의 시작일과 종료일을 확인해 주세요.'
  }
  return ''
}
const save = async () => {
  if (!loaded.value || loading.value || saving.value) return
  const payload = JSON.parse(JSON.stringify(draft.value)) as ReplaceTenderCompanyProfile
  payload.companyName = payload.companyName.trim()
  payload.businessNumber = payload.businessNumber.replace(/\D/g, '')
  payload.headquarters.sido = payload.headquarters.sido.trim()
  payload.headquarters.sigungu = payload.headquarters.sigungu.trim()
  for (const group of qualificationGroups)
    payload[group.key] = payload[group.key].map((row) => ({
      code: row.code.trim().toUpperCase(),
      name: row.name.trim(),
      expiresAt: row.expiresAt,
    }))
  payload.performanceRecords = payload.performanceRecords.map((row) => ({
    ...row,
    itemName: row.itemName.trim(),
    amount: row.amount.trim(),
  }))
  error.value = validate(payload)
  feedback.value = ''
  if (error.value) return
  const request = ++generation
  saving.value = true
  try {
    const { data } = await tendersAPI.replaceCompanyProfile(payload)
    if (request !== generation) return
    feedback.value = `회사 자격 버전 ${data.version} 저장 완료. 기존 분석을 재계산 대상으로 등록했습니다.`
    missing.value = false
    emit('saved', data)
  } catch {
    if (request === generation)
      error.value = '회사 자격을 저장하지 못했습니다. 입력한 내용은 유지됩니다.'
  } finally {
    if (request === generation) saving.value = false
  }
}
watch(
  () => props.modelValue,
  (open) => {
    ++generation
    saving.value = false
    if (open) {
      advancedOpen.value = false
      void load()
    } else {
      loaded.value = false
      loading.value = false
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  ++generation
})
</script>
<template>
  <BaseModal
    :model-value="modelValue"
    title="회사 자격 설정"
    subtitle="선택 사항 · 회사 정보 없이도 사양과 가격 분석을 이용할 수 있습니다."
    width="960px"
    max-width="95vw"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p v-if="loading" role="status">회사 자격을 불러오는 중입니다.</p>
    <p v-if="missing" role="status" class="mb-4 text-sm text-gray-600">
      등록하지 않아도 사양과 가격 분석을 이용할 수 있습니다. 참가 조건과 인증은 확인 필요로
      표시됩니다.
    </p>
    <p v-if="error" role="alert" class="profile-error">
      {{ error }}
      <BaseButton
        v-if="!loaded && !loading"
        data-test="retry-profile"
        type="button"
        size="small"
        @click="load"
        >다시 시도</BaseButton
      >
    </p>
    <p v-if="feedback" role="status" class="mb-4 text-sm text-green-800">{{ feedback }}</p>
    <slot name="progress" />
    <form @submit.prevent="save">
      <fieldset :disabled="!loaded || loading || saving" class="profile-fields">
        <BaseCard :hoverable="false"
          ><h4 class="font-bold mb-3">기본 정보</h4>
          <div class="profile-grid">
            <label
              >회사명<input
                v-model="draft.companyName"
                data-test="profile-company"
                autocomplete="organization" /></label
            ><label
              >사업자번호<input
                v-model="draft.businessNumber"
                inputmode="numeric"
                placeholder="10자리" /></label
            ><label>본점 시·도<input v-model="draft.headquarters.sido" /></label
            ><label>본점 시·군·구<input v-model="draft.headquarters.sigungu" /></label>
          </div>
          <label class="profile-check"
            ><input v-model="draft.g2bRegistered" type="checkbox" />나라장터 조달업체 등록</label
          ></BaseCard
        >
        <BaseCard :hoverable="false">
          <div class="profile-heading">
            <div>
              <h4 class="font-bold">자격·실적 상세 입력</h4>
              <p class="mt-1 text-sm text-gray-500">참가 조건을 자동 확인할 때만 입력해 주세요.</p>
            </div>
            <BaseButton
              data-test="toggle-profile-details"
              type="button"
              size="small"
              :aria-expanded="advancedOpen"
              aria-controls="profile-advanced-fields"
              @click="advancedOpen = !advancedOpen"
              >{{ advancedOpen ? '상세 입력 접기' : '상세 입력 펼치기' }}</BaseButton
            >
          </div>
          <div v-if="advancedOpen" id="profile-advanced-fields" class="profile-advanced">
            <BaseCard
              v-for="group in displayedQualificationGroups"
              :key="group.key"
              :hoverable="false"
              ><div class="profile-heading">
                <div>
                  <h4 class="font-bold">
                    {{ group.key === 'supplyProducts' ? '기존 공급물품 분류' : group.label }}
                  </h4>
                  <p v-if="group.key === 'supplyProducts'" class="mt-1 text-sm text-gray-500">
                    신규 항목은 추가할 수 없습니다. 기존 값만 수정하거나 삭제할 수 있습니다.
                  </p>
                </div>
                <BaseButton
                  v-if="group.key !== 'supplyProducts'"
                  :data-test="`add-${group.key}`"
                  type="button"
                  size="small"
                  :disabled="draft[group.key].length >= 100"
                  @click="draft[group.key].push({ code: '', name: '', expiresAt: '' })"
                  >{{ group.label }} 추가</BaseButton
                >
              </div>
              <p v-if="!draft[group.key].length" class="text-sm text-gray-500">
                입력된 자격이 없습니다.
              </p>
              <fieldset
                v-for="(row, index) in draft[group.key]"
                :key="index"
                class="qualification-row"
              >
                <legend class="sr-only">{{ group.label }} {{ index + 1 }}</legend>
                <label
                  >코드<input v-model="row.code" :data-test="`${group.key}-${index}-code`" /></label
                ><label
                  >명칭<input v-model="row.name" :data-test="`${group.key}-${index}-name`" /></label
                ><label
                  >유효기간<input
                    :value="row.expiresAt?.slice(0, 10) ?? ''"
                    type="date"
                    :disabled="row.expiresAt === null"
                    :data-test="`${group.key}-${index}-expiry`"
                    @input="row.expiresAt = ($event.target as HTMLInputElement).value" /></label
                ><label class="profile-check"
                  ><input
                    type="checkbox"
                    :checked="row.expiresAt === null"
                    :data-test="`${group.key}-${index}-no-expiry`"
                    @change="
                      row.expiresAt = ($event.target as HTMLInputElement).checked ? null : ''
                    "
                  />만료일 없음</label
                ><BaseButton
                  :data-test="`remove-${group.key}-${index}`"
                  type="button"
                  size="small"
                  variant="text"
                  :aria-label="`${group.label} ${index + 1} 삭제`"
                  @click="draft[group.key].splice(index, 1)"
                  >삭제</BaseButton
                >
              </fieldset></BaseCard
            >
            <BaseCard :hoverable="false"
              ><div class="profile-heading">
                <h4 class="font-bold">동종 물품 납품실적</h4>
                <BaseButton
                  data-test="add-performance"
                  type="button"
                  size="small"
                  :disabled="draft.performanceRecords.length >= 100"
                  @click="
                    draft.performanceRecords.push({ itemName: '', from: '', to: '', amount: '' })
                  "
                  >실적 추가</BaseButton
                >
              </div>
              <p class="text-sm text-gray-500">
                관리자 입력 정보입니다. 증빙자료는 별도 확인이 필요합니다.
              </p>
              <fieldset
                v-for="(row, index) in draft.performanceRecords"
                :key="index"
                class="qualification-row"
              >
                <legend class="sr-only">납품실적 {{ index + 1 }}</legend>
                <label
                  >품목명<input
                    v-model="row.itemName"
                    :data-test="`performance-${index}-name`" /></label
                ><label
                  >시작일<input
                    v-model="row.from"
                    type="date"
                    :data-test="`performance-${index}-from`" /></label
                ><label
                  >종료일<input
                    v-model="row.to"
                    type="date"
                    :data-test="`performance-${index}-to`" /></label
                ><label
                  >금액 (원)<input
                    v-model="row.amount"
                    inputmode="decimal"
                    :data-test="`performance-${index}-amount`" /></label
                ><BaseButton
                  type="button"
                  size="small"
                  variant="text"
                  :aria-label="`납품실적 ${index + 1} 삭제`"
                  @click="draft.performanceRecords.splice(index, 1)"
                  >삭제</BaseButton
                >
              </fieldset></BaseCard
            >
          </div>
        </BaseCard>
      </fieldset>
      <div class="profile-actions">
        <BaseButton type="button" @click="emit('update:modelValue', false)">닫기</BaseButton
        ><BaseButton
          data-test="save-profile"
          type="submit"
          variant="primary"
          :loading="saving"
          :disabled="!loaded || loading"
          aria-label="회사 자격 저장"
          >회사 자격 저장</BaseButton
        >
      </div>
    </form>
  </BaseModal>
</template>
<style scoped>
.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}
label {
  display: block;
  min-width: 0;
  font-size: 0.8rem;
  color: #475569;
}
input:not([type='checkbox']) {
  display: block;
  width: 100%;
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  padding: 0.55rem;
  margin-top: 0.3rem;
  color: #111827;
}
.profile-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.7rem;
}
.profile-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.profile-advanced {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}
.qualification-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto;
  align-items: end;
  gap: 0.6rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid #e5e7eb;
}
.profile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}
.profile-error {
  color: #b42318;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
@media (max-width: 760px) {
  .qualification-row,
  .profile-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
