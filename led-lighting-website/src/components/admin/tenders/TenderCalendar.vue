<script setup lang="ts">
import { computed } from 'vue'
import { buildMonthCells } from '@/utils/tender-calendar'
import type { TenderCalendarDay } from '@/types'

interface Props {
  month: string
  selectedDate: string
  days: TenderCalendarDay[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), { loading: false })
const emit = defineEmits<{
  'change-month': [month: string]
  'select-date': [date: string]
  today: []
}>()

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

const monthDate = computed(() => {
  const [year, month] = props.month.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1))
})

const monthLabel = computed(() => `${monthDate.value.getUTCFullYear()}년 ${monthDate.value.getUTCMonth() + 1}월`)
const cells = computed(() => {
  const counts = new Map(props.days.map((day) => [day.date, day]))
  return buildMonthCells(monthDate.value.getUTCFullYear(), monthDate.value.getUTCMonth(), counts)
})
const weeks = computed(() => Array.from({ length: 6 }, (_, index) => cells.value.slice(index * 7, index * 7 + 7)))

const formatMonth = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const moveMonth = (amount: number) => {
  const next = new Date(monthDate.value)
  next.setUTCMonth(next.getUTCMonth() + amount)
  emit('change-month', formatMonth(next))
}

const selectCell = (date: string, inCurrentMonth: boolean) => {
  if (!inCurrentMonth) {
    emit('change-month', date.slice(0, 7))
  }
  emit('select-date', date)
}
</script>

<template>
  <section class="tender-calendar" aria-label="입찰 공고 월간 캘린더">
    <div class="tender-calendar__header">
      <div class="flex items-center gap-2">
        <button data-test="previous-month" type="button" class="calendar-nav" aria-label="이전 달" @click="moveMonth(-1)">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
        </button>
        <h3 class="font-bold text-gray-900">{{ monthLabel }}</h3>
        <button data-test="next-month" type="button" class="calendar-nav" aria-label="다음 달" @click="moveMonth(1)">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
      </div>
      <button data-test="today" type="button" class="text-sm font-semibold text-primary hover:underline" @click="emit('today')">오늘</button>
    </div>

    <div class="tender-calendar__grid tender-calendar__weekdays" role="row">
      <span v-for="weekday in weekdays" :key="weekday" class="text-center text-xs font-semibold text-gray-500" role="columnheader">{{ weekday }}</span>
    </div>
    <div v-if="loading" class="tender-calendar__loading" aria-live="polite">캘린더를 불러오는 중입니다.</div>
    <div v-else class="tender-calendar__days" role="grid" :aria-label="`${monthLabel} 입찰 공고`">
      <div v-for="(week, weekIndex) in weeks" :key="weekIndex" data-test="calendar-week" class="tender-calendar__grid" role="row">
        <button
          v-for="cell in week"
          :key="cell.date"
          data-test="calendar-cell"
          :data-date="cell.date"
          type="button"
          role="gridcell"
          :aria-label="`${cell.date}, 전체 ${cell.total}건, 직접 관련 ${cell.direct}건, 잠재 관련 ${cell.potential}건`"
          :class="[
            'tender-calendar__cell',
            { 'is-outside-month': !cell.inCurrentMonth, 'is-selected': selectedDate === cell.date },
          ]"
          @click="selectCell(cell.date, cell.inCurrentMonth)"
        >
          <span class="tender-calendar__date">{{ Number(cell.date.slice(-2)) }}</span>
          <span v-if="cell.total" class="tender-calendar__total">{{ cell.total }}건</span>
          <span class="tender-calendar__counts" aria-hidden="true">
            <span v-if="cell.direct" class="tender-calendar__count tender-calendar__count--direct">💡 <b>{{ cell.direct }}</b></span>
            <span v-if="cell.potential" class="tender-calendar__count tender-calendar__count--potential">⚡ <b>{{ cell.potential }}</b></span>
          </span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tender-calendar { min-width: 700px; }
.tender-calendar__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.calendar-nav { display: inline-flex; padding: .3rem; border-radius: .375rem; color: #4b5563; }
.calendar-nav:hover { background: #f3f4f6; }
.tender-calendar__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.tender-calendar__weekdays { border: 1px solid #e5e7eb; border-bottom: 0; padding: .65rem 0; background: #f9fafb; }
.tender-calendar__cell { min-height: 110px; border: 1px solid #e5e7eb; border-right: 0; padding: .55rem; text-align: left; background: white; transition: background .15s, box-shadow .15s; }
.tender-calendar__cell:last-child { border-right: 1px solid #e5e7eb; }
.tender-calendar__cell:hover { background: #f0fbfd; }
.tender-calendar__cell.is-outside-month { color: #9ca3af; background: #fafafa; }
.tender-calendar__cell.is-selected { outline: 2px solid #22a8c3; outline-offset: -2px; background: #f0fbfd; }
.tender-calendar__date { display: block; font-weight: 700; }
.tender-calendar__total { display: block; margin-top: .25rem; color: #6b7280; font-size: .75rem; }
.tender-calendar__counts { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .5rem; }
.tender-calendar__count { border-radius: 9999px; padding: .18rem .35rem; font-size: .72rem; }
.tender-calendar__count--direct { background: #e2f7fb; color: #0f8198; }
.tender-calendar__count--potential { background: #fff6d9; color: #9a6700; }
.tender-calendar__loading { min-height: 300px; display: grid; place-items: center; color: #6b7280; border: 1px solid #e5e7eb; }
@media (max-width: 767px) { .tender-calendar__cell { min-height: 72px; padding: .35rem; } .tender-calendar__total { display: none; } .tender-calendar__counts { gap: .15rem; } .tender-calendar__count { padding: .12rem; background: transparent; } }
</style>
