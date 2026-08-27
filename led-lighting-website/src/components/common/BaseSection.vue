<template>
  <section :class="['base-section', bgColor && `bg-${bgColor}`, customClass]" :style="customStyle">
    <div class="section-container" :style="{ maxWidth: maxWidth }">
      <div v-if="$slots.header || title" class="section-header" :ref="headerRef">
        <slot name="header">
          <h2 v-if="title" class="section-title">{{ title }}</h2>
          <p v-if="subtitle" class="section-subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div class="section-content">
        <slot />
      </div>
      <div v-if="$slots.footer" class="section-footer">
        <slot name="footer" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  bgColor?: 'white' | 'gray' | 'light-gray' | 'transparent'
  maxWidth?: string
  customClass?: string
  customStyle?: Record<string, string>
  headerRef?: string
}

withDefaults(defineProps<Props>(), {
  bgColor: 'white',
  maxWidth: '1200px',
  customClass: '',
  customStyle: () => ({}),
})
</script>

<style scoped>
.base-section {
  padding: 140px 60px;
  transition: background-color 0.3s ease;
}

.bg-white {
  background-color: var(--toss-white, #ffffff);
}

.bg-gray,
.bg-light-gray {
  background-color: var(--toss-light-gray, #f2f4f6);
}

.bg-transparent {
  background-color: transparent;
}

.section-container {
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 80px;
}

.section-title {
  font-size: 3.5rem;
  font-weight: 700;
  color: var(--toss-dark, #191f28);
  margin-bottom: 20px;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.section-subtitle {
  font-size: 1.5rem;
  color: var(--toss-gray, #4e5968);
  line-height: 1.6;
  font-weight: 400;
}

.section-footer {
  text-align: center;
  margin-top: 60px;
}

/* Responsive */
@media (max-width: 992px) {
  .base-section {
    padding: 100px 60px;
  }

  .section-header {
    margin-bottom: 50px;
  }

  .section-title {
    font-size: 2.5rem;
  }

  .section-subtitle {
    font-size: 1.25rem;
  }
}

@media (max-width: 768px) {
  .base-section {
    padding: 80px 15px;
  }

  .section-header {
    margin-bottom: 40px;
  }

  .section-title {
    font-size: 2rem;
  }

  .section-subtitle {
    font-size: 1.1rem;
  }

  .section-footer {
    margin-top: 40px;
  }
}

@media (max-width: 480px) {
  .base-section {
    padding: 60px 15px;
  }

  .section-header {
    margin-bottom: 30px;
  }

  .section-title {
    font-size: 1.6rem;
  }

  .section-subtitle {
    font-size: 1rem;
  }
}
</style>
