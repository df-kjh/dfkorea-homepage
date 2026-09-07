import axios from 'axios'
import { getApiBaseUrl } from '../utils/api-base'

const apiClient = axios.create({
  baseURL: '/api/admin',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  // Remove credentials left by older releases; authentication now lives only in
  // the same-origin HttpOnly cookie and is verified by the backend on each use.
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }
  config.headers.delete('Authorization')
  const path = config.url || ''
  const method = config.method?.toLowerCase() || 'get'
  const publicRead = method === 'get' && /^\/(?:products|posts|certificates)(?:\/|$)/.test(path)
  const publicView = method === 'post' && /^\/posts\/[A-Za-z0-9-]+\/view$/.test(path)
  // These existing APIs also render public pages during SSR and must remain anonymous.
  if (publicRead || publicView) config.baseURL = getApiBaseUrl()
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin') &&
      window.location.pathname !== '/admin/login'
    ) {
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
