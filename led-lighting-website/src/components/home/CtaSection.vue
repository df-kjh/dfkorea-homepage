<template>
  <section class="relative py-32 px-6 bg-white overflow-hidden">
    <!-- Background Pattern -->
    <div class="absolute inset-0 opacity-5">
      <div
        class="absolute inset-0"
        style="
          background-image: radial-gradient(circle at 2px 2px, #22a8c3 1px, transparent 0);
          background-size: 40px 40px;
        "
      ></div>
    </div>

    <div class="relative max-w-4xl mx-auto text-center">
      <!-- Title -->
      <h2 class="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
        {{ title }}
      </h2>

      <!-- Description -->
      <p class="text-xl text-gray-600 mb-12 leading-relaxed max-w-2xl mx-auto">
        {{ description }}
      </p>

      <!-- CTA Button -->
      <button
        @click="dialogVisible = true"
        class="group inline-flex items-center gap-3 bg-primary text-white px-12 py-5 rounded-md font-bold text-base tracking-widest uppercase hover:bg-primary/90 transition-all hover:scale-105 shadow-lg"
      >
        <span class="material-symbols-outlined">call</span>
        <span>상담 문의하기</span>
      </button>
    </div>

    <!-- Contact Dialog -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="dialogVisible"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          @click.self="dialogVisible = false"
        >
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="dialogVisible"
              class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <!-- Header -->
              <div class="px-8 pt-8 pb-6 border-b border-gray-100">
                <h3 class="text-2xl font-bold text-text-main">상담 문의 방법 선택</h3>
                <button
                  @click="dialogVisible = false"
                  class="absolute top-6 right-6 size-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-text-sub"
                >
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>

              <!-- Content -->
              <div class="p-8 grid md:grid-cols-2 gap-4">
                <!-- Email Option -->
                <button
                  @click="handleEmailContact"
                  class="group p-6 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-center"
                >
                  <div
                    class="size-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all"
                  >
                    <span class="material-symbols-outlined text-3xl">email</span>
                  </div>
                  <h4 class="text-lg font-bold text-text-main mb-2">이메일 문의</h4>
                  <p class="text-sm text-primary font-medium mb-3">{{ companyEmail }}</p>
                  <span class="text-xs text-text-desc">
                    {{ isMobile ? '지메일로 이동' : '이메일 복사' }}
                  </span>
                </button>

                <!-- Phone Option -->
                <button
                  @click="handlePhoneContact"
                  class="group p-6 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-center"
                >
                  <div
                    class="size-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-primary group-hover:text-white transition-all"
                  >
                    <span class="material-symbols-outlined text-3xl">call</span>
                  </div>
                  <h4 class="text-lg font-bold text-text-main mb-2">전화 문의</h4>
                  <p class="text-sm text-primary font-medium mb-3">{{ companyPhone }}</p>
                  <span class="text-xs text-text-desc">
                    {{ isMobile ? '전화 앱으로 이동' : '전화번호 복사' }}
                  </span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

interface Props {
  title?: string
  description?: string
  companyEmail?: string
  companyPhone?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '제품 상담이 필요하신가요?',
  description: '전문 컨설턴트가 최적의 LED 조명 솔루션을 제안해드립니다',
  companyEmail: 'kjukym@hanmail.net',
  companyPhone: '032-528-2953',
})

const toast = useToast()
const dialogVisible = ref(false)

// 모바일 기기 감지
const isMobile = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

// 이메일 문의 처리
const handleEmailContact = async () => {
  if (isMobile.value) {
    // 모바일: 지메일 앱으로 이동
    window.location.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${props.companyEmail}`
  } else {
    // PC: 이메일 복사
    try {
      await navigator.clipboard.writeText(props.companyEmail)
      toast.success('이메일 주소가 클립보드에 복사되었습니다')
      dialogVisible.value = false
    } catch (err) {
      console.error('Failed to copy email:', err)
      toast.error('이메일 주소 복사에 실패했습니다')
    }
  }
}

// 전화 문의 처리
const handlePhoneContact = async () => {
  // 전화번호에서 하이픈 제거
  const phoneNumber = props.companyPhone.replace(/-/g, '')

  if (isMobile.value) {
    // 모바일: 전화 앱으로 이동
    window.location.href = `tel:${phoneNumber}`
  } else {
    // PC: 전화번호 복사
    try {
      await navigator.clipboard.writeText(props.companyPhone)
      toast.success('전화번호가 클립보드에 복사되었습니다')
      dialogVisible.value = false
    } catch (err) {
      console.error('Failed to copy phone:', err)
      toast.error('전화번호 복사에 실패했습니다')
    }
  }
}
</script>
