<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="kinda-logo" :class="{ 'kinda-logo--compact': compact }">
    <img src="/branding/kinda/kinda-mark.svg" width="37" height="37" alt="" />
    <strong>킨다</strong>
  </span>
</template>

<style scoped>
.kinda-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #15324a;
  flex-shrink: 0;
}
.kinda-logo img {
  width: 37px;
  height: 37px;
}
.kinda-logo strong {
  font-size: 32px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: -0.045em;
}
.kinda-logo--compact {
  gap: 6px;
}
.kinda-logo--compact img {
  width: 22px;
  height: 22px;
}
.kinda-logo--compact strong {
  font-size: 16px;
  font-weight: 800;
}
@media (max-width: 767px) {
  .kinda-logo:not(.kinda-logo--compact) img {
    width: 33px;
    height: 33px;
  }
  .kinda-logo:not(.kinda-logo--compact) strong {
    font-size: 29px;
  }
  .kinda-logo--compact strong {
    font-size: 15px;
  }
}
@media (max-width: 350px) {
  .kinda-logo:not(.kinda-logo--compact) img {
    width: 30px;
    height: 30px;
  }
  .kinda-logo:not(.kinda-logo--compact) strong {
    font-size: 27px;
  }
}
</style>
