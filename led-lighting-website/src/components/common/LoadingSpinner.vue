<template>
  <div class="loading-container">
    <div class="spinner" :style="{ width: `${size}px`, height: `${size}px` }">
      <div class="spinner-circle"></div>
    </div>
    <p v-if="message" class="loading-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message?: string
  size?: number
}

withDefaults(defineProps<Props>(), {
  message: '로딩 중...',
  size: 40,
})
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  position: relative;
  display: inline-block;
}

.spinner-circle {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(34, 168, 195, 0.2);
  border-top-color: #22a8c3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-message {
  margin-top: 16px;
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}
</style>
