process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import dns from 'dns'
if (process.env.NODE_ENV === 'development') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4'])
  } catch (e) {
    console.warn('[DNS] Failed to set custom DNS servers:', e.message)
  }

  const originalLookup = dns.lookup
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return originalLookup(hostname, options, callback)
    }
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return originalLookup(hostname, options, callback)
      }
      if (options && options.all) {
        const results = addresses.map(addr => ({ address: addr, family: 4 }))
        callback(null, results)
      } else {
        callback(null, addresses[0], 4)
      }
    })
  }
}

import pg from 'pg'

const { Pool } = pg

const dbUrl = process.env.DATABASE_URL

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message)
})

pool.on('connect', () => {
  console.log('[DB] New client connected to pool')
})

// Test connection on startup
pool.query('SELECT NOW()').then(() => {
  console.log('[DB] ✅ Database connection verified successfully')
}).catch((err) => {
  console.error('[DB] ❌ Database connection FAILED on startup:', err.message)
})

import { AsyncLocalStorage } from 'async_hooks'

export const dbLocalStorage = new AsyncLocalStorage()

export const query = async (text, params) => {
  const start = Date.now()
  const store = dbLocalStorage.getStore() // contains request workspaceId / user_id
  
  const client = await pool.connect()
  try {
    const targetUserId = store || null
    const targetBypass = !store

    // Client-side session variable caching to avoid extra set_config queries when connection is reused for same context
    if (client.currentUserId !== targetUserId || client.bypassRls !== targetBypass) {
      if (store) {
        await client.query(`SELECT set_config('app.current_user_id', $1, false), set_config('app.bypass_rls', 'off', false)`, [store])
      } else {
        await client.query(`SELECT set_config('app.current_user_id', '', false), set_config('app.bypass_rls', 'on', false)`)
      }
      client.currentUserId = targetUserId
      client.bypassRls = targetBypass
    }

    const result = await client.query(text, params)
    const duration = Date.now() - start
    
    // Developer SQL query logger
    if (process.env.NODE_ENV === 'development') {
      const displayQuery = text.replace(/\s+/g, ' ').trim()
      console.log(`[DB Query] (${duration}ms) ${displayQuery.substring(0, 150)}${displayQuery.length > 150 ? '...' : ''}`)
      if (params && params.length > 0) {
        console.log(`[DB Params]`, params)
      }
    } else if (duration > 2000) {
      console.warn(`[DB Slow Query] ${duration}ms — ${text.substring(0, 80)}...`)
    }
    
    return result
  } catch (err) {
    const duration = Date.now() - start
    console.error(`[DB Query Error] (${duration}ms) ${err.message}`)
    console.error(`[DB Query Error] Query: ${text}`)
    console.error(`[DB Query Error] Params:`, params)
    throw err
  } finally {
    client.release()
  }
}

export default pool
