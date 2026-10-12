<script setup lang="ts">
import KindaLogo from '@/components/common/site/KindaLogo.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
import KindaLightingDemo from './kinda/KindaLightingDemo.vue'
</script>
<template>
  <section class="home-kinda" id="kinda-section" aria-labelledby="kinda-title">
    <div class="public-container">
      <div class="kinda-main">
        <div class="kinda-copy">
          <div class="kinda-brand">
            <KindaLogo /><span class="kinda-category">스마트 조명 제어 시스템</span>
          </div>
          <h2 id="kinda-title">조명 운영을<br />간단하게.</h2>
          <p class="kinda-description">
            조명 상태를 한눈에 확인하고,<br />필요한 공간의 밝기를 간편하게 제어하세요.<br />주차장과
            시설을 위한 스마트 조명 솔루션, 킨다.
          </p>
          <PublicAction
            class="kinda-service-link"
            id="kinda-service-link"
            href="https://kinda.dfkorealed.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="킨다 서비스 알아보기, 새 창"
            >킨다 서비스 알아보기<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 15 15 5M5 5h10v10"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
          ></PublicAction>
        </div>
        <KindaLightingDemo />
      </div>
      <div class="kinda-features">
        <article class="kinda-feature">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="4"
              width="18"
              height="13"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 21h8M12 17v4M6 11h3l2-4 3 7 2-3h2"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div>
            <h3>현장을 한눈에</h3>
            <p>현장·층·도면을 기준으로<br />조명의 위치와 상태를 확인합니다.</p>
          </div>
        </article>
        <article class="kinda-feature">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 17h16M8 4v6M16 14v6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <div>
            <h3>필요한 곳을 원하는 밝기로</h3>
            <p>조명을 개별 또는 그룹으로 선택해<br />공간에 맞는 밝기를 설정합니다.</p>
          </div>
        </article>
        <article class="kinda-feature">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20V5M4 20h16M8 16v-5M12 16V7M16 16v-7M20 16V4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <div>
            <h3>운영을 기록으로</h3>
            <p>제어 이력과 운영 통계를 살펴보고<br />현장 관리에 필요한 정보를 확인합니다.</p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
<style scoped>
.home-kinda {
  padding: 92px 0 88px;
  background: #f0ece3;
  border-top: 1px solid #d5cec155;
  scroll-margin-top: 80px;
}
.kinda-main {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
  align-items: center;
  gap: 64px;
}
.kinda-copy {
  min-width: 0;
}
.kinda-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #15324a;
  margin-bottom: 29px;
}
.kinda-category {
  font-size: 14px;
  color: #6d7269;
  padding-left: 15px;
  border-left: 1px solid #bec2b5;
  margin-left: 7px;
  line-height: 1.6;
}
.kinda-copy h2 {
  font-size: clamp(40px, 4.6vw, 64px);
  line-height: 1.18;
  letter-spacing: -0.065em;
  font-weight: 600;
  color: #111710;
}
.kinda-description {
  font-size: 18px;
  line-height: 1.85;
  letter-spacing: -0.025em;
  color: #62665c;
  margin-top: 25px;
  max-width: 430px;
}
.kinda-copy > .kinda-service-link {
  margin-top: 29px;
}
.kinda-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 35px;
  margin-top: 65px;
  padding-top: 31px;
  border-top: 1px solid #cccabd;
}
.kinda-feature {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 13px;
}
.kinda-feature > svg {
  width: 25px;
  height: 25px;
  color: #256fa1;
  margin-top: 3px;
}
.kinda-feature h3 {
  font-size: 20px;
  line-height: 1.5;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: #293023;
}
.kinda-feature p {
  font-size: 16px;
  line-height: 1.75;
  letter-spacing: -0.025em;
  color: #717669;
  margin-top: 8px;
}

.kinda-service-link svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
@media (max-width: 1100px) {
  .kinda-main {
    gap: 35px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
  .kinda-copy h2 {
    font-size: 49px;
  }
  .kinda-category {
    font-size: 12px;
    padding-left: 11px;
    margin-left: 4px;
  }
  .kinda-features {
    gap: 25px;
  }
  .kinda-feature p {
    font-size: 15px;
  }
}
@media (max-width: 900px) {
  .kinda-main {
    grid-template-columns: minmax(0, 1fr);
    gap: 35px;
  }
  .kinda-copy {
    max-width: 640px;
  }
  .kinda-copy h2 {
    font-size: 56px;
  }
  .kinda-description {
    max-width: 600px;
  }
  .kinda-features {
    margin-top: 43px;
    gap: 20px;
  }
  .kinda-feature {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .kinda-feature h3 {
    font-size: 18px;
  }
  .kinda-feature p {
    font-size: 15px;
  }
}
@media (max-width: 767px) {
  .home-kinda {
    padding: 64px 0 62px;
  }
  .kinda-main {
    gap: 35px;
  }
  .kinda-brand {
    margin-bottom: 24px;
    gap: 8px;
  }
  .kinda-category {
    font-size: 13px;
    letter-spacing: -0.04em;
    padding-left: 12px;
    margin-left: 4px;
  }
  .kinda-copy h2 {
    font-size: clamp(40px, 10.8vw, 54px);
    line-height: 1.2;
  }
  .kinda-description {
    font-size: 17px;
    line-height: 1.8;
    margin-top: 21px;
  }
  .kinda-copy > .kinda-service-link {
    margin-top: 25px;
    min-height: 50px;
    padding: 14px 21px;
  }
  .kinda-features {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-top: 37px;
    padding-top: 29px;
  }
  .kinda-feature {
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 12px;
  }
  .kinda-feature h3 {
    font-size: 19px;
  }
  .kinda-feature p {
    font-size: 16px;
    margin-top: 5px;
  }
}
@media (max-width: 350px) {
  .kinda-category {
    font-size: 12px;
    padding-left: 9px;
    margin-left: 0;
  }
  .kinda-description br {
    display: none;
  }
  .kinda-service-link {
    font-size: 15px;
    gap: 19px;
  }
}
</style>
