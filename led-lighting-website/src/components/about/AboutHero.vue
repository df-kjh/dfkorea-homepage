<script setup lang="ts">
import { computed } from 'vue'
import PublicPageHeader from '@/components/common/site/PublicPageHeader.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
const props = withDefaults(
  defineProps<{
    label?: string
    title?: string
    subtitle?: string
    heroImage?: string
    description?: string
  }>(),
  {
    label: 'ABOUT DF KOREA',
    title: '공간의 빛을,\n함께 만듭니다.',
    subtitle: '',
    heroImage: '',
    description:
      '디에프코리아는 2013년부터 다양한 현장에 필요한 LED 조명을 만들어왔습니다.\n교육시설과 주차장, 상업·산업 공간까지 사용 환경을 살피고, 제품 개발부터 생산과 품질관리까지 이어갑니다.\n공간에 맞는 제품과 기능을 함께 이야기합니다.',
  },
)
// Older callers may supply a line-break tag; render it as text rather than HTML.
const heading = computed(() => props.title.replace(/<br\s*\/?>/gi, '\n'))
</script>
<template>
  <section class="about-hero">
    <PublicPageHeader
      :title="heading"
      :description="
        subtitle ||
        '작은 광원에서 우리의 일상까지.\n빛을 만드는 기술과 공간을 생각하는 마음으로\n디에프코리아의 조명은 시작됩니다.'
      "
      ><template #actions
        ><PublicAction to="/products" variant="text"
          >빛을 담은 제품 만나보기 <span aria-hidden="true">↗</span></PublicAction
        ></template
      ></PublicPageHeader
    >
    <div class="public-container">
      <div v-if="heroImage" class="about-supplied-image">
        <img :src="heroImage" alt="디에프코리아 소개 자료" />
      </div>
      <div v-else class="about-light-study" aria-hidden="true">
        <div class="about-light-study__ribbon"></div>
        <div class="about-light-study__ribbon about-light-study__ribbon--soft"></div>
        <p>LIGHT, IN A NEW FORM.</p>
        <span>DF KOREA / LED LIGHTING</span>
      </div>
      <div class="about-description">
        <div>
          <p class="public-eyebrow">MADE OF LIGHT</p>
          <p class="about-description__name">(주)디에프코리아</p>
          <p class="about-description__since">2013년 설립 · 인천</p>
        </div>
        <p class="about-description__text">{{ description }}</p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.about-hero {
  background: var(--df-paper, #f0ece3);
}
.about-light-study {
  position: relative;
  height: 350px;
  overflow: hidden;
  background: radial-gradient(ellipse at 85% 60%, #51340f3d, transparent 50%), #0c1008;
  color: #b8b99e;
}
.about-light-study__ribbon {
  position: absolute;
  left: -15%;
  top: 49%;
  width: 130%;
  height: 110%;
  border: 2px solid #ead3a2;
  border-radius: 49%;
  transform: rotate(-14deg);
  box-shadow:
    0 -3px 9px #ecd5a280,
    0 -15px 55px #ad854e32,
    inset 0 1px 20px #bc8d381f;
}
.about-light-study__ribbon--soft {
  top: 58%;
  height: 96%;
  border-width: 12px;
  filter: blur(9px);
  opacity: 0.5;
}
.about-light-study > p {
  position: absolute;
  left: 37px;
  bottom: 32px;
  margin: 0;
  font-family: Arial, sans-serif;
  letter-spacing: 0.2em;
  font-size: var(--df-font-meta, 13px);
}
.about-light-study > span {
  position: absolute;
  right: 37px;
  top: 31px;
  font-family: Arial, sans-serif;
  letter-spacing: 0.15em;
  color: #7a876c;
  font-size: var(--df-font-meta, 13px);
}
.about-supplied-image {
  overflow: hidden;
}
.about-supplied-image img {
  width: 100%;
  max-height: 500px;
  object-fit: cover;
}
.about-description {
  display: grid;
  gap: 80px;
  padding: 69px 0 76px;
  border-bottom: 1px solid var(--df-line);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
}
.about-description__name {
  margin: 22px 0 0;
  font-size: 22px;
  line-height: 1.5;
  letter-spacing: -0.04em;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.about-description__since {
  margin: 12px 0 0;
  line-height: 1.6;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.about-description__text {
  margin: 0;
  line-height: 2;
  letter-spacing: -0.025em;
  white-space: pre-line;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .about-light-study {
    height: 240px;
  }
  .about-light-study__ribbon {
    width: 190%;
    height: 90%;
    left: -45%;
    top: 52%;
    transform: rotate(-24deg);
  }
  .about-light-study__ribbon--soft {
    top: 62%;
  }
  .about-light-study > p {
    left: 22px;
    bottom: 24px;
  }
  .about-light-study > span {
    right: 22px;
    top: 23px;
  }
  .about-description {
    grid-template-columns: 1fr;
    gap: 30px;
    padding: 39px 0 43px;
  }
  .about-description__name {
    font-size: 19px;
    margin-top: 17px;
  }
  .about-description__text {
    line-height: 1.95;
  }
}
</style>
