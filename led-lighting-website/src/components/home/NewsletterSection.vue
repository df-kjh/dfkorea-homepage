<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Stay Illuminated',
  description: 'Get project inspiration, product updates, and early access to new releases.'
})

const email = ref('')
const isSubmitting = ref(false)
const message = ref('')

const handleSubmit = async () => {
  if (!email.value) {
    message.value = 'Please enter your email address'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    message.value = 'Please enter a valid email address'
    return
  }

  isSubmitting.value = true
  message.value = ''

  try {
    // 실제 구독 API 호출
    // await api.post('/newsletter/subscribe', { email: email.value })
    
    // 임시 성공 메시지
    setTimeout(() => {
      message.value = 'Thank you for subscribing!'
      email.value = ''
      isSubmitting.value = false
    }, 1000)
  } catch (error) {
    message.value = 'Something went wrong. Please try again.'
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="py-32 px-6">
    <div class="max-w-screen-xl mx-auto">
      <div class="border border-white/10 p-12 rounded-sm bg-gradient-to-br from-white/5 to-transparent backdrop-blur-sm">
        <div class="max-w-2xl mx-auto text-center">
          <h2 class="text-white text-4xl md:text-5xl font-bold mb-6">{{ title }}</h2>
          <p class="text-white/60 text-lg mb-10">{{ description }}</p>

          <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-4">
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="flex-1 bg-background-dark border border-white/20 focus:border-primary rounded-sm px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
              :disabled="isSubmitting"
            />
            <button
              type="submit"
              :disabled="isSubmitting"
              class="bg-primary text-background-dark hover:bg-white px-10 py-4 rounded-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {{ isSubmitting ? 'Subscribing...' : 'Subscribe' }}
            </button>
          </form>

          <p
            v-if="message"
            class="mt-4 text-sm"
            :class="message.includes('Thank') ? 'text-primary' : 'text-red-400'"
          >
            {{ message }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
