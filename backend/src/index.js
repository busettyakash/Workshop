import 'dotenv/config'
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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import express from 'express'
import cors from 'cors'

import authRoutes     from './routes/auth.js'
import productRoutes  from './routes/products.js'
import billingRoutes  from './routes/billing.js'
import customerRoutes from './routes/customers.js'
import reportRoutes   from './routes/reports.js'
import workflowRoutes from './routes/workflows.js'
import chatRoutes     from './routes/chat.js'
import importStockRoutes from './routes/importStock.js'
import peopleRoutes   from './routes/people.js'
import dealsRoutes    from './routes/deals.js'
import companiesRoutes  from './routes/companies.js'
import billTemplateRoutes from './routes/billTemplates.js'
import recordRoutes from './routes/records.js'
import notesRoutes  from './routes/notes.js'
import emailsRoutes from './routes/emails.js'
import uomRoutes    from './routes/uoms.js'

const app  = express()
app.disable('x-powered-by')
const PORT = process.env.PORT || 5000

/* ── Request Logger Middleware ── */
app.use((req, res, next) => {
  const start = Date.now()
  const originalSend = res.send
  res.send = function (...args) {
    const duration = Date.now() - start
    const logLine = `[Request] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms) - Auth: ${req.headers.authorization ? 'Yes' : 'No'} - Workspace: ${req.headers['x-workspace-id'] || 'None'}`
    console.log(logLine)
    return originalSend.apply(res, args)
  }
  next()
})

/* ── Middleware ── */
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean)
    // Allow any vercel.app preview/production URL
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

/* ── Health check ── */
app.get('/', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'Workshop Backend API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  })
})

app.get('/health', (_req, res) => res.json({ status: 'healthy' }))

/* ── Routes ── */
app.use('/api/auth',          authRoutes)
app.use('/api/products',      productRoutes)
app.use('/api/billing',       billingRoutes)
app.use('/api/customers',     customerRoutes)
app.use('/api/reports',       reportRoutes)
app.use('/api/workflows',     workflowRoutes)
app.use('/api/chat',          chatRoutes)
app.use('/api/import-stock',  importStockRoutes)
app.use('/api/people',        peopleRoutes)
app.use('/api/deals',         dealsRoutes)
app.use('/api/companies',     companiesRoutes)
app.use('/api/bill-templates', billTemplateRoutes)
app.use('/api/records',        recordRoutes)
app.use('/api/notes',          notesRoutes)
app.use('/api/emails',         emailsRoutes)
app.use('/api/uoms',           uomRoutes)

/* ── 404 handler ── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

// Only listen in local dev — Vercel handles routing in production
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Workshop Backend running on http://localhost:${PORT}`)
    console.log(`   InsForge: ${process.env.INSFORGE_API_BASE_URL}`)
  })
}

export default app
