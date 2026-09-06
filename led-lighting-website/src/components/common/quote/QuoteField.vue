<script setup lang="ts">
defineProps<{ label: string; required?: boolean; optional?: boolean; hint?: string }>()
</script>
<template>
  <label class="q-field"
    ><span
      >{{ label }} <span v-if="required" class="q-required" aria-label="필수">*</span
      ><small v-if="optional">선택</small></span
    ><slot /><small v-if="hint">{{ hint }}</small></label
  >
</template>
<style scoped>
.q-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: #283447;
  min-width: 0;
}
.q-field small {
  font-weight: 400;
  color: #637083;
  margin-left: 5px;
  font-size: 11px;
}
.q-required {
  color: #0066ff;
}
.q-field :deep(input),
.q-field :deep(select),
.q-field :deep(textarea) {
  width: 100%;
  min-width: 0;
  border: 1px solid #dce3ec;
  border-radius: 9px;
  padding: 10px 11px;
  background: #fff;
  color: #192332;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  box-sizing: border-box;
}
.q-field :deep(textarea) {
  resize: vertical;
}
.q-field :deep(:focus-visible) {
  outline: 3px solid #a8c9ff;
  outline-offset: 1px;
}
.q-field :deep(input[type='checkbox']) {
  width: auto;
}
@media (max-width: 639px) {
  .q-field :deep(input),
  .q-field :deep(select),
  .q-field :deep(textarea) {
    font-size: 16px;
  }
}
</style>
