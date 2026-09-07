import { getApiBaseUrl } from '../utils/api-base'

/**
 * API 엔드포인트 상수
 */
export const API_BASE_URL = getApiBaseUrl()
export const UPLOAD_IMAGE_URL = `${API_BASE_URL}/upload/image`

/**
 * 업로드 설정 상수
 */
export const UPLOAD_CONFIG = {
  // Vercel 관리자 릴레이의 요청 상한(4.5MB) 안에 multipart 헤더 여유를 둔다.
  MAX_SIZE_MB: 4,
  MAX_SIZE_BYTES: 4 * 1024 * 1024,
  ACCEPTED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  ACCEPTED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  FIELD_NAME: 'image',
} as const

/**
 * 페이지네이션 기본 설정
 */
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_CURRENT_PAGE: 1,
} as const
