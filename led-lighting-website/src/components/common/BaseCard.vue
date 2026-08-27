<template>
  <div
    class="base-card"
    :class="[
      shadow && `shadow-${shadow}`,
      hoverable && 'hoverable',
      clickable && 'clickable',
      customClass,
    ]"
    @click="handleClick"
  >
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body" :style="bodyStyle">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  shadow?: 'always' | 'hover' | 'never'
  hoverable?: boolean
  clickable?: boolean
  bodyStyle?: Record<string, string>
  customClass?: string
}

withDefaults(defineProps<Props>(), {
  shadow: 'never',
  hoverable: true,
  clickable: false,
  bodyStyle: () => ({}),
  customClass: '',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  emit('click', event)
}
</script>

<style scoped>
.base-card {
  position: relative;
  background-color: white;
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid var(--toss-border, #e5e8eb);
}

.base-card.shadow-always {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.base-card.shadow-hover:hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.base-card.hoverable:hover {
  transform: translateY(-8px);
  border-color: var(--color-primary);
}

.base-card.clickable {
  cursor: pointer;
}

.card-header {
  padding: 20px;
  border-bottom: 1px solid var(--toss-border, #e5e8eb);
}

.card-body {
  padding: 24px;
}

.card-footer {
  padding: 20px;
  border-top: 1px solid var(--toss-border, #e5e8eb);
}
</style>
