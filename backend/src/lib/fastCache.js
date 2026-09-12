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
    value,
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
  const memoryValue = getMemoryCache(key)
  if (memoryValue !== null) return memoryValue

  const redisValue = await withTimeout(redis.get(key).catch(() => null), timeoutMs)
  if (redisValue !== null && redisValue !== undefined) {
    setMemoryCache(key, redisValue)
    return redisValue
  }

  return null
}

export function setCached(redis, key, value, ttlSeconds = 300) {
  setMemoryCache(key, value, ttlSeconds)
  redis.set(key, value, { ex: ttlSeconds }).catch(() => { })
}

export function deleteCached(redis, key) {
  deleteMemoryCache(key)
  redis.del(key).catch(() => { })
}
