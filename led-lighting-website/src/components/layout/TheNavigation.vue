<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isMobileMenuOpen = ref(false)

interface MenuItem {
  path: string
  label: string
}

const menuItems: MenuItem[] = [
  { path: '/about', label: '회사 소개' },
  { path: '/certificates', label: '인증 현황' },
  { path: '/products', label: '제품' },
  { path: '/blog', label: '소식' },
  // TODO Support 페이지 추가
  // { path: '/contact', label: 'Support' },
]

// 모든 페이지에서 라이트 테마 사용
const isDarkPage = computed(() => false)

const isActive = (path: string): boolean => {
  return route.path === path
}

const closeMobileMenu = (): void => {
  isMobileMenuOpen.value = false
}
</script>

<template>
  <nav
    :class="['fixed top-0 left-0 right-0 z-50 transition-all duration-300 glass-nav bg-white/40']"
  >
    <div class="flex items-center justify-between px-6 py-4 max-w-screen-xl mx-auto h-20">
      <!-- Logo - flex-1 -->
      <div class="flex items-center gap-2 flex-1">
        <NuxtLink to="/" class="flex items-center gap-2" @click="closeMobileMenu">
          <div class="size-8 bg-primary rounded-sm flex items-center justify-center">
            <span
              :class="[
                'material-symbols-outlined text-xl font-bold',
                isDarkPage ? 'text-background-dark' : 'text-white',
              ]"
            >
              lightbulb
            </span>
          </div>
          <h2
            :class="[
              'text-xl font-bold tracking-tighter uppercase',
              isDarkPage ? 'text-white' : 'text-text-main',
            ]"
          >
            DF KOREA
          </h2>
        </NuxtLink>
      </div>

      <!-- Desktop Menu - flex-[2] center -->
      <div class="hidden md:flex items-center justify-center gap-10 flex-[2]">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          @click="closeMobileMenu"
          :class="[
            'text-sm font-medium tracking-widest uppercase transition-colors',
            isActive(item.path)
              ? 'text-primary'
              : isDarkPage
                ? 'text-white/70 hover:text-primary'
                : 'text-text-sub hover:text-primary',
          ]"
        >
          {{ item.label }}
        </NuxtLink>
      </div>

      <!-- Actions - flex-1 right -->
      <div class="flex items-center justify-end gap-6 flex-1">
        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          :class="[
            'md:hidden transition-colors',
            isDarkPage ? 'text-white/80 hover:text-primary' : 'text-text-sub hover:text-primary',
          ]"
          aria-label="Menu"
        >
          <span class="material-symbols-outlined">
            {{ isMobileMenuOpen ? 'close' : 'menu' }}
          </span>
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <Transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="opacity-0 max-h-0 -translate-y-8"
      enter-to-class="opacity-100 max-h-[500px] translate-y-0"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="opacity-100 max-h-[500px] translate-y-0"
      leave-to-class="opacity-0 max-h-0 -translate-y-8"
    >
      <div
        v-if="isMobileMenuOpen"
        :class="[
          'md:hidden glass-nav border-t overflow-hidden',
          isDarkPage ? 'bg-background-dark/95 border-white/10' : 'bg-white/95 border-gray-200',
        ]"
      >
        <ul class="px-6 py-8 space-y-6">
          <li
            v-for="(item, index) in menuItems"
            :key="item.path"
            :style="{ animationDelay: `${index * 50}ms` }"
            class="animate-slide-in-left"
          >
            <NuxtLink
              :to="item.path"
              @click="closeMobileMenu"
              :class="[
                'block w-full text-left text-lg font-medium tracking-widest uppercase transition-colors',
                isActive(item.path)
                  ? 'text-primary'
                  : isDarkPage
                    ? 'text-white/80 hover:text-primary'
                  : 'text-text-sub hover:text-primary',
              ]"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
button {
  transition: all 0.2s;
}
</style>
