import axios from 'axios'

// 환경 변수에서 API URL 가져오기
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  return envUrl || 'http://localhost:3000'
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

console.log('🌐 API Base URL:', apiClient.defaults.baseURL)

// 요청 인터셉터: 토큰 자동 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 응답 인터셉터: 인증 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
