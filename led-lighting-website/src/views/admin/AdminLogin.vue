<template>
  <div class="min-h-screen bg-background font-inter flex flex-col selection:bg-primary/20">
    <!-- Navigation -->
    <nav class="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-gray-100">
      <div class="flex items-center justify-between px-6 h-16 max-w-screen-xl mx-auto relative">
        <!-- Logo -->
        <div class="flex items-center gap-2 z-10">
          <div class="size-7 bg-primary rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-lg font-bold">lightbulb</span>
          </div>
          <h2 class="text-text-main text-lg font-bold tracking-tight">(주)디에프코리아</h2>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-grow flex items-center justify-center px-6 pt-16">
      <div class="w-full max-w-[400px] py-12">
        <!-- Login Card -->
        <div class="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-gray-50">
          <!-- Header -->
          <div class="flex flex-col items-center mb-10">
            <div class="size-12 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <span class="material-symbols-outlined text-white text-3xl font-bold">lightbulb</span>
            </div>
            <h1 class="text-2xl font-bold text-text-main tracking-tight">관리자 로그인</h1>
            <p class="text-text-desc text-sm mt-2">(주)디에프코리아 관리자 전용 보안 접속</p>
          </div>

          <!-- Login Form -->
          <form class="space-y-4" @submit.prevent="handleLogin">
            <!-- Username Field -->
            <div class="space-y-1.5">
              <label
                for="username"
                class="text-xs font-bold text-text-sub ml-1 uppercase tracking-wider"
              >
                아이디
              </label>
              <input
                id="username"
                v-model="loginForm.username"
                type="text"
                name="username"
                placeholder="아이디를 입력하세요."
                class="w-full px-4 py-4 rounded-xl bg-surface border-transparent text-text-main text-[15px] font-medium transition-all placeholder:text-text-desc focus:ring-0 focus:border-primary focus:outline-none"
                :disabled="loading"
              />
            </div>

            <!-- Password Field -->
            <div class="space-y-1.5">
              <label
                for="password"
                class="text-xs font-bold text-text-sub ml-1 uppercase tracking-wider"
              >
                비밀번호
              </label>
              <input
                id="password"
                v-model="loginForm.password"
                type="password"
                name="password"
                placeholder="비밀번호를 입력하세요."
                class="w-full px-4 py-4 rounded-xl bg-surface border-transparent text-text-main text-[15px] font-medium transition-all placeholder:text-text-desc focus:ring-0 focus:border-primary focus:outline-none"
                :disabled="loading"
                @keyup.enter="handleLogin"
              />
            </div>

            <!-- Submit Button -->
            <div class="pt-4">
              <button
                type="submit"
                class="w-full bg-primary text-white font-bold py-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-[16px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :disabled="loading || !isFormFiled"
              >
                <span v-if="loading" class="material-symbols-outlined animate-spin"
                  >progress_activity</span
                >
                <span>{{ loading ? '로그인 중...' : '로그인' }}</span>
              </button>
            </div>
          </form>

          <!-- Footer Notice -->
          <div class="mt-8 pt-8 border-t border-gray-200 text-center">
            <p class="text-[13px] text-text-desc">
              허가되지 않은 접근은 엄격히 금지됩니다.<br />
              모든 활동은 모니터링됩니다.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authAPI } from '@/api'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const isFormFiled = computed(() => {
  return loginForm.username.trim() !== '' && loginForm.password.trim() !== ''
})

const handleLogin = async (): Promise<void> => {
  // Validation
  if (!loginForm.username.trim()) {
    toast.error('아이디를 입력해주세요')
    return
  }

  if (!loginForm.password.trim()) {
    toast.error('비밀번호를 입력해주세요')
    return
  }

  try {
    loading.value = true

    const { data } = await authAPI.login(loginForm)

    // 토큰과 사용자 정보 저장
    localStorage.setItem('admin_token', data.access_token)
    localStorage.setItem('admin_user', JSON.stringify(data.user))

    toast.success('로그인 성공!')

    // 라우터 가드가 localStorage를 확인할 수 있도록 약간의 딜레이 후 이동
    await new Promise((resolve) => setTimeout(resolve, 100))
    await router.push('/admin/dashboard')
  } catch (error) {
    console.error('Login error:', error)
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '로그인에 실패했습니다')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.glass-nav {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
