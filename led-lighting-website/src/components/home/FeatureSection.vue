<script setup lang="ts">
import PublicAction from '@/components/common/site/PublicAction.vue'
const emit = defineEmits<{ ctaClick: [] }>()
const features = [
  {
    title: '빛을 만드는 기술.',
    description:
      '조명은 제품의 구조와 사양에서 시작됩니다. 디에프코리아의 LED 조명을 살펴보고, 필요한 공간에 맞는 제품 구성을 찾아보세요.',
    images: ['/images/home/home-feature-1.webp', '/images/home/home-feature-2.webp'],
    label: 'MADE FOR LIGHT',
  },
  {
    title: '공간에 맞는 감각.',
    description:
      '밝기와 색온도, 조명의 형태가 공간의 인상을 만듭니다. 제품 자료에 등록된 사양과 선택 항목을 비교하며 원하는 분위기를 계획합니다.',
    images: ['/images/home/home-feature-3.jpg', '/images/home/home-feature-4.jpg'],
    label: 'LIGHT & SPACE',
  },
  {
    title: '선정부터 상담까지.',
    description:
      '설치 환경과 필요한 수량을 알려주세요. 문의 내용에 맞춰 제품 구성과 사양을 함께 확인하고, 조명 선택에 필요한 이야기를 나눕니다.',
    images: ['/images/home/home-feature-5.webp', '/images/home/home-feature-6.webp'],
    label: 'LET’S TALK LIGHT',
  },
]
</script>
<template>
  <section class="home-features">
    <div class="public-container">
      <div class="features-intro">
        <p class="section-kicker">FROM LIGHT TO LIFE</p>
        <h2>빛에서 시작되는<br />공간의 변화.</h2>
        <span>DF KOREA / LED LIGHTING</span>
      </div>
      <article
        v-for="(feature, index) in features"
        :key="feature.label"
        class="feature-row"
        :class="{ 'feature-row--reverse': index === 1 }"
      >
        <div class="feature-copy">
          <p class="section-kicker">
            <span>0{{ index + 1 }}</span
            >{{ feature.label }}
          </p>
          <h3>{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
          <PublicAction variant="text" @click="emit('ctaClick')"
            >제품 살펴보기 <span aria-hidden="true">↗</span></PublicAction
          >
        </div>
        <div class="feature-visual">
          <div class="feature-images">
            <img
              v-for="(image, imageIndex) in feature.images"
              :key="image"
              :src="image"
              :alt="`조명 적용 공간 참고 이미지 ${index * 2 + imageIndex + 1}`"
              loading="lazy"
            />
          </div>
          <p>LIGHT IN EVERYDAY SPACES</p>
        </div>
      </article>
    </div>
  </section>
</template>
<style scoped>
.home-features {
  padding: 92px 0 42px;
  background: var(--df-paper, #f0ece3);
  color: var(--df-ink, #080906);
}
.section-kicker {
  letter-spacing: 0.16em;
  line-height: 1.6;
  margin: 0;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
.features-intro {
  position: relative;
  padding-bottom: 56px;
  border-bottom: 1px solid var(--df-line, #d5cec1);
}
.features-intro h2 {
  font-size: clamp(38px, 4.3vw, 62px);
  line-height: 1.18;
  letter-spacing: -0.075em;
  margin: 24px 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.features-intro > span {
  position: absolute;
  right: 0;
  bottom: 60px;
  letter-spacing: 0.13em;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.feature-row {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  align-items: center;
  gap: clamp(45px, 7vw, 110px);
  padding: 74px 0;
  border-bottom: 1px solid var(--df-line, #d5cec1);
}
.feature-row:last-child {
  border-bottom: 0;
}
.feature-row--reverse {
  grid-template-columns: 1.15fr 0.85fr;
}
.feature-row--reverse .feature-copy {
  order: 2;
}
.feature-row--reverse .feature-visual {
  order: 1;
}
.feature-copy > .section-kicker {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.feature-copy > .section-kicker > span {
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
}
.feature-copy h3 {
  font-size: clamp(28px, 3vw, 42px);
  letter-spacing: -0.065em;
  line-height: 1.25;
  margin: 26px 0 20px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.feature-description {
  line-height: 2;
  letter-spacing: -0.03em;
  max-width: 355px;
  margin: 0 0 25px;
  font-size: var(--df-font-body, 16px);
  font-weight: var(--df-weight-body, 400);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
.feature-copy :deep(.public-action) {
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
}
.feature-visual {
  min-width: 0;
}
.feature-images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 14px;
}
.feature-images img {
  width: 100%;
  height: auto;
  aspect-ratio: 3/4;
  object-fit: cover;
  filter: saturate(0.78);
}
.feature-images img + img {
  margin-top: 42px;
}
.feature-visual > p {
  letter-spacing: 0.16em;
  margin: 18px 0 0;
  font-size: var(--df-font-meta, 13px);
  color: var(--df-muted, #625f50);
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .home-features {
    padding: 61px 0 10px;
  }
  .features-intro {
    padding-bottom: 36px;
  }
  .features-intro h2 {
    font-size: 38px;
    margin-top: 20px;
  }
  .features-intro > span {
    display: none;
  }
  .feature-row,
  .feature-row--reverse {
    grid-template-columns: 1fr;
    gap: 31px;
    padding: 44px 0;
  }
  .feature-row--reverse .feature-copy,
  .feature-row--reverse .feature-visual {
    order: initial;
  }
  .feature-copy h3 {
    font-size: 30px;
    margin: 21px 0 17px;
  }
  .feature-description {
    margin-bottom: 18px;
    max-width: none;
  }
  .feature-images {
    gap: 10px;
  }
  .feature-images img + img {
    margin-top: 27px;
  }
  .feature-visual > p {
    margin-top: 14px;
  }
}
</style>
