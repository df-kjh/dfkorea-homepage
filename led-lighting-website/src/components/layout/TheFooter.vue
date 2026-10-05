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
.public-footer a:hover {
  color: #e4c99b;
}
.public-footer__middle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 35px;
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
  font-size: var(--df-font-meta, 13px);
  font-weight: 400;
  letter-spacing: 0.12em;
}
.public-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 15px 25px;
}
.public-footer nav > a {
  color: #b8c3a8;
  font-size: var(--df-font-control, 16px);
  font-weight: var(--df-weight-control, 600);
  line-height: 1.5;
  text-decoration: none;
  overflow-wrap: anywhere;
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
  color: #aab89a;
  font-size: var(--df-font-meta, 13px);
  line-height: 1.8;
}
.public-footer__base > div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 20px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.public-footer__base strong {
  font-weight: 400;
}
.public-footer__base p {
  margin: 0;
  font-size: var(--df-font-meta, 13px);
  overflow-wrap: anywhere;
}
@media (max-width: 1000px) {
  .public-footer__middle,
  .public-footer__base {
    flex-wrap: wrap;
  }
}
@media (max-width: 700px) {
  .public-footer {
    padding-top: 43px;
  }
  .public-footer__middle {
    flex-direction: column;
    align-items: start;
    gap: 30px;
  }
  .public-footer nav {
    gap: 18px 26px;
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
