<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    to?: string
    href?: string
    variant?: 'dark' | 'light' | 'outline' | 'text'
    type?: 'button' | 'submit'
  }>(),
  { variant: 'dark', type: 'button' },
)
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="['public-action', `public-action--${variant}`]"
    v-bind="$attrs"
    ><slot
  /></NuxtLink>
  <a
    v-else-if="href"
    :href="href"
    :class="['public-action', `public-action--${variant}`]"
    v-bind="$attrs"
    ><slot
  /></a>
  <button
    v-else
    :type="type"
    :class="['public-action', `public-action--${variant}`]"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>
