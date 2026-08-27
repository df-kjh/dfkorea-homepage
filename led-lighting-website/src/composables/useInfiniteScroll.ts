import { ref, watch, onUnmounted, type Ref } from 'vue'

interface UseInfiniteScrollOptions {
  rootMargin?: string // IntersectionObserver rootMargin (기본: '200px')
  threshold?: number // IntersectionObserver threshold (기본: 0)
  onLoadMore: () => void | Promise<void>
  enabled?: () => boolean // 무한 스크롤 활성화 여부
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const { rootMargin = '200px', threshold = 0, onLoadMore, enabled = () => true } = options
  const isLoading = ref(false)
  const observerTarget: Ref<HTMLElement | null> = ref(null)
  let observer: IntersectionObserver | null = null

  const handleIntersection = async (entries: IntersectionObserverEntry[]) => {
    const [entry] = entries

    // 요소가 화면에 보이고, 활성화되어 있고, 로딩 중이 아닐 때만 실행
    if (entry && entry.isIntersecting && enabled() && !isLoading.value) {
      isLoading.value = true
      try {
        await onLoadMore()
      } finally {
        isLoading.value = false
      }
    }
  }

  // observerTarget이 설정되면 IntersectionObserver 초기화
  watch(observerTarget, (newTarget, oldTarget) => {
    // 이전 observer 정리
    if (observer && oldTarget) {
      observer.unobserve(oldTarget)
      observer.disconnect()
      observer = null
    }

    // 새로운 target이 있으면 observer 시작
    if (newTarget) {
      observer = new IntersectionObserver(handleIntersection, {
        root: null, // viewport를 root로 사용
        rootMargin,
        threshold,
      })

      observer.observe(newTarget)
    }
  })

  // IntersectionObserver 정리
  onUnmounted(() => {
    if (observer && observerTarget.value) {
      observer.unobserve(observerTarget.value)
      observer.disconnect()
      observer = null
    }
  })

  return {
    isLoading,
    observerTarget,
  }
}
