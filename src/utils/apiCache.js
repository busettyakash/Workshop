/**
 * apiCache.js — Production-grade in-memory request cache
 *
 * Features:
 *  - TTL-based expiry (no stale data served past the window)
 *  - Prefix-based invalidation (bust a whole resource on mutation)
 *  - Deduplication of in-flight requests (no duplicate concurrent fetches)
 *  - Zero external dependencies
 *  - Safe: in-memory only, cleared on page refresh
 */

// ── TTL constants (milliseconds) ─────────────────────────────────────────────
export const TTL = {
  SHORT:   30 * 1000,       // 30s  — list pages (billing, products, people …)
  MEDIUM:  60 * 1000,       // 60s  — dashboard stats, reports
  LONG:    5  * 60 * 1000,  // 5m   — static refs (UOMs, templates, workflows)
  NONE:    0,               // 0    — disable caching for this key
}

// ── Per-route TTL rules (longest prefix match wins) ──────────────────────────
const ROUTE_TTL_MAP = [
  // Static / rarely-changing data
  { prefix: '/uoms',           ttl: TTL.LONG   },
  { prefix: '/bill-templates', ttl: TTL.LONG   },
  { prefix: '/workflows',      ttl: TTL.MEDIUM },

  // Dashboard / reports
  { prefix: '/reports',        ttl: TTL.MEDIUM },
  { prefix: '/dashboard',      ttl: TTL.MEDIUM },
  { prefix: '/profit-margin',  ttl: TTL.MEDIUM },

  // Mutable list pages — short TTL so recent edits show up quickly
  { prefix: '/billing',        ttl: TTL.SHORT  },
  { prefix: '/products',       ttl: TTL.SHORT  },
  { prefix: '/people',         ttl: TTL.SHORT  },
  { prefix: '/quotes',         ttl: TTL.SHORT  },
  { prefix: '/orders',         ttl: TTL.SHORT  },
  { prefix: '/import-stock',   ttl: TTL.SHORT  },
  { prefix: '/notes',          ttl: TTL.SHORT  },
  { prefix: '/emails',         ttl: TTL.SHORT  },

  // Never cache auth / chat / real-time
  { prefix: '/auth',           ttl: TTL.NONE   },
  { prefix: '/chat',           ttl: TTL.NONE   },
]

/** Returns the TTL for a given URL path, or SHORT as a safe default. */
export function getTTLForUrl(url = '') {
  const path = url.split('?')[0] // strip query params for matching
  for (const { prefix, ttl } of ROUTE_TTL_MAP) {
    if (path.startsWith(prefix)) return ttl
  }
  return TTL.SHORT // safe default
}

// ── Cache store ──────────────────────────────────────────────────────────────
// Map<cacheKey, { data, expiresAt }>
const _store = new Map()

// In-flight promise deduplication — Map<cacheKey, Promise<AxiosResponse>>
const _inFlight = new Map()

/**
 * Build a stable cache key from URL + params.
 * Includes workspace ID so different workspaces never share entries.
 */
export function buildCacheKey(url = '', params = {}) {
  const wsId = sessionStorage.getItem('ws_active_workspace_id') || 'default'
  const sorted = Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return `${wsId}::${url}${sorted ? `?${sorted}` : ''}`
}

/** Return cached data if it exists and hasn't expired. */
export function cacheGet(key) {
  const entry = _store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    _store.delete(key)
    return null
  }
  return entry.data
}

/** Store data under key with the given TTL (ms). */
export function cacheSet(key, data, ttl) {
  if (!ttl || ttl <= 0) return // TTL.NONE means don't cache
  _store.set(key, { data, expiresAt: Date.now() + ttl })
}

/**
 * Invalidate all cache entries whose key contains the given prefix.
 * Call this after any mutating request (POST/PUT/PATCH/DELETE).
 *
 * Example: invalidatePrefix('/billing') busts:
 *   - /billing
 *   - /billing?status=paid&page=1
 *   - /billing/123
 */
export function invalidatePrefix(prefix) {
  const lc = prefix.toLowerCase()
  for (const key of _store.keys()) {
    // key format: "wsId::url?params" — match on the url part
    const urlPart = key.split('::').slice(1).join('::')
    if (urlPart.toLowerCase().includes(lc)) {
      _store.delete(key)
    }
  }
}

/** Wipe the entire cache (e.g. on logout / workspace switch). */
export function clearCache() {
  _store.clear()
  _inFlight.clear()
}

/**
 * Get the in-flight promise for a key.
 * Returns null if no request is currently in-flight for this key.
 */
export function getInFlight(key) {
  return _inFlight.get(key) ?? null
}

/**
 * Register an in-flight request promise.
 * Automatically cleans itself up when the promise settles.
 */
export function setInFlight(key, promise) {
  _inFlight.set(key, promise)
  promise.finally(() => _inFlight.delete(key))
}

/** Cache stats — useful for debugging in dev. */
export function getCacheStats() {
  const now = Date.now()
  let alive = 0
  let expired = 0
  for (const entry of _store.values()) {
    if (now <= entry.expiresAt) alive++
    else expired++
  }
  return { alive, expired, inFlight: _inFlight.size, total: _store.size }
}
