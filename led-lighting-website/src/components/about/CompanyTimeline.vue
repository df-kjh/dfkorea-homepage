<script setup lang="ts">
import PublicAction from '@/components/common/site/PublicAction.vue'
interface TimelineItem {
  year: string
  month: string
  title: string
  description?: string
  isCurrent?: boolean
}
withDefaults(defineProps<{ title?: string; timeline?: TimelineItem[] }>(), {
  title: '빛을 만들어온 시간.',
  timeline: () => [
    { year: '2026', month: '08', title: '배선일체형 몰드바 출시' },
    { year: '2025', month: '12', title: '주차장용 팬던트 특허 등록' },
    { year: '2025', month: '05', title: '몰드바 V-CHECK 인증' },
    { year: '2025', month: '02', title: '몰드바 출시' },
    { year: '2023', month: '10', title: '주차장용 팬던트 디자인 등록' },
    { year: '2023', month: '03', title: '주차장용 팬던트 출시' },
    { year: '2021', month: '06', title: '친환경 인증 획득' },
    { year: '2021', month: '01', title: 'KS C 7657 센서 등기구 KS 인증 획득' },
    { year: '2017', month: '08', title: 'KS C 7653 매입 및 고정형 등기구 KS 인증 획득' },
    {
      year: '2017',
      month: '07',
      title: '중소기업중앙회 직접생산확인증명, 조달청 경쟁입찰 참가 자격 등록',
    },
    { year: '2017', month: '05', title: '한국산업기술진흥협회 기업부설연구소 인증' },
    { year: '2017', month: '04', title: '기술보증기금 벤처기업 인증' },
    { year: '2017', month: '01', title: '매입 및 고정형 등기구 고효율 인증 획득' },
    { year: '2016', month: '05', title: '(주)디에프코리아 법인 전환' },
    { year: '2013', month: '10', title: '디에프코리아 설립' },
  ],
})
</script>
<template>
  <section id="history" class="company-history" aria-labelledby="history-title">
    <div class="public-container company-history__layout">
      <div class="company-history__intro">
        <p class="public-eyebrow">COMPANY HISTORY / SINCE 2013</p>
        <h2 id="history-title">{{ title }}</h2>
        <p>제품과 기업의 주요 이력을<br />시간의 흐름을 따라 살펴보세요.</p>
        <PublicAction to="/certificates" variant="text"
          >등록된 인증 자료 보기 <span aria-hidden="true">↗</span></PublicAction
        >
      </div>
      <div>
        <ol class="company-history__entries">
          <li v-for="(item, index) in timeline" :key="`${item.year}-${item.month}-${index}`">
            <time :datetime="`${item.year}-${item.month}`"
              >{{ item.year }}<span>{{ item.month }}</span></time
            >
            <div>
              <h3>{{ item.title }}</h3>
              <p v-if="item.description">{{ item.description }}</p>
            </div>
          </li>
        </ol>
        <p class="company-history__note">
          인증 항목은 취득 시점의 연혁입니다. 등록 문서는 인증 페이지에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.company-history {
  padding: 77px 0 92px;
  background: var(--df-paper, #f0ece3);
}
.company-history__layout {
  display: grid;
  gap: 100px;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.2fr);
}
.company-history__intro h2 {
  margin: 26px 0 0;
  font-size: clamp(31px, 3.1vw, 44px);
  line-height: 1.4;
  letter-spacing: -0.06em;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.company-history__intro > p:not(.public-eyebrow) {
  margin: 24px 0 0;
  line-height: 1.9;
  letter-spacing: -0.025em;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
}
.company-history__intro .public-action {
  margin-top: 24px;
}
.company-history__entries {
  margin: 0;
  padding: 0;
  list-style: none;
}
.company-history__entries > li {
  display: grid;
  gap: 32px;
  padding: 25px 0;
  border-bottom: 1px solid var(--df-line);
  grid-template-columns: 96px minmax(0, 1fr);
}
.company-history__entries > li:first-child {
  padding-top: 0;
}
.company-history time {
  display: flex;
  gap: 9px;
  align-items: baseline;
  padding-top: 1px;
  color: #4e5b3b;
  font-family: Arial, sans-serif;
  font-size: 18px;
  line-height: 1.5;
}
.company-history time > span {
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.company-history h3 {
  margin: 0;
  line-height: 1.8;
  letter-spacing: -0.025em;
  font-size: var(--df-font-body, 16px);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.company-history__entries p {
  margin: 11px 0 0;
  line-height: 1.8;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
.company-history__note {
  margin: 22px 0 0;
  line-height: 1.8;
  letter-spacing: -0.02em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
@media (max-width: 850px) {
  .company-history__layout {
    gap: 50px;
  }
}
@media (max-width: 700px) {
  .company-history {
    padding: 44px 0 55px;
  }
  .company-history__layout {
    grid-template-columns: 1fr;
    gap: 38px;
  }
  .company-history__intro h2 {
    font-size: 32px;
    margin-top: 19px;
  }
  .company-history__intro > p:not(.public-eyebrow) {
    margin-top: 19px;
  }
  .company-history__intro .public-action {
    margin-top: 16px;
  }
  .company-history__entries > li {
    grid-template-columns: 85px minmax(0, 1fr);
    gap: 18px;
    padding: 21px 0;
  }
  .company-history time {
    font-size: 16px;
    gap: 7px;
  }
  .company-history h3 {
    line-height: 1.9;
  }
}
</style>
