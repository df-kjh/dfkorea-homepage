<template>
  <section class="company-intro">
    <div class="container">
      <el-row :gutter="40" align="middle">
        <el-col :xs="24" :md="12">
          <div class="intro-image">
            <img :src="imageUrl" :alt="imageAlt" />
          </div>
        </el-col>
        <el-col :xs="24" :md="12">
          <div class="intro-text">
            <h2>{{ title }}</h2>
            <p v-for="(paragraph, index) in paragraphs" :key="index">
              {{ paragraph }}
            </p>
            <div class="stats">
              <div class="stat-item" v-for="stat in stats" :key="stat.label">
                <h3>{{ stat.value }}</h3>
                <p>{{ stat.label }}</p>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Stat {
  value: string
  label: string
}

interface Props {
  title: string
  paragraphs: string[]
  stats: Stat[]
  imageUrl: string
  imageAlt: string
}

defineProps<Props>()
</script>

<style scoped>
.company-intro {
  padding: 120px 20px;
  background-color: var(--toss-white);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.intro-image {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
}

.intro-image img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s ease;
}

.intro-image:hover img {
  transform: scale(1.05);
}

.intro-text h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 30px;
  letter-spacing: -0.02em;
}

.intro-text p {
  font-size: 1.2rem;
  color: var(--toss-gray);
  line-height: 1.8;
  margin-bottom: 20px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  margin-top: 50px;
}

.stat-item {
  text-align: center;
}

.stat-item h3 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--toss-blue);
  margin-bottom: 10px;
}

.stat-item p {
  font-size: 1rem;
  color: var(--toss-gray);
  margin: 0;
}

/* Responsive */
@media (max-width: 992px) {
  .company-intro {
    padding: 80px 20px;
  }

  .intro-text h2 {
    font-size: 2rem;
    margin-top: 30px;
  }

  .intro-text p {
    font-size: 1.1rem;
  }

  .stats {
    margin-top: 40px;
  }

  .stat-item h3 {
    font-size: 2rem;
  }
}

@media (max-width: 768px) {
  .company-intro {
    padding: 60px 15px;
  }

  .intro-text h2 {
    font-size: 1.8rem;
    text-align: center;
  }

  .intro-text p {
    font-size: 1rem;
  }

  .stats {
    gap: 20px;
  }

  .stat-item h3 {
    font-size: 1.8rem;
  }

  .stat-item p {
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .stats {
    grid-template-columns: 1fr;
    gap: 30px;
  }

  .stat-item h3 {
    font-size: 2rem;
  }
}
</style>
