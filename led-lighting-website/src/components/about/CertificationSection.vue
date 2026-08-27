<template>
  <section class="certifications">
    <div class="container">
      <h2 class="section-title">{{ title }}</h2>
      <el-row :gutter="20" justify="center">
        <el-col :xs="12" :sm="8" :md="4" v-for="cert in certifications" :key="cert.id">
          <el-card shadow="hover" class="cert-card">
            <el-icon :size="50"><Medal /></el-icon>
            <p>{{ cert.name }}</p>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Medal } from '@element-plus/icons-vue'

interface Certification {
  id: number
  name: string
}

interface Props {
  title: string
  certifications: Certification[]
}

defineProps<Props>()
</script>

<style scoped>
.certifications {
  padding: 100px 20px;
  background-color: var(--toss-white);
}

.container {
  max-width: 1200px;
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

.cert-card {
  text-align: center;
  padding: 30px 15px;
  border-radius: 16px;
  transition: transform 0.3s ease;
  border: 1px solid #e5e8eb;
  height: 100%;
}

.cert-card:hover {
  transform: translateY(-8px);
}

.cert-card .el-icon {
  color: var(--toss-blue);
  margin-bottom: 15px;
}

.cert-card p {
  font-size: 1rem;
  font-weight: 600;
  color: var(--toss-dark);
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .certifications {
    padding: 60px 15px;
  }

  .section-title {
    font-size: 2rem;
    margin-bottom: 40px;
  }

  .cert-card {
    padding: 20px 10px;
  }

  .cert-card .el-icon {
    font-size: 40px;
  }

  .cert-card p {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .section-title {
    font-size: 1.6rem;
  }

  .cert-card p {
    font-size: 0.85rem;
  }
}
</style>
