<script setup lang="ts">
defineProps<{ label: string; title: string }>()
</script>
<template>
  <div class="detail-heading">
    <p class="detail-kicker">{{ label }}</p>
    <h2>{{ title }}</h2>
  </div>
</template>
