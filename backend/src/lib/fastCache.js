const memoryCache = new Map()

const now = () => Date.now()

export function getMemoryCache(key) {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now()) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

export function setMemoryCache(key, value, ttlSeconds = 300) {
  memoryCache.set(key, {
    // Always store the parsed object — avoid double JSON.parse on every hit
    value: typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return value } })() : value,
    expiresAt: now() + ttlSeconds * 1000,
  })
}

export function deleteMemoryCache(key) {
  memoryCache.delete(key)
}

export async function withTimeout(promise, timeoutMs = 800) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function getCached(redis, key, timeoutMs = 800) {
  // 1. Memory cache — only for immediate short-term burst deduplication (3s max)
  const memoryValue = getMemoryCache(key)
  if (memoryValue !== null) return memoryValue

  // 2. Redis cache — distributed across all containers/instances
  const redisValue = await withTimeout(redis.get(key).catch(() => null), timeoutMs)
  if (redisValue !== null && redisValue !== undefined) {
    // Parse JSON if string, store as object in memory with short TTL (3s)
    // to prevent cross-container stale cache divergence while still buffering rapid bursts
    const parsed = typeof redisValue === 'string'
      ? (() => { try { return JSON.parse(redisValue) } catch { return redisValue } })()
      : redisValue
    setMemoryCache(key, parsed, 3)
    return parsed
  }

  return null
}

export async function setCached(redis, key, value, ttlSeconds = 300) {
  // Short in-memory buffer (max 3s) so mutations quickly propagate across instances
  const memTtl = Math.min(ttlSeconds, 3)
  setMemoryCache(key, value, memTtl)
  // Store JSON string in Redis
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  await redis.set(key, str, { ex: ttlSeconds }).catch(() => { })
}

export async function deleteCached(redis, key) {
  deleteMemoryCache(key)
  if (typeof key === 'string' && key.startsWith('local:')) {
    deleteMemoryCache(key.slice(6))
  }
  return await redis.del(key).catch(() => { })
}

export function clearMemoryCachePrefix(prefix) {
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k)
    }
  }
}

export async function deleteCachedPattern(redis, pattern) {
  const prefix = pattern ? pattern.split('*')[0] : ''
  clearMemoryCachePrefix(prefix)
  if (prefix.startsWith('local:')) {
    clearMemoryCachePrefix(prefix.slice(6))
  }
  try {
    const keys = await redis.keys(pattern).catch(() => [])
    if (keys && keys.length > 0) {
      for (const k of keys) {
        deleteMemoryCache(k)
        if (typeof k === 'string' && k.startsWith('local:')) {
          deleteMemoryCache(k.slice(6))
        }
      }
      // Delete in batches from Redis to avoid huge single-line limits
      const chunkSize = 50
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize)
        await redis.del(...chunk).catch(() => {})
      }
    }
  } catch (_err) {}
}

// Run multiple queries on the SAME db connection to avoid repeated pool.connect + set_config overhead
export async function queryBatch(dbQuery, queries) {
  const results = []
  for (const { text, params } of queries) {
    results.push(await dbQuery(text, params))
  }
  return results
}
