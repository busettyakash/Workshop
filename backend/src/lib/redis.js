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

const redis = new Proxy(rawRedis, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver)
    if (typeof orig !== 'function' || !keyPrefix) return orig

    return function (...args) {
      if (args.length > 0 && typeof args[0] === 'string' && !args[0].startsWith(keyPrefix)) {
        args[0] = keyPrefix + args[0]
      }
      return orig.apply(target, args)
    }
  }
})

export default redis
