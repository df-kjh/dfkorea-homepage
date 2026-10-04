<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const menuItems = [
  { path: '/about', label: '회사소개' },
  { path: '/products', label: '제품' },
  { path: '/certificates', label: '인증' },
  { path: '/blog', label: '소식' },
]
const isMobileMenuOpen = ref(false)
const menuToggle = ref<HTMLButtonElement | null>(null)
const navigation = ref<HTMLElement | null>(null)
const heroVisible = ref(true)
const isHome = computed(() => route.path === '/')
const tone = computed(() => (isHome.value && heroVisible.value ? 'ink' : 'paper'))
const isActive = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
let mounted = false
let observationVersion = 0
let heroObserver: IntersectionObserver | null = null
let domObserver: MutationObserver | null = null
let observedHero: HTMLElement | null = null

function closeMobileMenu(returnFocus = false) {
  isMobileMenuOpen.value = false
  if (returnFocus) menuToggle.value?.focus()
}
function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMenuOpen.value) {
    event.preventDefault()
    closeMobileMenu(true)
  }
}
function handleOutside(event: PointerEvent) {
  if (
    isMobileMenuOpen.value &&
    event.target instanceof Node &&
    !navigation.value?.contains(event.target)
  )
    closeMobileMenu()
}
function handleResize() {
  if (window.innerWidth >= 768) closeMobileMenu()
}
function updateHeroPosition() {
  if (!isHome.value || !observedHero) return
  const rect = observedHero.getBoundingClientRect()
  heroVisible.value = rect.bottom > 80 && rect.top < window.innerHeight
}
function disconnectHero() {
  heroObserver?.disconnect()
  domObserver?.disconnect()
  heroObserver = null
  domObserver = null
  observedHero = null
}
async function observeHomeHero() {
  const version = ++observationVersion
  disconnectHero()
  heroVisible.value = isHome.value
  if (!mounted || !isHome.value) return
  await nextTick()
  if (!mounted || version !== observationVersion || !isHome.value) return
  const root = document.getElementById('public-content') || document.body
  const refresh = () => {
    if (!mounted || !isHome.value || version !== observationVersion) return
    const hero = root.querySelector<HTMLElement>('[data-light-hero]')
    if (hero === observedHero) {
      if (!hero) heroVisible.value = false
      return
    }
    heroObserver?.disconnect()
    observedHero = hero
    if (!hero) {
      heroVisible.value = false
      return
    }
    updateHeroPosition()
    if ('IntersectionObserver' in window) {
      heroObserver = new IntersectionObserver(
        (entries) => {
          if (isHome.value && observedHero === hero && version === observationVersion)
            heroVisible.value = Boolean(entries[0]?.isIntersecting)
        },
        { rootMargin: '-80px 0px 0px 0px', threshold: 0 },
      )
      heroObserver.observe(hero)
    }
  }
  refresh()
  // Nuxt can resolve the incoming page after the route watch. Observe DOM
  // replacement so returning to an async home never keeps an old Hero target.
  domObserver = new MutationObserver(refresh)
  domObserver.observe(root, { childList: true, subtree: true })
}
watch(
  () => route.path,
  () => {
    closeMobileMenu()
    void observeHomeHero()
  },
  { flush: 'post' },
)
onMounted(() => {
  mounted = true
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('pointerdown', handleOutside, { passive: true })
  window.addEventListener('resize', handleResize, { passive: true })
  window.addEventListener('scroll', updateHeroPosition, { passive: true })
  void observeHomeHero()
})
onBeforeUnmount(() => {
  mounted = false
  observationVersion++
  disconnectHero()
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('pointerdown', handleOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', updateHeroPosition)
})
</script>

<template>
  <header ref="navigation" class="public-nav" data-site-header :data-tone="tone">
    <div class="public-nav__bar">
      <NuxtLink to="/" class="public-brand" aria-label="DF KOREA, 홈" @click="closeMobileMenu()">
        <img
          class="public-brand__logo"
          src="/branding/df-korea-logo-white.png"
          alt="DF KOREA — DEAR FRIEND KOREA"
          width="128"
          height="64"
        />
      </NuxtLink>
      <nav class="public-nav__desktop" aria-label="주요 메뉴">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          :class="{ 'is-current': isActive(item.path) }"
          >{{ item.label }}</NuxtLink
        >
      </nav>
      <span class="public-nav__caption" aria-hidden="true">LIGHT, IN A NEW FORM.</span>
      <button
        ref="menuToggle"
        class="public-nav__toggle"
        type="button"
        data-menu-toggle
        :aria-expanded="isMobileMenuOpen"
        aria-controls="public-mobile-navigation"
        :aria-label="isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'"
        @click="isMobileMenuOpen = !isMobileMenuOpen"
      >
        <span aria-hidden="true"></span><span aria-hidden="true"></span>
      </button>
    </div>
    <nav
      v-show="isMobileMenuOpen"
      id="public-mobile-navigation"
      class="public-nav__mobile"
      aria-label="모바일 주요 메뉴"
    >
      <NuxtLink
        v-for="(item, index) in menuItems"
        :key="item.path"
        :to="item.path"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        :class="{ 'is-current': isActive(item.path) }"
        @click="closeMobileMenu()"
        ><span class="public-nav__number" aria-hidden="true">0{{ index + 1 }}</span
        >{{ item.label }}<span aria-hidden="true">↗</span></NuxtLink
      >
    </nav>
  </header>
</template>

<style scoped>
.public-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  color: #293023;
  background: #f0ece3f2;
  border-bottom: 1px solid #6a795322;
  backdrop-filter: blur(15px);
  transition:
    background-color 0.2s,
    color 0.2s;
}
.public-nav[data-tone='ink'] {
  color: #eeeddf;
  background: #0809069e;
  border-bottom-color: #a2ad8b18;
}
.public-nav__bar {
  height: 80px;
  max-width: 1440px;
  margin: auto;
  padding-inline: clamp(24px, 5vw, 76px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 35px;
}
.public-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 64px;
  border-radius: 4px;
  /* Keep the requested white logo legible when the header switches to paper. */
  background: #080906;
  text-decoration: none;
  flex-shrink: 0;
}
.public-nav[data-tone='ink'] .public-brand {
  background: transparent;
}
.public-brand__logo {
  display: block;
  width: 128px;
  height: 64px;
  object-fit: contain;
}
.public-nav__desktop {
  display: flex;
  align-items: center;
  gap: 39px;
}
.public-nav__desktop > a {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 44px;
  color: inherit;
  text-decoration: none;
  font-size: 11px;
  line-height: 1.5;
  letter-spacing: -0.025em;
}
.public-nav__desktop > a.is-current::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 0;
  right: 0;
  height: 1px;
  background: #a6844e;
}
.public-nav__desktop > a:hover,
.public-nav__mobile > a:hover {
  color: #a4844f;
}
.public-nav__caption {
  font-family: Arial, sans-serif;
  font-size: 7px;
  letter-spacing: 0.12em;
  opacity: 0.5;
}
.public-nav__toggle {
  display: none;
  position: relative;
  width: 42px;
  height: 42px;
  min-width: 42px;
  border: 1px solid #96a07d45;
  background: transparent;
  color: inherit;
}
.public-nav__toggle > span {
  position: absolute;
  left: 12px;
  top: 20px;
  width: 17px;
  height: 1px;
  background: currentColor;
  transition: transform 0.2s;
}
.public-nav__toggle > span:first-child {
  transform: translateY(-3px);
}
.public-nav__toggle > span:last-child {
  transform: translateY(3px);
}
.public-nav__toggle[aria-expanded='true'] > span:first-child {
  transform: rotate(45deg);
}
.public-nav__toggle[aria-expanded='true'] > span:last-child {
  transform: rotate(-45deg);
}
.public-nav__mobile {
  display: none;
}
.public-nav a:focus-visible,
.public-nav button:focus-visible {
  outline: 2px solid #b99a65;
  outline-offset: 5px;
}
@media (max-width: 1000px) {
  .public-nav__caption {
    display: none;
  }
  .public-nav__desktop {
    gap: 31px;
  }
}
@media (max-width: 767px) {
  .public-nav__bar {
    padding-inline: 24px;
    gap: 20px;
  }
  .public-brand {
    width: 122px;
    height: 58px;
  }
  .public-brand__logo {
    width: 112px;
    height: 58px;
  }
  .public-nav__desktop {
    display: none;
  }
  .public-nav__toggle {
    display: block;
  }
  .public-nav__mobile {
    display: flex;
    flex-direction: column;
    padding: 10px 24px 20px;
    border-top: 1px solid #96a07d2b;
    background: #f0ece3;
  }
  .public-nav[data-tone='ink'] .public-nav__mobile {
    background: #11180eee;
  }
  .public-nav__mobile > a {
    display: flex;
    align-items: center;
    gap: 22px;
    min-height: 55px;
    color: inherit;
    border-bottom: 1px solid #96a07d2b;
    font-size: 15px;
    text-decoration: none;
  }
  .public-nav__mobile > a:last-child {
    border-bottom: 0;
  }
  .public-nav__mobile > a.is-current {
    color: #a4834f;
  }
  .public-nav__mobile > a > span:last-child {
    margin-left: auto;
    font-family: Arial, sans-serif;
    font-size: 18px;
  }
  .public-nav__number {
    color: #929779;
    font-family: Arial, sans-serif;
    font-size: 8px;
  }
}
@media (max-width: 350px) {
  .public-nav__bar {
    padding-inline: 20px;
  }
  .public-nav__mobile {
    padding-inline: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .public-nav,
  .public-nav__toggle > span {
    transition: none;
  }
}
</style>
