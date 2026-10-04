<script setup lang="ts">
const links = [
  { label: '회사소개', to: '/about' },
  { label: '제품', to: '/products' },
  { label: '인증', to: '/certificates' },
  { label: '소식', to: '/blog' },
]
</script>
<template>
  <footer class="public-footer">
    <div class="public-container">
      <div class="public-footer__top">
        <div>
          <p class="public-footer__eyebrow">LET’S MAKE LIGHT</p>
          <h2>당신의 공간에 필요한 빛.</h2>
          <p class="public-footer__description">제품과 조명에 관한 이야기를 들려주세요.</p>
        </div>
        <div class="public-footer__contact">
          <a href="tel:0325282953">032-528-2953 <span aria-hidden="true">↗</span></a
          ><a href="mailto:kjukym@dfkorealed.com"
            >kjukym@dfkorealed.com <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
      <div class="public-footer__middle">
        <NuxtLink to="/" class="public-footer__brand"
          >DF KOREA<span aria-hidden="true">.</span><small>LED LIGHTING</small></NuxtLink
        >
        <nav aria-label="하단 메뉴">
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink
          ><NuxtLink to="/about#history">회사 연혁</NuxtLink
          ><a href="https://blog.naver.com/kknkju" target="_blank" rel="noopener noreferrer"
            >NAVER BLOG <span aria-hidden="true">↗</span></a
          >
        </nav>
      </div>
      <div class="public-footer__wordmark" aria-hidden="true">DF KOREA<span>.</span></div>
      <div class="public-footer__base">
        <div>
          <strong>(주)디에프코리아</strong><span>인천광역시 부평구 평천로 199번길 53 A동 2층</span
          ><span>FAX 032-551-2954</span>
        </div>
        <p>© {{ new Date().getFullYear() }} DF KOREA</p>
      </div>
    </div>
  </footer>
</template>
<style scoped>
.public-footer {
  padding: 66px 0 26px;
  background: #10160d;
  color: #e6e7d9;
}
.public-footer__top {
  display: flex;
  justify-content: space-between;
  gap: 60px;
  padding-bottom: 52px;
  border-bottom: 1px solid #87936c30;
}
.public-footer__eyebrow {
  margin: 0 0 21px;
  color: #b9ae8b;
  font-family: Arial, sans-serif;
  font-size: 8px;
  letter-spacing: 0.15em;
}
.public-footer h2 {
  margin: 0;
  font-size: clamp(27px, 3.1vw, 44px);
  font-weight: 500;
  letter-spacing: -0.07em;
  line-height: 1.4;
}
.public-footer__description {
  margin: 17px 0 0;
  color: #849174;
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: -0.025em;
}
.public-footer__contact {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 11px;
  min-width: 0;
}
.public-footer__contact > a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 45px;
  color: #c8ceb4;
  font-family: Arial, sans-serif;
  font-size: clamp(17px, 1.6vw, 23px);
  line-height: 1.6;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}
.public-footer__contact > a > span {
  color: #b7a377;
  flex-shrink: 0;
}
.public-footer a:hover {
  color: #e4c99b;
}
.public-footer__middle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 35px;
  padding-top: 35px;
}
.public-footer__brand {
  font-family: Arial, sans-serif;
  font-size: 21px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.06em;
  color: #d8ddc9;
}
.public-footer__brand > span {
  color: #ae9770;
}
.public-footer__brand > small {
  display: block;
  margin-top: 6px;
  font-size: 6px;
  font-weight: 400;
  letter-spacing: 0.3em;
}
.public-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 15px 25px;
}
.public-footer nav > a {
  color: #859573;
  font-size: 10px;
  line-height: 1.5;
  text-decoration: none;
}
.public-footer__wordmark {
  margin: 64px 0 30px;
  font-family: Arial, sans-serif;
  font-size: clamp(62px, 15vw, 230px);
  font-weight: 650;
  line-height: 0.85;
  letter-spacing: -0.065em;
  color: #27381e;
  white-space: nowrap;
  overflow: hidden;
}
.public-footer__wordmark > span {
  color: #766a4e;
}
.public-footer__base {
  display: flex;
  justify-content: space-between;
  gap: 25px;
  padding-top: 23px;
  border-top: 1px solid #87936c25;
  color: #6f805e;
  font-size: 8px;
  line-height: 1.8;
}
.public-footer__base > div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 20px;
}
.public-footer__base strong {
  font-weight: 400;
}
.public-footer__base p {
  margin: 0;
  white-space: nowrap;
  font-family: Arial, sans-serif;
  font-size: 7px;
}
@media (max-width: 700px) {
  .public-footer {
    padding-top: 43px;
  }
  .public-footer__top {
    flex-direction: column;
    gap: 31px;
    padding-bottom: 34px;
  }
  .public-footer h2 {
    font-size: 28px;
  }
  .public-footer__description {
    font-size: 11px;
  }
  .public-footer__contact {
    max-width: 320px;
  }
  .public-footer__contact > a {
    font-size: 18px;
    gap: 22px;
  }
  .public-footer__middle {
    flex-direction: column;
    align-items: start;
    gap: 30px;
  }
  .public-footer nav {
    gap: 18px 26px;
  }
  .public-footer nav > a {
    font-size: 10px;
  }
  .public-footer__wordmark {
    margin-top: 46px;
    margin-bottom: 29px;
    font-size: 14.5vw;
  }
  .public-footer__base {
    flex-direction: column;
    gap: 17px;
  }
  .public-footer__base > div {
    flex-direction: column;
    gap: 3px;
  }
}
</style>
