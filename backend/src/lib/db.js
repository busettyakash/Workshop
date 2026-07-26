process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import pg from 'pg'

const { Pool, types } = pg

// Return PostgreSQL DATE columns (OID 1082) as plain YYYY-MM-DD strings without JS Date timezone shifts
types.setTypeParser(1082, (val) => val)

const dbUrl = process.env.DATABASE_URL
const isDevelopment = process.env.NODE_ENV === 'development' && !process.env.VERCEL

const getPoolMax = () => {
  const configuredMax = Number.parseInt(process.env.PG_POOL_MAX, 10)
  if (Number.isInteger(configuredMax) && configuredMax > 0) return configuredMax
  if (process.env.VERCEL) return 1
  if (isDevelopment) return 5
  if (process.env.NODE_ENV === 'production') return 3
  return 3 // fallback for test/staging/unset NODE_ENV — stay conservative
}

const createPool = () => new Pool({
  connectionString: dbUrl,
  application_name: process.env.PG_APPLICATION_NAME || 'workshop-backend',
  ssl: { rejectUnauthorized: false },
  max: getPoolMax(),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  query_timeout: 30000,
  allowExitOnIdle: true,
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

export const query = async (text, params) => {
  const start = Date.now()
  const store = dbLocalStorage.getStore()

  const client = await pool.connect()
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
    const duration = Date.now() - start
    console.error(`[DB Query Error] (${duration}ms) ${err.message}`)
    console.error(`[DB Query Error] Query: ${text}`)
    console.error(`[DB Query Error] Params count: ${Array.isArray(params) ? params.length : 0}`)
    throw err
  } finally {
    client.release()
  }
}

export default pool
