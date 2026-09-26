import { Redis } from '@upstash/redis'
import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config()
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true })
}

console.log('[REDIS] Initializing with URL:', process.env.UPSTASH_REDIS_REST_URL)
const rawRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// When running locally with Supabase, isolate keys so local testing never interferes with production
const isLocal = fs.existsSync('.env.local') || (process.env.DATABASE_URL || '').includes('supabase')
const keyPrefix = isLocal ? 'local:' : ''

const prefixKey = (k) => {
  if (typeof k === 'string' && !k.startsWith(keyPrefix)) {
    return keyPrefix + k
  }
  return k
}

const redis = new Proxy(rawRedis, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver)
    if (typeof orig !== 'function' || !keyPrefix) return orig

    return function (...args) {
      if (args.length === 0) return orig.apply(target, args)

      const fnName = String(prop).toLowerCase()

      // For multi-key commands: del, mget
      if (fnName === 'del' || fnName === 'mget') {
        const modifiedArgs = args.map(arg => {
          if (Array.isArray(arg)) return arg.map(prefixKey)
          return prefixKey(arg)
        })
        return orig.apply(target, modifiedArgs)
      }

      // For single-key commands (get, set, expire, rpush, lrange, keys, etc.)
      // only prefix args[0] (the key) and leave the value/data intact
      const modifiedArgs = [...args]
      if (Array.isArray(modifiedArgs[0])) {
        modifiedArgs[0] = modifiedArgs[0].map(prefixKey)
      } else {
        modifiedArgs[0] = prefixKey(modifiedArgs[0])
      }

      return orig.apply(target, modifiedArgs)
    }
  }
})

export default redis
