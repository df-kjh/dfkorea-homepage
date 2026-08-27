import { ref } from 'vue'

const isDark = ref(false)

// localStorage에서 테마 불러오기
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme')
  isDark.value = savedTheme === 'dark'

  // HTML에 dark 클래스 적용
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  }
}

export function useTheme() {
  const toggleTheme = (): void => {
    isDark.value = !isDark.value

    if (isDark.value) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const setTheme = (dark: boolean): void => {
    isDark.value = dark

    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return {
    isDark,
    toggleTheme,
    setTheme,
  }
}
