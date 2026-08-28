import 'dotenv/config'
import dns from 'node:dns'
const isDevelopment = process.env.NODE_ENV === 'development' && !process.env.VERCEL

if (isDevelopment) {
  try {
    const defaultDns = (process.env.CUSTOM_DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',')
    dns.setServers(defaultDns)
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

import express from 'express'
import cors from 'cors'

import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import billingRoutes from './routes/billing.js'
import customerRoutes from './routes/customers.js'
import reportRoutes from './routes/reports.js'
import workflowRoutes from './routes/workflows.js'
import chatRoutes from './routes/chat.js'
import importStockRoutes from './routes/importStock.js'
import peopleRoutes from './routes/people.js'
import billTemplateRoutes from './routes/billTemplates.js'
import recordRoutes from './routes/records.js'
import notesRoutes from './routes/notes.js'
import emailsRoutes from './routes/emails.js'
import uomRoutes from './routes/uoms.js'
import quotesRoutes from './routes/quotes.js'
import orderRoutes from './routes/orders.js'

const app = express()
app.disable('x-powered-by')
const PORT = process.env.PORT || 5000

/* ── Request Logger Middleware ── */
if (!process.env.VERCEL) {
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      const logLine = `[Request] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms) - Auth: ${req.headers.authorization ? 'Yes' : 'No'} - Workspace: ${req.headers['x-workspace-id'] || 'None'}`
      console.log(logLine)
    })
    next()
  })
}

import zlib from 'node:zlib'

/* ── Middleware ── */
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}))
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf-8')
  }
}))
app.use(express.urlencoded({ extended: true }))

/* ── Response Gzip Compression ── */
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || ''
  if (!acceptEncoding.includes('gzip')) return next()

  const originalJson = res.json.bind(res)
  res.json = function (data) {
    try {
      const body = Buffer.from(JSON.stringify(data))
      if (body.length < 1024) {
        return originalJson(data)
      }
      zlib.gzip(body, (err, compressed) => {
        if (err) return originalJson(data)
        res.setHeader('Content-Encoding', 'gzip')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Vary', 'Accept-Encoding')
        res.send(compressed)
      })
    } catch {
      return originalJson(data)
    }
  }
  next()
})

/* ── Health & Observability Metrics ── */
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Workshop Backend API',
    version: '1.0.0',
    time: new Date().toISOString(),
  })
})

app.get('/health', (_req, res) => res.json({ status: 'healthy' }))

app.get('/api/metrics', (_req, res) => {
  const memory = process.memoryUsage()
  const cpu = process.cpuUsage()
  const uptime = process.uptime()

  res.json({
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptime),
    memory: {
      rssMB: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapTotalMB: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
      heapUsedMB: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      externalMB: Number((memory.external / 1024 / 1024).toFixed(2)),
    },
    cpu: {
      userMs: Math.round(cpu.user / 1000),
      systemMs: Math.round(cpu.system / 1000),
    },
    dbPool: {
      totalCount: globalThis.__workshopPgPool?.totalCount || 0,
      idleCount: globalThis.__workshopPgPool?.idleCount || 0,
      waitingCount: globalThis.__workshopPgPool?.waitingCount || 0,
    }
  })
})

/* ── Routes ── */
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/import-stock', importStockRoutes)
app.use('/api/people', peopleRoutes)
app.use('/api/bill-templates', billTemplateRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/emails', emailsRoutes)
app.use('/api/uoms', uomRoutes)
app.use('/api/quotes', quotesRoutes)
app.use('/api/orders', orderRoutes)

/* ── 404 Handler ── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

/* ── Global Error Handler ── */
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})



import pool from './lib/db.js'

// ── Ensure schema health on startup ──
pool.query(`
  CREATE TABLE IF NOT EXISTS workspace_members (
    id SERIAL PRIMARY KEY,
    workspace_owner_id TEXT NOT NULL,
    member_email TEXT NOT NULL,
    role TEXT DEFAULT 'Member',
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (workspace_owner_id, member_email)
  );
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
`).catch(err => console.warn('[DB Schema Init]', err.message))

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server Warning] Port ${PORT} is already in use by a running backend process.`)
    } else {
      console.error('[Server Error]', err)
    }
  })
}

export default app
