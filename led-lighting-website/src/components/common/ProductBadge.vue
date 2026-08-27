<script setup lang="ts">
interface Props {
  type: 'new' | 'main'
}

defineProps<Props>()

const getBadgeStyles = (type: 'new' | 'main') => {
  if (type === 'new') {
    return {
      bg: 'bg-primary',
      text: 'text-white',
      label: 'NEW',
    }
  }
  return {
    bg: 'bg-red-500',
    text: 'text-white',
    label: 'MAIN',
  }
}
</script>

<template>
  <div
    :class="[
      'px-2 py-1 rounded text-[10px] font-bold tracking-wider',
      getBadgeStyles(type).bg,
      getBadgeStyles(type).text,
    ]"
  >
    {{ getBadgeStyles(type).label }}
  </div>
</template>
