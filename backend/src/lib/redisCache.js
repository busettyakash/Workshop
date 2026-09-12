import redis from './redis.js'
import {
  deleteMemoryCache,
  getMemoryCache,
  setMemoryCache,
  withTimeout,
} from './fastCache.js'

export async function getOrSetCache(key, fetcher, ttlSeconds = 300) {
  const memoryValue = getMemoryCache(key)
  if (memoryValue !== null) return memoryValue

  const cached = await withTimeout(redis.get(key).catch(() => null), 250)
  if (cached !== null && cached !== undefined) {
    setMemoryCache(key, cached, ttlSeconds)
    return cached
  }

  const value = await fetcher()
  setMemoryCache(key, value, ttlSeconds)
  redis.set(key, value, { ex: ttlSeconds }).catch(() => { })
  return value
}

export async function invalidateCachePattern(pattern) {
  try {
    const keys = await withTimeout(redis.keys(pattern).catch(() => []), 500) || []
    for (const key of keys) {
      deleteMemoryCache(key)
    }
    if (keys.length > 0) {
      await withTimeout(redis.del(...keys).catch(() => null), 500)
    }
    return keys.length
  } catch {
    return 0
  }
}
