<template>
  <div class="empty-container">
    <div class="empty-content">
      <!-- Empty State Icon -->
      <div class="empty-icon" :style="{ width: `${imageSize}px`, height: `${imageSize}px` }">
        <span class="material-symbols-outlined">inbox</span>
      </div>
      <!-- Description -->
      <p class="empty-description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  description?: string
  imageSize?: number
}

withDefaults(defineProps<Props>(), {
  description: '데이터가 없습니다',
  imageSize: 200,
})
</script>

<style scoped>
.empty-container {
  padding: 60px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  margin-bottom: 0.5rem;
}

.empty-icon .material-symbols-outlined {
  font-size: 120px;
  opacity: 0.3;
}

.empty-description {
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
  margin: 0;
}
</style>
