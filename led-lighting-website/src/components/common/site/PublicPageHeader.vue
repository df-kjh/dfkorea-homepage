<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    backTo?: string
    backLabel?: string
  }>(),
  { description: '', backTo: '', backLabel: '목록으로' },
)
</script>

<template>
  <header class="public-page-header">
    <div class="public-container">
      <NuxtLink v-if="backTo" :to="backTo" class="public-back-link"
        ><span aria-hidden="true">←</span>{{ backLabel }}</NuxtLink
      >
      <div class="public-page-header__content">
        <h1>{{ title }}</h1>
        <div v-if="description || $slots.actions" class="public-page-header__aside">
          <p v-if="description">{{ description }}</p>
          <div v-if="$slots.actions" class="public-page-header__actions">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
