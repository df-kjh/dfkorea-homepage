import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  // 'light', 'dark', 'auto' 중 하나
  const theme = ref<'light' | 'dark' | 'auto'>('auto')
  const isDark = ref(false)

  // 시스템 다크모드 감지
  const getSystemTheme = (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // 테마 적용
  const applyTheme = (darkMode: boolean) => {
    isDark.value = darkMode
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }

  // 테마 초기화
  const initTheme = () => {
    // localStorage에서 저장된 테마 설정 불러오기
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null

    if (savedTheme) {
      theme.value = savedTheme
    }

    // 실제 다크모드 적용 여부 결정
    if (theme.value === 'auto') {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(theme.value === 'dark')
    }

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme.value === 'auto') {
        applyTheme(e.matches)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
  }

  // 테마 토글 (light <-> dark)
  const toggleTheme = () => {
    if (isDark.value) {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  // 테마 설정
  const setTheme = (newTheme: 'light' | 'dark' | 'auto') => {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)

    if (newTheme === 'auto') {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(newTheme === 'dark')
    }
  }

  // 테마 변경 감시
  watch(theme, (newTheme) => {
    if (newTheme === 'auto') {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(newTheme === 'dark')
    }
  })

  return {
    theme,
    isDark,
    initTheme,
    toggleTheme,
    setTheme,
  }
})
