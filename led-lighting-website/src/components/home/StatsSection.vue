<script setup lang="ts">
interface Stat {
  value: string
  label: string
  icon?: string
  description?: string
}
withDefaults(defineProps<{ stats?: Stat[] }>(), {
  stats: () => [
    { value: '2013', label: '설립', description: '디에프코리아의 시작' },
    { value: 'LED', label: '조명 제조', description: '빛을 개발하고 생산합니다' },
    { value: '공간', label: '제품 선택', description: '설치 환경에 맞는 조명' },
    { value: '상담', label: '필요한 구성', description: '제품과 사양을 함께 확인' },
  ],
})
// These are source-backed identities, not animated estimates of installations,
// certificates or product counts. Values remain readable before hydration.
</script>
<template>
  <section class="home-facts" aria-label="디에프코리아 소개">
    <div class="public-container">
      <dl class="facts-grid">
        <div v-for="(stat, index) in stats" :key="stat.label" class="fact">
          <dt>
            <span class="fact-index">0{{ index + 1 }}</span
            >{{ stat.label }}
          </dt>
          <dd>{{ stat.value }}</dd>
          <p v-if="stat.description">{{ stat.description }}</p>
        </div>
      </dl>
    </div>
  </section>
</template>
<style scoped>
.home-facts {
  padding: 56px 0 60px;
  background: var(--df-paper, #f0ece3);
  color: var(--df-ink, #080906);
  border-bottom: 1px solid var(--df-line, #d5cec1);
}
.facts-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
  margin: 0;
}
.fact {
  border-left: 1px solid #bdb3a240;
  padding-left: 25px;
}
.fact:first-child {
  border-left: 0;
  padding-left: 0;
}
.fact dt {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  color: #77715f;
  letter-spacing: -0.02em;
}
.fact-index {
  font-size: 8px;
  color: #aa9d84;
  letter-spacing: 0.04em;
}
.fact dd {
  margin: 20px 0 10px;
  font-size: 43px;
  line-height: 1.12;
  letter-spacing: -0.06em;
  font-weight: 500;
}
.fact p {
  margin: 0;
  color: #8b8371;
  font-size: 11px;
  line-height: 1.7;
  letter-spacing: -0.025em;
}
@media (max-width: 700px) {
  .home-facts {
    padding: 38px 0 42px;
  }
  .facts-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px 24px;
  }
  .fact {
    padding-left: 0;
    border-left: 0;
  }
  .fact dt {
    font-size: 10px;
    gap: 10px;
  }
  .fact dd {
    font-size: 35px;
    margin-top: 14px;
  }
  .fact p {
    font-size: 10px;
  }
}
</style>
