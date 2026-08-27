import { watch } from 'vue'
import { useRoute } from 'vue-router'

interface MetaOptions {
  title?: string
  description?: string
  keywords?: string
  ogImage?: string
  ogType?: string
  canonicalUrl?: string
  structuredData?: Record<string, unknown>
}

export function useSEO(options: MetaOptions = {}) {
  const route = useRoute()

  const setMeta = (meta: MetaOptions) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    const {
      title = '(주)디에프코리아 - LED 조명 전문 기업',
      description = '혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아. 고품질 LED 제품과 솔루션을 경험해보세요.',
      keywords = 'LED 조명, LED lighting, 조명, 산업용 조명, 상업용 조명, 에너지 절약, LED 제품, (주)디에프코리아,디에프코리아',
      ogImage = '/images/og-image.jpg',
      ogType = 'website',
      canonicalUrl = window.location.href,
      structuredData,
    } = meta

    // Title 설정
    document.title = title

    // Meta tags 설정
    setMetaTag('description', description)
    setMetaTag('keywords', keywords)

    // Open Graph tags
    setMetaTag('og:title', title, 'property')
    setMetaTag('og:description', description, 'property')
    setMetaTag('og:image', ogImage, 'property')
    setMetaTag('og:type', ogType, 'property')
    setMetaTag('og:url', canonicalUrl, 'property')
    setMetaTag('og:site_name', '(주)디에프코리아', 'property')

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image', 'name')
    setMetaTag('twitter:title', title, 'name')
    setMetaTag('twitter:description', description, 'name')
    setMetaTag('twitter:image', ogImage, 'name')
    setMetaTag('twitter:url', canonicalUrl, 'name')

    setCanonicalUrl(canonicalUrl)
    setStructuredData(structuredData)

    // Naver 검색 최적화
    setMetaTag('naver-site-verification', 'YOUR_NAVER_VERIFICATION_CODE', 'name')

    // Google 검색 최적화
    setMetaTag('google-site-verification', 'YOUR_GOOGLE_VERIFICATION_CODE', 'name')
  }

  const setMetaTag = (key: string, content: string, attribute: 'name' | 'property' = 'name') => {
    let element = document.querySelector(`meta[${attribute}="${key}"]`)

    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, key)
      document.head.appendChild(element)
    }

    element.setAttribute('content', content)
  }

  const setCanonicalUrl = (href: string) => {
    let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')

    if (!element) {
      element = document.createElement('link')
      element.setAttribute('rel', 'canonical')
      document.head.appendChild(element)
    }

    element.setAttribute('href', href)
  }

  const setStructuredData = (data?: Record<string, unknown>) => {
    const id = 'page-structured-data'
    const existing = document.getElementById(id)

    if (!data) {
      existing?.remove()
      return
    }

    const element = existing || document.createElement('script')
    element.id = id
    element.setAttribute('type', 'application/ld+json')
    element.textContent = JSON.stringify(data)

    if (!existing) {
      document.head.appendChild(element)
    }
  }

  // 초기 설정
  setMeta(options)

  // 라우트 변경 시 업데이트
  watch(
    () => route.path,
    () => {
      setMeta(options)
    },
  )

  return {
    setMeta,
  }
}
