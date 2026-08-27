<script setup lang="ts">
import { ref } from 'vue'

interface Client {
  name: string
  logo: string
}

interface Props {
  title?: string
  subtitle?: string
  clients?: Client[]
}

const props = withDefaults(defineProps<Props>(), {
  title: '신뢰받는 파트너',
  subtitle: 'Trusted Partners',
  clients: () => [
    { name: '경찰청', logo: '/images/clients/경찰청.svg' },
    { name: '농협', logo: '/images/clients/농협 하나로마트.svg' },
    { name: '서울시설관리공단', logo: '/images/clients/서울시설관리공단.svg' },
    { name: '셀트리온', logo: '/images/clients/셀트리온.svg' },
    { name: '인천공항', logo: '/images/clients/인천공항.svg' },
    { name: '인하대', logo: '/images/clients/인하대.svg' },
    { name: '한솥', logo: '/images/clients/한솥도시락.svg' },
    { name: 'CGV', logo: '/images/clients/CGV.svg' },
  ],
})

// 로고가 충분히 보이도록 배열을 3번 복제
const duplicatedClients = ref([...props.clients, ...props.clients, ...props.clients])
</script>

<template>
  <section class="py-16 md:py-20 px-6 bg-gray-50">
    <div class="max-w-screen-xl mx-auto">
      <!-- 타이틀 -->
      <div class="text-center mb-12">
        <p class="text-primary text-sm font-semibold uppercase tracking-wider mb-2">
          {{ subtitle }}
        </p>
        <h2 class="text-gray-900 text-3xl md:text-4xl font-bold">{{ title }}</h2>
      </div>

      <!-- 무한 스크롤 로고 컨테이너 -->
      <div class="relative overflow-hidden">
        <!-- 좌측 그라디언트 페이드 -->
        <div
          class="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-gray-50 to-transparent z-10"
        ></div>
        <!-- 우측 그라디언트 페이드 -->
        <div
          class="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-gray-50 to-transparent z-10"
        ></div>

        <!-- 스크롤 애니메이션 래퍼 -->
        <div class="flex animate-scroll hover:pause-animation">
          <!-- 로고 아이템들 -->
          <div
            v-for="(client, index) in duplicatedClients"
            :key="`client-${index}`"
            class="flex-shrink-0 mx-6 md:mx-8 flex items-center justify-center"
          >
            <div
              class="w-32 h-20 md:w-40 md:h-24 flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-300"
            >
              <img
                :src="client.logo"
                :alt="`${client.name} 로고`"
                class="max-w-full max-h-full object-contain grayscale hover:grayscale-0 transition-all duration-300"
                @error="(e) => (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'40\'%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23999\' font-family=\'Arial\' font-size=\'12\'%3E' + client.name + '%3C/text%3E%3C/svg%3E'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 무한 스크롤 애니메이션 */
@keyframes scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    /* 전체 길이의 1/3만큼 이동 (3번 복제했으므로) */
    transform: translateX(calc(-100% / 3));
  }
}

.animate-scroll {
  animation: scroll 30s linear infinite;
  display: flex;
  width: max-content;
}

/* 호버 시 애니메이션 일시정지 */
.pause-animation:hover {
  animation-play-state: paused;
}
</style>
