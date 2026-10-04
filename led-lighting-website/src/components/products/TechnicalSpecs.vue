<script setup lang="ts">
interface TechSpec {
  label: string
  value: string
}

interface Props {
  title?: string
  specs: TechSpec[]
}

withDefaults(defineProps<Props>(), {
  title: '제품 상세 정보',
})
</script>

<template>
  <section v-if="specs.length" class="df-technical">
    <div class="df-technical__heading">
      <p>REGISTERED DETAILS</p>
      <h2>{{ title }}</h2>
      <span>제품 자료에 등록된 사양과 선택 항목</span>
    </div>
    <dl>
      <div v-for="spec in specs" :key="spec.label">
        <dt>{{ spec.label }}</dt>
        <dd>{{ spec.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.df-technical {
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 80px;
  padding: 70px max(28px, calc((100vw - 1280px) / 2));
  background: #e8e2d5;
  border-top: 1px solid #d8cfbf;
}
.df-technical__heading p {
  font-size: 9px;
  letter-spacing: 0.15em;
  color: #8a7a60;
  margin-bottom: 19px;
}
.df-technical h2 {
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.04em;
  margin-bottom: 19px;
}
.df-technical__heading span {
  font-size: 12px;
  color: #827765;
}
.df-technical dl {
  margin: 0;
  border-top: 1px solid #c8bdaa;
}
.df-technical dl > div {
  display: grid;
  grid-template-columns: 115px minmax(0, 1fr);
  gap: 20px;
  padding: 17px 0;
  border-bottom: 1px solid #d4c9b7;
}
.df-technical dt {
  font-size: 11px;
  color: #8a7960;
  line-height: 1.7;
}
.df-technical dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
@media (max-width: 800px) {
  .df-technical {
    grid-template-columns: 1fr;
    gap: 35px;
    padding: 48px 24px;
  }
  .df-technical dl > div {
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
