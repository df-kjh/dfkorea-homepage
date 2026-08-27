<template>
  <section class="history">
    <div class="container">
      <h2 class="section-title">{{ title }}</h2>
      <el-timeline>
        <el-timeline-item
          v-for="event in events"
          :key="event.year"
          :timestamp="event.year"
          placement="top"
          :type="event.type"
          size="large"
        >
          <el-card shadow="hover">
            <h3>{{ event.title }}</h3>
            <p>{{ event.description }}</p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>
  </section>
</template>

<script setup lang="ts">
interface TimelineEvent {
  year: string
  title: string
  description: string
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

interface Props {
  title: string
  events: TimelineEvent[]
}

defineProps<Props>()
</script>

<style scoped>
.history {
  padding: 100px 20px;
  background-color: var(--toss-light-gray);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 60px;
  letter-spacing: -0.02em;
}

.history :deep(.el-timeline-item__wrapper) {
  padding-left: 40px;
}

.history :deep(.el-card) {
  border-radius: 16px;
  border: 1px solid #e5e8eb;
  transition: transform 0.3s ease;
}

.history :deep(.el-card:hover) {
  transform: translateX(8px);
}

.history :deep(.el-card h3) {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 10px;
  letter-spacing: -0.01em;
}

.history :deep(.el-card p) {
  font-size: 1rem;
  color: var(--toss-gray);
  line-height: 1.6;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .history {
    padding: 60px 15px;
  }

  .section-title {
    font-size: 2rem;
    margin-bottom: 40px;
  }

  .history :deep(.el-timeline-item__wrapper) {
    padding-left: 30px;
  }

  .history :deep(.el-card h3) {
    font-size: 1.2rem;
  }

  .history :deep(.el-card p) {
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .section-title {
    font-size: 1.6rem;
  }

  .history :deep(.el-timeline-item__wrapper) {
    padding-left: 20px;
  }
}
</style>
