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

export async function withTimeout(promise, timeoutMs = 250) {
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

export async function getCached(redis, key, timeoutMs = 250) {
  // 1. Memory cache — instant, no network round-trip
  const memoryValue = getMemoryCache(key)
  if (memoryValue !== null) return memoryValue

  // 2. Redis cache — with timeout so it never blocks the request
  const redisValue = await withTimeout(redis.get(key).catch(() => null), timeoutMs)
  if (redisValue !== null && redisValue !== undefined) {
    // Parse JSON if string, store as object in memory
    const parsed = typeof redisValue === 'string'
      ? (() => { try { return JSON.parse(redisValue) } catch { return redisValue } })()
      : redisValue
    setMemoryCache(key, parsed, 120) // keep in memory for 2 min
    return parsed
  }

  return null
}

export function setCached(redis, key, value, ttlSeconds = 300) {
  // Store parsed object in memory — avoid JSON.stringify/parse overhead on hits
  setMemoryCache(key, value, ttlSeconds)
  // Store JSON string in Redis
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  redis.set(key, str, { ex: ttlSeconds }).catch(() => { })
}

export function deleteCached(redis, key) {
  deleteMemoryCache(key)
  redis.del(key).catch(() => { })
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
  try {
    const keys = await redis.keys(pattern).catch(() => [])
    for (const k of keys) {
      deleteMemoryCache(k)
      await redis.del(k).catch(() => { })
    }
  } catch { }
}

// Run multiple queries on the SAME db connection to avoid repeated pool.connect + set_config overhead
export async function queryBatch(dbQuery, queries) {
  const results = []
  for (const { text, params } of queries) {
    results.push(await dbQuery(text, params))
  }
  return results
}
