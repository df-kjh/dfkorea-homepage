<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseButton from '@/components/common/BaseButton.vue'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-6"
  >
    <div class="max-w-2xl w-full text-center">
      <!-- 404 Illustration -->
      <div class="mb-8">
        <div class="relative inline-block">
          <h1 class="text-9xl font-bold text-gray-200 select-none">404</h1>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="material-symbols-outlined text-8xl text-primary/30">search_off</span>
          </div>
        </div>
      </div>

      <!-- Message -->
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">페이지를 찾을 수 없습니다</h2>
      <p class="text-lg text-gray-600 mb-8 max-w-md mx-auto">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.<br />
        URL을 다시 확인해주세요.
      </p>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <BaseButton variant="primary" size="large" icon-left="home" @click="goHome">
          홈으로 가기
        </BaseButton>
        <BaseButton variant="default" size="large" icon-left="arrow_back" @click="goBack">
          이전 페이지
        </BaseButton>
      </div>

      <!-- Quick Links -->
      <div class="mt-12 pt-8 border-t border-gray-200">
        <p class="text-sm text-gray-500 mb-4">빠른 이동</p>
        <div class="flex flex-wrap gap-4 justify-center">
          <router-link
            to="/about"
            class="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            회사 소개
          </router-link>
          <router-link
            to="/products"
            class="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            제품 소개
          </router-link>
          <router-link
            to="/blog"
            class="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            회사 소식
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 48;
}
</style>
