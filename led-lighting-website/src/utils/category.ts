import type { Category } from '@/types'

/**
 * 제품 카테고리 목록
 */
export const productCategories: Category[] = [
  { value: 'all', label: '전체' },
  { value: '엣지평판', label: '엣지평판' },
  { value: '주차장조명', label: '주차장조명' },
  { value: '몰드바', label: '몰드바' },
  { value: '벽부등', label: '벽부등' },
  { value: '차량유도등', label: '차량유도등' },
  { value: '계단표시등', label: '계단표시등' },
  { value: '크린룸조명', label: '크린룸조명' },
  { value: '다운라이트', label: '다운라이트' },
  { value: '원형직부', label: '원형직부' },
  { value: '원형센서', label: '원형센서' },
  { value: 'COB조명', label: 'COB조명' },
  { value: '방습등', label: '방습등' },
  { value: '가로등', label: '가로등' },
  { value: '파이프 팬던트', label: '파이프 팬던트' },
  { value: '칠판등', label: '칠판등' },
]

/**
 * 블로그 카테고리 목록
 */
export const blogCategories: Category[] = [
  { value: 'all', label: '전체' },
  { value: '회사소식', label: '회사소식' },
  { value: '제품소식', label: '제품소식' },
  { value: '기술정보', label: '기술정보' },
  { value: '산업동향', label: '산업동향' },
]

/**
 * 카테고리 값으로 라벨을 찾습니다.
 * @param categories - 카테고리 배열
 * @param value - 찾을 카테고리 값
 * @returns 카테고리 라벨 (없으면 원본 값 반환)
 */
export function getCategoryLabel(categories: Category[], value: string): string {
  const found = categories.find((cat) => cat.value === value)
  return found ? found.label : value
}

/**
 * 블로그 카테고리의 Element Plus 태그 타입을 반환합니다.
 * @param category - 카테고리 값
 * @returns Element Plus 태그 타입
 */
export function getBlogCategoryType(category: string): 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    회사소식: 'info',
    제품소식: 'success',
    기술정보: 'danger',
    산업동향: 'warning',
  }
  return typeMap[category] || 'info'
}
