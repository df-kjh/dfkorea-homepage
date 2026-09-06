<template>
  <div id="app" class="bg-background-dark min-h-screen flex flex-col text-white font-sans">
    <TheNavigation v-if="!isAdminPage" />

    <main class="flex-1 w-full">
      <NuxtPage />
    </main>

    <TheFooter v-if="!isAdminPage" />

    <button
      v-show="showBackTop && !isAdminPage"
      class="site-back-top fixed w-12 h-12 bg-primary text-background-white rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:-translate-y-1 z-50"
      aria-label="Back to top"
      @click="scrollToTop"
    >
      <span class="material-symbols-outlined">arrow_upward</span>
    </button>

    <ClientOnly
      ><QuoteLauncher v-if="!isAdminPage" :back-to-top-visible="showBackTop"
    /></ClientOnly>

    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TheNavigation from '@/components/layout/TheNavigation.vue'
import TheFooter from '@/components/layout/TheFooter.vue'
import QuoteLauncher from '@/components/quote/QuoteLauncher.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'

const route = useRoute()
const isAdminPage = computed(() => route.path.startsWith('/admin'))
const showBackTop = ref(false)

const handleScroll = () => {
  showBackTop.value = window.scrollY > 300
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style>
.site-back-top {
  right: 32px;
  bottom: calc(32px + env(safe-area-inset-bottom, 0px));
}
@media (max-width: 639px) {
  .site-back-top {
    right: 24px;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
