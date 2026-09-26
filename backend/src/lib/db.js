import fs from 'node:fs'
import dotenv from 'dotenv'
dotenv.config()
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true })
} else if (fs.existsSync('backend/.env.local')) {
  dotenv.config({ path: 'backend/.env.local', override: true })
}

import dns from 'node:dns'
import pg from 'pg'

try {
  const defaultDns = (process.env.CUSTOM_DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',')
  dns.setServers(defaultDns)
} catch {}

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
    if (options?.all) {
      const results = addresses.map(addr => ({ address: addr, family: 4 }))
      callback(null, results)
    } else {
      callback(null, addresses[0], 4)
    }
  })
}

const { Pool, types } = pg

// Return PostgreSQL DATE columns (OID 1082) as plain YYYY-MM-DD strings without JS Date timezone shifts
types.setTypeParser(1082, (val) => val)

// Return PostgreSQL TIMESTAMP columns (OID 1114) as UTC ISO strings so JS Date and JSON serialization preserve true UTC
types.setTypeParser(1114, (val) => (val ? val.replace(' ', 'T') + 'Z' : val))

const dbUrl = process.env.DATABASE_URL
const isDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL

const getPoolMax = () => {
  const configuredMax = Number.parseInt(process.env.PG_POOL_MAX, 10)
  if (Number.isInteger(configuredMax) && configuredMax > 0) return configuredMax
  if (process.env.VERCEL) return 3  // Vercel: serverless — keep very small
  return 6 // Safe default for database with 30 max connections
}

const createPool = () => new Pool({
  connectionString: dbUrl,
  application_name: process.env.PG_APPLICATION_NAME || 'workshop-backend',
  ssl: { rejectUnauthorized: false },
  max: getPoolMax(),
  min: process.env.VERCEL ? 0 : 1,
  idleTimeoutMillis: process.env.VERCEL ? 5000 : 120000, // 2m in dev so connections stay warm while typing credentials
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 10000,
  query_timeout: 30000,
  allowExitOnIdle: true,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  maxUses: 500,
})

const pool = globalThis.__workshopPgPool || createPool()
globalThis.__workshopPgPool = pool

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message)
})

pool.on('connect', () => {
  if (isDevelopment) {
    console.log('[DB] New client connected to pool')
  }
})

// Warm up the pool with a ready connection so queries never hit cold TLS handshake delay
try {
  if (isDevelopment) {
    const client = await pool.connect()
    client.release()
    console.log('[DB] Pool warm & ready ✅')

    // Lightweight heartbeat every 25s so cloud firewalls never drop the idle socket
    const heartbeatTimer = setInterval(() => {
      if (poolClosed) {
        clearInterval(heartbeatTimer)
        return
      }
      pool.query('SELECT 1').catch(() => {})
    }, 25000)
    heartbeatTimer.unref()
  } else {
    await pool.query('SELECT 1')
  }
} catch (err) {
  console.warn('[DB Warmup Warning]', err.message)
}

let poolClosed = false
const closePool = async () => {
  if (poolClosed) return
  poolClosed = true
  try {
    await pool.end()
    console.log('[DB] Pool closed gracefully')
  } catch (err) {
    console.error('[DB] Error closing pool:', err.message)
  }
}

process.once('SIGTERM', async () => {
  await closePool()
  process.exit(0)
})

process.once('SIGINT', async () => {
  await closePool()
  process.exit(0)
})

process.once('SIGUSR2', async () => {
  await closePool()
  process.kill(process.pid, 'SIGUSR2')
})


import { AsyncLocalStorage } from 'async_hooks'

export const dbLocalStorage = new AsyncLocalStorage()

export const isConnectionError = (err) => {
  if (!err) return false
  const code = err.code
  const msg = (err.message || '').toLowerCase()
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08006' ||
    code === '08001' ||
    code === '08004' ||
    code === '08003' ||
    msg.includes('connection terminated') ||
    msg.includes('connection closed') ||
    msg.includes('connection reset') ||
    msg.includes('socket closed') ||
    msg.includes('not useable') ||
    msg.includes('timeout')
  )
}

export const query = async (text, params) => {
  const store = dbLocalStorage.getStore()

  const executeOnce = async () => {
    const start = Date.now()
    const client = await pool.connect()
    let hasError = false
    try {
      const targetUserId = store || null
      const targetBypass = !store

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

      if (isDevelopment) {
        const displayQuery = text.replace(/\s+/g, ' ').trim()
        console.log(`[DB Query] (${duration}ms) ${displayQuery.substring(0, 150)}${displayQuery.length > 150 ? '...' : ''}`)
        if (params && params.length > 0) {
          console.log(`[DB Params] [REDACTED] count=${params.length}`)
        }
      } else if (duration > 2000) {
        console.warn(`[DB Slow Query] ${duration}ms — ${text.substring(0, 80)}...`)
      }

      return result
    } catch (err) {
      hasError = true
      const duration = Date.now() - start
      console.error(`[DB Query Error] (${duration}ms) ${err.message}`)
      throw err
    } finally {
      // Pass hasError to release: destroys client if it encountered an error so dead sockets aren't recycled
      client.release(hasError)
    }
  }

  try {
    return await executeOnce()
  } catch (err) {
    if (isConnectionError(err)) {
      console.warn('[DB] Stale/severed connection detected, retrying query once with fresh connection...')
      return await executeOnce()
    }
    throw err
  }
}

/**
 * Run multiple SQL queries on the SAME pool connection in series.
 * Saves N-1 pool.connect() + set_config() round-trips vs calling query() separately.
 * Use when you need sequential queries that must share the same RLS session.
 */
export const querySerial = async (queries) => {
  const store = dbLocalStorage.getStore()

  const executeOnce = async () => {
    const client = await pool.connect()
    let hasError = false
    const results = []
    try {
      const targetUserId = store || null
      const targetBypass = !store

      if (client.currentUserId !== targetUserId || client.bypassRls !== targetBypass) {
        if (store) {
          await client.query(`SELECT set_config('app.current_user_id', $1, false), set_config('app.bypass_rls', 'off', false)`, [store])
        } else {
          await client.query(`SELECT set_config('app.current_user_id', '', false), set_config('app.bypass_rls', 'on', false)`)
        }
        client.currentUserId = targetUserId
        client.bypassRls = targetBypass
      }

      for (const { text, params: p } of queries) {
        const start = Date.now()
        const result = await client.query(text, p)
        const duration = Date.now() - start
        if (isDevelopment) {
          const displayQuery = text.replace(/\s+/g, ' ').trim()
          console.log(`[DB Serial] (${duration}ms) ${displayQuery.substring(0, 120)}${displayQuery.length > 120 ? '...' : ''}`)
        }
        results.push(result)
      }
      return results
    } catch (err) {
      hasError = true
      throw err
    } finally {
      client.release(hasError)
    }
  }

  try {
    return await executeOnce()
  } catch (err) {
    if (isConnectionError(err)) {
      console.warn('[DB Serial] Severed connection detected, retrying with fresh connection...')
      return await executeOnce()
    }
    throw err
  }
}

export default pool

