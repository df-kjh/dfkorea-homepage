<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'secondary' | 'link'; type?: 'button' | 'submit' }>(),
  { variant: 'secondary', type: 'button' },
)
</script>
<template>
  <button :type="type" class="q-button" :class="`q-button--${variant}`"><slot /></button>
</template>
<style scoped>
.q-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 9px 13px;
  border: 1px solid #dce3ec;
  border-radius: 10px;
  background: #fff;
  color: #243044;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1.4;
}
.q-button:hover {
  background: #f0f5fc;
}
.q-button--primary {
  background: #0066ff;
  border-color: #0066ff;
  color: white;
}
.q-button--primary:hover {
  background: #0054d6;
}
.q-button--link {
  border: 0;
  background: transparent;
  color: #0066ff;
  padding: 5px;
  min-height: 36px;
}
.q-button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}
.q-button:focus-visible {
  outline: 3px solid #91baff;
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .q-button {
    transition: none;
  }
}
</style>
