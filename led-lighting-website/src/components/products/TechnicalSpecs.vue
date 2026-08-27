<script setup lang="ts">
interface TechSpec {
  label: string
  value: string
}

interface Props {
  title?: string
  specs: TechSpec[]
}

withDefaults(defineProps<Props>(), {
  title: '제품 상세 정보',
})
</script>

<template>
  <section class="bg-surface py-24">
    <div class="max-w-[1400px] mx-auto px-10">
      <div class="max-w-3xl">
        <h2 class="text-text-main text-3xl font-bold mb-12">{{ title }}</h2>
        <div class="grid md:grid-cols-2 gap-x-20 gap-y-2">
          <div
            v-for="(spec, index) in specs"
            :key="index"
            class="flex justify-between py-6 border-b border-gray-300/50"
          >
            <span class="text-text-sub text-sm uppercase tracking-widest font-semibold">
              {{ spec.label }}
            </span>
            <span class="text-text-main text-sm font-bold">
              {{ spec.value }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
