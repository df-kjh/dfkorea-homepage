<script setup lang="ts">
interface TimelineItem {
  year: string
  month: string
  title: string
  description?: string
  isCurrent?: boolean
}

interface Props {
  title?: string
  timeline?: TimelineItem[]
}

withDefaults(defineProps<Props>(), {
  title: '회사 연혁',
  timeline: () => [
    {
      year: new Date().getFullYear().toString(),
      month: (() => {
        const month = new Date().getMonth() + 1
        return month < 10 ? `0${month}` : month.toString()
      })(),
      title: '디에프코리아는 LED 조명 분야에서 지속적인 성장을 이어가고 있습니다',
      isCurrent: true,
    },
    {
      year: '2025',
      month: '12',
      title: '주차장용 팬던트 특허 등록',
      isCurrent: false,
    },
    {
      year: '2025',
      month: '05',
      title: '몰드바 V-CHECK 인증',
      isCurrent: false,
    },
          
    {
      year: '2025',
      month: '02',
      title: '몰드바 출시',
      isCurrent: false,
    },
    {
      year: '2023',   
      month: '10',
      title: '주차장용 팬던트 디자인 등록',
      isCurrent: false,
    },
     {
      year: '2023',   
      month: '03',
      title: '주차장용 팬던트 출시',
      isCurrent: false,
    },
                    {
      year: '2021',
      month: '06',
      title: '친환경 인증 획득',
      isCurrent: false,
    },
                {
      year: '2021',
      month: '01',
      title: 'KS C 7657 센서 등기구 KS 인증 획득',
      isCurrent: false,
    },
            {
      year: '2017',
      month: '08',
      title: 'KS C 7653 매입 및 고정형 등기구 KS 인증 획득',
      isCurrent: false,
    },
        {
      year: '2017',
      month: '07',
      title: '중소기업중앙회 직접생산확인증명, 조달청 경쟁입찰 참가 자격 등록',
      isCurrent: false,
    },
    {
      year: '2017',
      month: '05',
      title: '한국산업기술진흥협회 기업부설연구소 인증',
      isCurrent: false,
    },
    {
      year: '2017',
      month: '04',
      title: '기술보증기금 벤처기업 인증',
      isCurrent: false,
    },
    {
      year: '2017',
      month: '01',
      title: '매입 및 고정형 등기구 고효율 인증 획득',
      isCurrent: false,
    },
        {
      year: '2016',
      month: '05',
      title: '(주)디에프코리아 법인 전환',
      isCurrent: false,
    },
    {
      year: '2013',
      month: '10',
      title: '디에프코리아 설립',
      isCurrent: false,
    },
  ],
})
</script>

<template>
  <section class="py-24 px-8 bg-surface/30">
    <div class="max-w-md mx-auto md:max-w-2xl">
      <h2 class="text-text-main text-2xl md:text-3xl font-bold mb-16">{{ title }}</h2>

      <div class="relative space-y-12 pl-8">
        <!-- Timeline Line -->
        <div class="absolute left-[3px] top-2 bottom-2 w-[1.5px] bg-gray-200"></div>

        <!-- Timeline Items -->
        <div v-for="(item, index) in timeline" :key="index" class="relative">
          <!-- Dot -->
          <div
            :class="[
              'absolute -left-[33px] top-2 size-2 rounded-full ring-4 ring-white',
              item.isCurrent ? 'bg-primary animate-pulse' : 'bg-gray-300',
            ]"
          ></div>

          <div>
            <span
              :class="['font-bold text-sm', item.isCurrent ? 'text-primary' : 'text-text-desc']"
            >
              {{ item.year }}.{{ item.month }}
            </span>
            <h3 class="text-text-main font-bold text-lg mt-1">{{ item.title }}</h3>
            <p v-if="item.description" class="text-text-sub text-sm mt-2">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
