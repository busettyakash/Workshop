// API client — uses relative /api (proxied to localhost:5000 in dev via Vite proxy, and to backend in production)
import axios from 'axios'
import {
  buildCacheKey,
  cacheGet,
  cacheSet,
  clearCache,
  getCacheStats,
  getTTLForUrl,
  invalidatePrefix,
} from '../utils/apiCache'

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// ── Request interceptor ───────────────────────────────────────────────────────
// For GET requests: check cache / deduplicate in-flight requests.
// For mutations: tag the config so we know which prefix to invalidate.
api.interceptors.request.use((config) => {
  // Attach auth token
  const token = sessionStorage.getItem('ws_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const activeWorkspaceId = sessionStorage.getItem('ws_active_workspace_id')
  if (activeWorkspaceId) config.headers['x-workspace-id'] = activeWorkspaceId

  if (import.meta.env.DEV) {
    console.log(`📡 [API Request] ${config.method?.toUpperCase()} ${config.url || ''}`)
  }

  // ── Cache logic (GET only) ────────────────────────────────────────────────
  if (config.method?.toLowerCase() === 'get') {
    const ttl = getTTLForUrl(config.url || '')

    if (ttl > 0) {
      const key = buildCacheKey(config.url || '', config.params || {})

      // 1. Serve from cache if fresh
      const cached = cacheGet(key)
      if (cached) {
        if (import.meta.env.DEV) {
          console.log(`⚡ [Cache HIT] ${config.url}`, getCacheStats())
        }
        // Abort the real request and return the cached data via a resolved adapter
        config.adapter = () =>
          Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
            request: {},
          })
        return config
      }

      // 2. Tag config so the response interceptor can cache it
      config._cacheKey = key
      config._cacheTTL = ttl
    }
  }

  return config
})

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV) {
      const source = res.config.statusText === 'OK (cached)' ? '(cached)' : ''
      console.log(`✅ [API Response ${res.status}] ${res.config.url || ''} ${source}`, res.data)
    }

    // ── Store successful GET response in cache ────────────────────────────
    if (res.config._cacheKey && res.config._cacheTTL) {
      cacheSet(res.config._cacheKey, res.data, res.config._cacheTTL)
      if (import.meta.env.DEV) {
        console.log(`💾 [Cache SET] ${res.config.url} TTL=${res.config._cacheTTL}ms`)
      }
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

    // ── Auto-invalidate cache on mutation errors too ───────────────────────
    const method = err.config?.method?.toLowerCase()
    if (method && method !== 'get') {
      const url = err.config?.url || ''
      const prefix = `/${(url || '').replace(/^\//, '').split('/')[0]}`
      if (prefix && prefix !== '/') {
        const targets = CROSS_RESOURCE_INVALIDATIONS[prefix] || [prefix]
        for (const target of targets) {
          invalidatePrefix(target)
        }
      }
    }

    if (err.response?.status === 401) {
      const onAuthPage = ['/login', '/signup'].some((p) =>
        window.location.pathname.startsWith(p)
      )
      if (!onAuthPage) {
        // Expired session — clear cache + session data, then redirect
        clearCache()
        sessionStorage.removeItem('ws_token')
        sessionStorage.removeItem('ws_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Mutation interceptor — invalidate cache after successful mutations ─────────
// We patch the core methods to auto-bust relevant cache entries.
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete']

const CROSS_RESOURCE_INVALIDATIONS = {
  '/import-stock': ['/import-stock', '/products', '/reports', '/dashboard', '/profit-margin'],
  '/products': ['/products', '/import-stock', '/reports', '/dashboard', '/profit-margin'],
  '/billing': ['/billing', '/products', '/import-stock', '/orders', '/reports', '/dashboard'],
  '/orders': ['/orders', '/quotes', '/billing', '/reports', '/dashboard'],
  '/quotes': ['/quotes', '/orders', '/billing'],
  '/people': ['/people', '/reports', '/dashboard'],
  '/notes': ['/notes', '/dashboard'],
  '/emails': ['/emails', '/dashboard'],
}

MUTATING_METHODS.forEach((method) => {
  const original = api[method].bind(api)
  api[method] = async (url, ...args) => {
    const result = await original(url, ...args)
    // Derive the root resource prefix: e.g. "/billing/123" → "/billing"
    const prefix = `/${(url || '').replace(/^\//, '').split('/')[0]}`
    if (prefix && prefix !== '/') {
      const targets = CROSS_RESOURCE_INVALIDATIONS[prefix] || [prefix]
      for (const target of targets) {
        invalidatePrefix(target)
      }
      if (import.meta.env.DEV) {
        console.log(`🗑️ [Cache INVALIDATE] targets=${JSON.stringify(targets)} after ${method.toUpperCase()} ${url}`)
      }
    }
    return result
  }
})

// ── Expose cache helpers on the api instance (optional, for debugging) ────────
api._cache = {
  invalidate: invalidatePrefix,
  clear: clearCache,
  stats: getCacheStats,
}

export default api
