<template>
  <section class="page-header">
    <div class="header-content">
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  title: string
  subtitle: string
}

defineProps<Props>()
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, var(--toss-blue) 0%, #667eea 100%);
  padding: 120px 20px 80px;
  text-align: center;
  color: white;
}

.header-content h1 {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}

.header-content p {
  font-size: 1.5rem;
  font-weight: 400;
  opacity: 0.95;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    padding: 100px 15px 60px;
  }

  .header-content h1 {
    font-size: 2.5rem;
  }

  .header-content p {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 80px 15px 50px;
  }

  .header-content h1 {
    font-size: 2rem;
  }

  .header-content p {
    font-size: 1.1rem;
  }
}
</style>
