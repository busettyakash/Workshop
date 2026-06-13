// API client — uses relative /api in production (Vercel proxies to backend)
// and localhost:5000 in local development
import axios from 'axios'

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const api = axios.create({
  baseURL: isLocal ? 'http://localhost:5000/api' : '/api',
  timeout: 15000,
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ws_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — clear storage and redirect to login ONLY when not already on auth pages
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const onAuthPage = ['/login', '/signup'].some(p => window.location.pathname.startsWith(p))
      if (!onAuthPage) {
        // Expired session — clear and redirect
        localStorage.removeItem('ws_token')
        localStorage.removeItem('ws_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
