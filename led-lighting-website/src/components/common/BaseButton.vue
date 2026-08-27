<template>
  <button
    :disabled="disabled || loading"
    :class="[
      'base-button',
      `base-button--${variant}`,
      `base-button--${size}`,
      {
        'base-button--round': round,
        'base-button--circle': circle,
        'base-button--disabled': disabled,
        'base-button--loading': loading,
      },
      customClass,
    ]"
    @click="handleClick"
  >
    <span v-if="iconLeft" class="base-button__icon base-button__icon--left">
      <span class="material-symbols-outlined">{{ iconLeft }}</span>
    </span>
    <span v-if="loading" class="base-button__spinner"></span>
    <span v-if="!loading" class="base-button__content">
      <slot />
    </span>
    <span v-if="iconRight && !loading" class="base-button__icon base-button__icon--right">
      <span class="material-symbols-outlined">{{ iconRight }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'text' | 'default'
  size?: 'large' | 'default' | 'small'
  round?: boolean
  circle?: boolean
  disabled?: boolean
  loading?: boolean
  iconLeft?: string
  iconRight?: string
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  round: false,
  circle: false,
  disabled: false,
  loading: false,
  customClass: '',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;
  font-family: inherit;
}

.base-button:focus-visible {
  outline: 2px solid #22a8c3;
  outline-offset: 2px;
}

/* Sizes */
.base-button--small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.base-button--default {
  padding: 0.625rem 1.5rem;
  font-size: 1rem;
  line-height: 1.5rem;
}

.base-button--large {
  padding: 0.75rem 2rem;
  font-size: 1.125rem;
  line-height: 1.75rem;
}

/* Variants */
.base-button--primary {
  background-color: var(--color-primary);
  color: white;
  border-radius: 0.5rem;
}

.base-button--primary:hover:not(.base-button--disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(34, 168, 195, 0.3);
}

.base-button--primary:active:not(.base-button--disabled) {
  transform: translateY(0);
}

.base-button--secondary {
  background-color: #6b7280;
  color: white;
  border-radius: 0.5rem;
}

.base-button--secondary:hover:not(.base-button--disabled) {
  background-color: #4b5563;
  transform: translateY(-2px);
}

.base-button--default {
  background-color: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}

.base-button--default:hover:not(.base-button--disabled) {
  background-color: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-2px);
}

.base-button--text {
  background-color: transparent;
  color: #22a8c3;
  padding: 0.5rem;
}

.base-button--text:hover:not(.base-button--disabled) {
  background-color: rgba(34, 168, 195, 0.1);
  border-radius: 0.375rem;
}

.base-button--success {
  background-color: #10b981;
  color: white;
  border-radius: 0.5rem;
}

.base-button--success:hover:not(.base-button--disabled) {
  background-color: #059669;
  transform: translateY(-2px);
}

.base-button--warning {
  background-color: #f59e0b;
  color: white;
  border-radius: 0.5rem;
}

.base-button--warning:hover:not(.base-button--disabled) {
  background-color: #d97706;
  transform: translateY(-2px);
}

.base-button--danger {
  background-color: #ef4444;
  color: white;
  border-radius: 0.5rem;
}

.base-button--danger:hover:not(.base-button--disabled) {
  background-color: #dc2626;
  transform: translateY(-2px);
}

/* Shapes */
.base-button--round {
  border-radius: 9999px;
}

.base-button--circle {
  border-radius: 50%;
  padding: 0.75rem;
  width: 2.5rem;
  height: 2.5rem;
}

/* States */
.base-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button--loading {
  cursor: wait;
}

/* Icons */
.base-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.base-button__icon--left {
  margin-right: -0.25rem;
}

.base-button__icon--right {
  margin-left: -0.25rem;
}

.base-button__content {
  display: flex;
  align-items: center;
}

/* Spinner */
.base-button__spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
