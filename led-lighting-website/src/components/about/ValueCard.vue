<template>
  <div class="value-card">
    <el-icon :size="60" :color="color">
      <component :is="icon" />
    </el-icon>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon: Component
  color: string
  title: string
  description: string
}

defineProps<Props>()
</script>

<style scoped>
.value-card {
  text-align: center;
  padding: 40px 20px;
  background-color: white;
  border-radius: 20px;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 1px solid #e5e8eb;
  height: 100%;
}

.value-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.value-card .el-icon {
  margin-bottom: 20px;
}

.value-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 15px;
  letter-spacing: -0.01em;
}

.value-card p {
  font-size: 1rem;
  color: var(--toss-gray);
  line-height: 1.6;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .value-card {
    padding: 30px 15px;
  }

  .value-card h3 {
    font-size: 1.3rem;
  }

  .value-card p {
    font-size: 0.95rem;
  }
}
</style>
