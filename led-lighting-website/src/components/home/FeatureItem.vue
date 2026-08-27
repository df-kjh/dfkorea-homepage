<template>
  <div class="feature-item" :class="{ reverse: reverse }">
    <div class="feature-visual">
      <div class="feature-icon-large" :style="{ background: iconGradient }">
        <el-icon>
          <component :is="icon" />
        </el-icon>
      </div>
    </div>
    <div class="feature-text">
      <h2 class="feature-title">{{ title }}</h2>
      <p class="feature-description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon: Component
  title: string
  description: string
  reverse?: boolean
  iconGradient?: string
}

withDefaults(defineProps<Props>(), {
  reverse: false,
  iconGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
})
</script>

<style scoped>
.feature-item {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
  padding: 120px 0;
  border-bottom: 1px solid var(--toss-border, #e5e8eb);
  opacity: 0;
  transform: translateY(40px);
  transition:
    opacity 0.8s ease-out,
    transform 0.8s ease-out;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-item.reverse {
  direction: rtl;
}

.feature-item.reverse > * {
  direction: ltr;
}

.feature-text {
  text-align: left;
}

.feature-title {
  font-size: 3.5rem;
  font-weight: 700;
  color: var(--toss-dark, #191f28);
  margin-bottom: 30px;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.feature-description {
  font-size: 1.5rem;
  color: var(--toss-gray, #4e5968);
  line-height: 1.7;
  font-weight: 400;
}

.feature-visual {
  display: flex;
  justify-content: center;
  align-items: center;
}

.feature-icon-large {
  width: 280px;
  height: 280px;
  border-radius: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120px;
  color: white;
  box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s ease;
}

.feature-icon-large:hover {
  transform: scale(1.05);
}

.feature-icon-large .el-icon {
  font-size: 120px;
}

/* Animation */
.feature-item.fade-in-up {
  opacity: 1;
  transform: translateY(0);
}

/* Dark mode */
:deep(.dark) .feature-item {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .feature-title {
  color: var(--el-text-color-primary);
}

:deep(.dark) .feature-description {
  color: var(--el-text-color-regular);
}

/* Responsive */
@media (max-width: 992px) {
  .feature-item {
    grid-template-columns: 1fr;
    gap: 40px;
    padding: 80px 0;
  }

  .feature-item.reverse {
    direction: ltr;
  }

  .feature-text {
    text-align: center;
  }

  .feature-title {
    font-size: 2.5rem;
  }

  .feature-description {
    font-size: 1.25rem;
  }

  .feature-icon-large {
    width: 200px;
    height: 200px;
  }

  .feature-icon-large .el-icon {
    font-size: 80px;
  }
}

@media (max-width: 768px) {
  .feature-item {
    padding: 60px 0;
  }

  .feature-title {
    font-size: 2rem;
  }

  .feature-description {
    font-size: 1.1rem;
  }

  .feature-icon-large {
    width: 160px;
    height: 160px;
  }

  .feature-icon-large .el-icon {
    font-size: 60px;
  }
}

@media (max-width: 480px) {
  .feature-item {
    padding: 50px 0;
  }

  .feature-title {
    font-size: 1.6rem;
  }

  .feature-description {
    font-size: 1rem;
  }

  .feature-icon-large {
    width: 140px;
    height: 140px;
  }

  .feature-icon-large .el-icon {
    font-size: 50px;
  }
}
</style>
