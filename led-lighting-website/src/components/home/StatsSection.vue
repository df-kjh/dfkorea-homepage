<script setup lang="ts">
interface Stat {
  value: string
  label: string
  icon?: string
  description?: string
}
withDefaults(defineProps<{ stats?: Stat[] }>(), {
  stats: () => [
    { value: '10+', label: '회사 설립', icon: 'business' },
    { value: '30+', label: '다양한 제품군', icon: 'category' },
    { value: '50+', label: '인증', icon: 'verified' },
    { value: '300+', label: '설치 현장', icon: 'construction' },
  ],
})
// The user requested the original homepage figures and labels verbatim.
// Keep them visible in SSR instead of restoring the previous zero-first count animation.
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
  letter-spacing: -0.02em;
  font-size: var(--df-font-label, 14px);
  color: var(--df-muted, #625f50);
  flex-wrap: wrap;
}
.fact-index {
  letter-spacing: 0.04em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.fact dd {
  margin: 20px 0 10px;
  font-size: 43px;
  line-height: 1.12;
  letter-spacing: -0.06em;
  font-weight: 600;
}
.fact p {
  margin: 0;
  line-height: 1.7;
  letter-spacing: -0.025em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
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
    gap: 10px;
  }
  .fact dd {
    font-size: 35px;
    margin-top: 14px;
  }
}
</style>
