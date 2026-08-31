// ============================================
// 공통 타입 정의
// ============================================

/**
 * API 응답 공통 타입
 */
export interface ApiResponse<T> {
  data: T
  message?: string
}

/**
 * 페이지네이션 관련 타입
 */
export interface PaginationParams {
  page: number
  pageSize: number
  total: number
}

/**
 * 페이지네이션 응답 타입
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 카테고리 타입
 */
export interface Category {
  value: string
  label: string
}

// ============================================
// Product 관련 타입
// ============================================

/**
 * 제품 이미지 (URL + 설명)
 */
export interface ProductImage {
  image: string // 이미지 URL
  description: string // 이미지 설명 (한 줄)
}

/**
 * 제품 정보
 */
export interface Product {
  id: string
  name: string // 제목
  category: string // 카테고리
  images: ProductImage[] // 제품 썸네일 이미지 (최대 3장)
  modelName: string // 모델명
  dimensions: string // 크기
  power: number[] // 전력(W) - 여러 개 가능
  lifespan: number // 수명
  colorTemp: number[] // 색 온도 - 여러 개 가능
  ledChipManufacturer: string // LED 칩 제조 회사
  certifications: string[] // 인증 (KS, 고효율 등)
  powerFactor?: string // 역률
  luminanceEfficiency?: number // 광효율
  colorRendering?: string // 연색성
  options?: string[] // 옵션 (개별디밍, 그룹디밍, 센서)
  description: string // 기타 사항 (마크다운)
  isNew?: boolean // 신제품 여부
  isFeatured?: boolean // 메인 제품 여부
  createdAt: string
  updatedAt: string
}

/**
 * 제품 생성 DTO (id, createdAt, updatedAt 제외)
 */
export type CreateProductDto = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 제품 수정 DTO (id, createdAt, updatedAt 제외, 모든 필드 optional)
 */
export type UpdateProductDto = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>

// ============================================
// Post 관련 타입
// ============================================

/**
 * 게시글 정보
 */
export interface Post {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  image: string
  views: number
  createdAt: string
  updatedAt: string
}

/**
 * 게시글 생성 DTO (id, views, createdAt, updatedAt 제외)
 */
export type CreatePostDto = Omit<Post, 'id' | 'views' | 'createdAt' | 'updatedAt'>

/**
 * 게시글 수정 DTO (id, views, createdAt, updatedAt 제외, 모든 필드 optional)
 */
export type UpdatePostDto = Partial<Omit<Post, 'id' | 'views' | 'createdAt' | 'updatedAt'>>

// ============================================
// Certificate 관련 타입
// ============================================

/**
 * 인증서 정보
 */
export interface Certificate {
  id: string
  name: string // 인증서 이름
  issuingOrganization: string // 인증 업체
  category?: string // 구분
  markImage?: string // 인증 마크 이미지 URL (optional)
  certificatePdf?: string // 인증서 PDF URL (optional)
  createdAt: string
  updatedAt: string
}

/**
 * 인증서 생성 DTO (id, createdAt, updatedAt 제외)
 */
export type CreateCertificateDto = Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 인증서 수정 DTO (id, createdAt, updatedAt 제외, 모든 필드 optional)
 */
export type UpdateCertificateDto = Partial<Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>>

// ============================================
// Auth 관련 타입
// ============================================

/**
 * 로그인 요청 DTO
 */
export interface LoginDto {
  username: string
  password: string
}

/**
 * 로그인 응답
 */
export interface LoginResponse {
  access_token: string
  user: {
    username: string
  }
}

/**
 * 사용자 정보
 */
export interface User {
  username: string
}

// ============================================
// Form 관련 타입
// ============================================

/**
 * Element Plus Form 규칙
 */
export interface FormRule {
  required?: boolean
  message?: string
  trigger?: 'blur' | 'change'
  min?: number
  max?: number
  type?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'method'
    | 'regexp'
    | 'integer'
    | 'float'
    | 'array'
    | 'object'
    | 'enum'
    | 'date'
    | 'url'
    | 'hex'
    | 'email'
}

export type FormRules = Record<string, FormRule[]>

export type {
  PaginatedTenderResponse,
  Tender,
  TenderCalendarCell,
  TenderCalendarDay,
  TenderCalendarQuery,
  TenderCollectionResponse,
  TenderCollectionSourceResult,
  TenderCollectionSourceStatus,
  TenderProcurementType,
  TenderQuery,
  TenderRelevance,
  TenderRelevanceReason,
  TenderSource,
  TenderSubscription,
  TenderMailOAuthAuthorization,
  TenderMailOAuthStatus,
  TenderOpportunityType,
  UpdateTenderSubscription,
} from './tender'

// ============================================
// Component Props 타입
// ============================================

/**
 * 페이지 헤더 Props
 */
export interface PageHeaderProps {
  title: string
  subtitle: string
}

/**
 * 로딩 상태 Props
 */
export interface LoadingState {
  loading: boolean
  error?: string
}
