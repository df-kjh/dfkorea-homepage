import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * 반응형 화면 크기를 감지하는 Composable
 * @returns 화면 크기 관련 reactive 변수들
 */
export function useResponsive() {
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  // 브레이크포인트 정의
  const breakpoints = {
    xs: 480,
    sm: 768,
    md: 992,
    lg: 1200,
    xl: 1920,
  }

  // 화면 크기 업데이트
  const updateSize = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  // 디바운스된 리사이즈 핸들러
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  const handleResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(() => {
      updateSize()
    }, 150)
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
    updateSize()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
  })

  // 반응형 플래그들
  const isMobile = computed(() => windowWidth.value < breakpoints.sm)
  const isTablet = computed(
    () => windowWidth.value >= breakpoints.sm && windowWidth.value < breakpoints.md,
  )
  const isDesktop = computed(() => windowWidth.value >= breakpoints.md)
  const isLargeDesktop = computed(() => windowWidth.value >= breakpoints.lg)
  const isExtraLarge = computed(() => windowWidth.value >= breakpoints.xl)

  // 특정 브레이크포인트보다 작은지 확인
  const isSmallerThan = (breakpoint: keyof typeof breakpoints) => {
    return computed(() => windowWidth.value < breakpoints[breakpoint])
  }

  // 특정 브레이크포인트보다 큰지 확인
  const isLargerThan = (breakpoint: keyof typeof breakpoints) => {
    return computed(() => windowWidth.value >= breakpoints[breakpoint])
  }

  // 터치 디바이스 감지
  const isTouchDevice = computed(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  })

  // 디바이스 방향
  const isPortrait = computed(() => windowHeight.value > windowWidth.value)
  const isLandscape = computed(() => windowWidth.value > windowHeight.value)

  // 현재 브레이크포인트 이름
  const currentBreakpoint = computed(() => {
    if (windowWidth.value < breakpoints.xs) return 'xs'
    if (windowWidth.value < breakpoints.sm) return 'sm'
    if (windowWidth.value < breakpoints.md) return 'md'
    if (windowWidth.value < breakpoints.lg) return 'lg'
    if (windowWidth.value < breakpoints.xl) return 'xl'
    return 'xxl'
  })

  return {
    // 윈도우 크기
    windowWidth,
    windowHeight,

    // 브레이크포인트
    breakpoints,

    // 디바이스 타입
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isExtraLarge,

    // 유틸리티 함수
    isSmallerThan,
    isLargerThan,

    // 터치 및 방향
    isTouchDevice,
    isPortrait,
    isLandscape,

    // 현재 브레이크포인트
    currentBreakpoint,
  }
}
