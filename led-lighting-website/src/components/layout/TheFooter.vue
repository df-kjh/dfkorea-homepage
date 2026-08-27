<script setup lang="ts">
const footerLinks = {
  pages: [
    { name: '홈', href: '/' },
    { name: '회사소개', href: '/about' },
    { name: '인증 현황', href: '/certificates' },
    { name: '제품소개', href: '/products' },
    { name: '회사소식', href: '/blog' },
  ],
  company: [
    { name: '회사 개요', href: '/about' },
    { name: '회사 연혁', href: '/about#history' },
  ],
  products: [{ name: '제품 전체보기', href: '/products' }],
}

const socialLinks = [{ name: 'Blog', icon: 'tag', href: 'https://blog.naver.com/kknkju' }]
</script>

<template>
  <footer class="bg-background-dark border-t border-white/10 py-20 px-6">
    <div class="max-w-screen-xl mx-auto">
      <!-- Main Footer Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
        <!-- Logo & Description -->
        <div class="col-span-2 lg:col-span-2">
          <h3 class="text-white text-2xl font-bold mb-4">(주)디에프코리아</h3>
          <p class="text-white/40 text-sm leading-relaxed mb-6">
            업계 최고 품질의 제품, (주)디에프코리아가 만들어갑니다.
          </p>
          <div class="flex gap-3 mb-6">
            <a
              v-for="social in socialLinks"
              :key="social.name"
              :href="social.href"
              :aria-label="social.name"
              class="size-10 rounded-full bg-white/5 hover:bg-primary hover:text-background-dark flex items-center justify-center text-white/60 transition-all"
            >
              <span class="material-symbols-outlined text-lg">{{ social.icon }}</span>
            </a>
          </div>
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-white/60 text-sm">
              <span class="material-symbols-outlined text-base">call</span>
              <span>032-528-2953</span>
            </div>
            <div class="flex items-center gap-2 text-white/60 text-sm">
              <span class="material-symbols-outlined text-base">fax</span>
              <span>032-551-2954</span>
            </div>
            <div class="flex items-center gap-2 text-white/60 text-sm">
              <span class="material-symbols-outlined text-base">mail</span>
              <a href="mailto:kjukym@dfkorealed.com" class="hover:text-primary transition-colors"
                >kjukym@dfkorealed.com</a
              >
            </div>
            <div class="flex items-start gap-2 text-white/60 text-sm">
              <span class="material-symbols-outlined text-base mt-0.5">location_on</span>
              <span>인천광역시 부평구 평천로 199번길 53 A동 2층</span>
            </div>
          </div>
        </div>

        <!-- Pages -->
        <div>
          <h4 class="text-white font-bold mb-4">페이지</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.pages" :key="link.name">
              <a
                :href="link.href"
                class="text-white/60 hover:text-primary text-sm transition-colors"
              >
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Company -->
        <div>
          <h4 class="text-white font-bold mb-4">회사</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.company" :key="link.name">
              <a
                :href="link.href"
                class="text-white/60 hover:text-primary text-sm transition-colors"
              >
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Products -->
        <div>
          <h4 class="text-white font-bold mb-4">제품</h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.products" :key="link.name">
              <a
                :href="link.href"
                class="text-white/60 hover:text-primary text-sm transition-colors"
              >
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div
        class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <p class="text-white/20 text-xs">
          © {{ new Date().getFullYear() }} DF KOREA. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
