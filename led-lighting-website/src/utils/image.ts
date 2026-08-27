/**
 * 이미지 URL을 절대 경로로 변환하는 유틸리티 함수
 * 상대 경로인 경우 API 베이스 URL을 추가
 */
export const getImageUrl = (imagePath: string | undefined): string => {
  if (!imagePath) {
    return 'https://via.placeholder.com/800x500/F2F4F6/8B95A1?text=No+Image'
  }

  // 이미 절대 URL인 경우 (http:// 또는 https://로 시작)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  // 상대 경로인 경우 API 베이스 URL 추가
  const apiBaseUrl =
    import.meta.env.NUXT_PUBLIC_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:3000'

  // 슬래시로 시작하는 경우
  if (imagePath.startsWith('/')) {
    return `${apiBaseUrl}${imagePath}`
  }

  // 슬래시가 없는 경우
  return `${apiBaseUrl}/${imagePath}`
}

/**
 * 배열의 첫 번째 이미지 URL을 반환
 * ProductImage 객체 배열 지원
 */
export const getFirstImageUrl = (
  images: ({ image: string; description: string } | string)[] | undefined,
): string => {
  if (!images || images.length === 0) {
    return 'https://via.placeholder.com/800x500/F2F4F6/8B95A1?text=No+Image'
  }
  const first = images[0]
  if (!first) {
    return 'https://via.placeholder.com/800x500/F2F4F6/8B95A1?text=No+Image'
  }
  const url = typeof first === 'string' ? first : first.image
  return getImageUrl(url)
}
