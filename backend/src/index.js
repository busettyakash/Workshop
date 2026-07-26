import 'dotenv/config'
import dns from 'dns'
const isDevelopment = process.env.NODE_ENV === 'development' && !process.env.VERCEL

if (isDevelopment) {
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
import companiesRoutes  from './routes/companies.js'
import billTemplateRoutes from './routes/billTemplates.js'
import recordRoutes from './routes/records.js'
import notesRoutes  from './routes/notes.js'
import emailsRoutes from './routes/emails.js'
import uomRoutes    from './routes/uoms.js'
import quotesRoutes from './routes/quotes.js'

const app  = express()
app.disable('x-powered-by')
const PORT = process.env.PORT || 5000

/* ── Request Logger Middleware ── */
if (isDevelopment) {
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
}

/* ── Middleware ── */
app.use(cors({
  origin: (origin, callback) => callback(null, true),
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
app.use('/api/companies',     companiesRoutes)
app.use('/api/bill-templates', billTemplateRoutes)
app.use('/api/records',        recordRoutes)
app.use('/api/notes',          notesRoutes)
app.use('/api/emails',         emailsRoutes)
app.use('/api/uoms',           uomRoutes)
app.use('/api/quotes',         quotesRoutes)

/* ── 404 Handler ── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

/* ── Global Error Handler ── */
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

export default app
