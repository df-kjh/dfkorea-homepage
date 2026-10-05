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
  font-size: var(--df-font-label, 14px);
  font-weight: var(--df-weight-control, 600);
  color: #283447;
  min-width: 0;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.q-field small {
  font-weight: 400;
  color: #637083;
  margin-left: 5px;
  font-size: var(--df-font-meta, 13px);
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
  font-size: var(--df-font-body, 17px);
  font-weight: var(--df-weight-body, 400);
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
@media (max-width: 700px) {
  .q-field :deep(input),
  .q-field :deep(select),
  .q-field :deep(textarea) {
    font-size: var(--df-font-body, 16px);
  }
}
</style>
