import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Tailwind CSS - Load first
import './assets/main.css'
import './assets/dark-mode.css'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

app.mount('#app')

// 앱 마운트 후 테마 초기화
const themeStore = useThemeStore()
themeStore.initTheme()
