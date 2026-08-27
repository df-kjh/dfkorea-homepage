import apiClient from './client'
import type {
  LoginDto,
  LoginResponse,
  Product,
  CreateProductDto,
  UpdateProductDto,
  Post,
  CreatePostDto,
  UpdatePostDto,
  Certificate,
  CreateCertificateDto,
  UpdateCertificateDto,
  PaginatedResponse,
} from '@/types'

export { tendersAPI } from './tenders'

// 인증 API
export const authAPI = {
  login: (credentials: LoginDto) => apiClient.post<LoginResponse>('/auth/login', credentials),
}

// 제품 API
export const productsAPI = {
  getAll: () => apiClient.get<Product[]>('/products'),
  getPaginated: (page: number, limit: number, search?: string, category?: string) =>
    apiClient.get<PaginatedResponse<Product>>('/products', {
      params: { page, limit, ...(search && { search }), ...(category && category !== '전체' && { category }) },
    }),
  getFeatured: () => apiClient.get<Product[]>('/products/featured/list'),
  getOne: (id: string) => apiClient.get<Product>(`/products/${id}`),
  create: (data: CreateProductDto) => apiClient.post<Product>('/products', data),
  update: (id: string, data: UpdateProductDto) => apiClient.put<Product>(`/products/${id}`, data),
  delete: (id: string) => apiClient.delete(`/products/${id}`),
  generateDescription: (productInfo: {
    name: string
    category: string
    images: string[]
    modelName?: string
    dimensions?: string
    power?: number[]
    lifespan?: number
    colorTemp?: number[]
    ledChipManufacturer?: string
    certifications?: string[]
  }) =>
    apiClient.post<{ description: string; generatedImages: string[] }>(
      '/products/generate-description',
      productInfo,
    ),
}

// 게시글 API
export const postsAPI = {
  getAll: () => apiClient.get<Post[]>('/posts'),
  getPaginated: (page: number, limit: number, search?: string) =>
    apiClient.get<PaginatedResponse<Post>>('/posts', {
      params: { page, limit, ...(search && { search }) },
    }),
  getOne: (id: string) => apiClient.get<Post>(`/posts/${id}`),
  create: (data: CreatePostDto) => apiClient.post<Post>('/posts', data),
  update: (id: string, data: UpdatePostDto) => apiClient.put<Post>(`/posts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/posts/${id}`),
  incrementView: (id: string) => apiClient.post(`/posts/${id}/view`),
}

// 인증서 API
export const certificatesAPI = {
  getAll: () => apiClient.get<Certificate[]>('/certificates'),
  getOne: (id: string) => apiClient.get<Certificate>(`/certificates/${id}`),
  create: (data: CreateCertificateDto) => apiClient.post<Certificate>('/certificates', data),
  update: (id: string, data: UpdateCertificateDto) => apiClient.put<Certificate>(`/certificates/${id}`, data),
  delete: (id: string) => apiClient.delete(`/certificates/${id}`),
}

// 업로드 API
export const uploadAPI = {
  uploadImage: (file: File, folder?: 'products' | 'posts' | 'temp' | 'certificates') => {
    const formData = new FormData()
    formData.append('image', file)
    const params = folder ? { folder } : {}
    return apiClient.post<{ url: string; filename: string; originalname: string; size: number }>(
      '/upload/image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params,
      },
    )
  },
  uploadFile: (file: File, folder?: 'products' | 'posts' | 'temp' | 'certificates') => {
    const formData = new FormData()
    formData.append('file', file)
    const params = folder ? { folder } : {}
    return apiClient.post<{ url: string; filename: string; originalname: string; size: number }>(
      '/upload/file',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params,
      },
    )
  },
  deleteImage: (url: string) => {
    return apiClient.delete<{ success: boolean; message: string }>('/upload/image', {
      data: { url },
    })
  },
}

// 스케줄러 API
export const schedulerAPI = {
  triggerAiPost: () => apiClient.post<{ message: string }>('/scheduler/trigger'),
  triggerProductNewsPost: () =>
    apiClient.post<{ message: string }>('/scheduler/trigger/product-company-news'),
}

// 타입 재export
export type {
  LoginDto,
  LoginResponse,
  Product,
  CreateProductDto,
  UpdateProductDto,
  Post,
  CreatePostDto,
  UpdatePostDto,
  Certificate,
  CreateCertificateDto,
  UpdateCertificateDto,
}
