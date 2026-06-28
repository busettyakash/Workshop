process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg'

const { Pool } = pg

const dbUrl = process.env.NODE_ENV === 'production' 
  ? process.env.DATABASE_URL 
  : (process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/insforge');

const isLocal = dbUrl?.includes('localhost') || dbUrl?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
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

export const query = async (text, params) => {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    if (duration > 2000) {
      console.warn(`[DB Slow Query] ${duration}ms — ${text.substring(0, 80)}...`)
    }
    return result
  } catch (err) {
    const duration = Date.now() - start
    console.error(`[DB Query Error] (${duration}ms) ${err.message}`)
    console.error(`[DB Query Error] Query: ${text}`)
    console.error(`[DB Query Error] Params:`, params)
    throw err
  }
}

export default pool
