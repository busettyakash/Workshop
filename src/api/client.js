// API client — uses relative /api (proxied to localhost:5000 in dev via Vite proxy, and to backend in production)
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('ws_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  
  const activeWorkspaceId = sessionStorage.getItem('ws_active_workspace_id')
  if (activeWorkspaceId) config.headers['x-workspace-id'] = activeWorkspaceId

  if (import.meta.env.DEV) {
    console.log(`📡 [API Request] ${config.method?.toUpperCase()} ${config.url || ''}`)
  }
  
  return config
})

// Handle responses, logging, and 401 redirect
api.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV) {
      console.log(`✅ [API Response ${res.status}] ${res.config.url || ''}`, res.data)
    }
    return res
  },
  (err) => {
    if (import.meta.env.DEV) {
      console.error(
        `❌ [API Error ${err.response?.status || 'Network'}] ${err.config?.url || ''}`,
        err.response?.data || err.message
      )
    }
    if (err.response?.status === 401) {
      const onAuthPage = ['/login', '/signup'].some(p => window.location.pathname.startsWith(p))
      if (!onAuthPage) {
        // Expired session — clear and redirect
        sessionStorage.removeItem('ws_token')
        sessionStorage.removeItem('ws_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
