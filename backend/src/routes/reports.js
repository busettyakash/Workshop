import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const TZ = `'UTC' AT TIME ZONE 'Asia/Kolkata'`

const router = Router()
router.use(requireAuth)
router.get('/sales', async (req, res) => {
  const userId = req.workspaceId
  const { from, to } = req.query
  const start = from || new Date(Date.now() - 30 * 86400000).toISOString()
  const end   = to   || new Date().toISOString()
  try {
    const { rows } = await query(
      `SELECT (created_at AT TIME ZONE ${TZ})::date AS date,
              COUNT(*) AS order_count,
              COALESCE(SUM(amount),0) AS total_revenue
       FROM bills
       WHERE status='paid' AND user_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY (created_at AT TIME ZONE ${TZ})::date ORDER BY date ASC`,
      [userId, start, end]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/reports/dashboard — KPI summary */
router.get('/dashboard', async (req, res) => {
  const userId = req.workspaceId
  try {
    const [sales, products, customers, unpaid] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount),0) AS today FROM bills WHERE status='paid' AND user_id = $1 AND (created_at AT TIME ZONE ${TZ})::date = (NOW() AT TIME ZONE ${TZ})::date`, [userId]),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE stock < 5) AS low_stock FROM products WHERE user_id = $1`, [userId]),
      query(`SELECT COUNT(*) AS total FROM people WHERE user_id = $1`, [userId]),
      query(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM bills WHERE status='unpaid' AND user_id = $1`, [userId]),
    ])
    res.json({
      today_sales:    Number.parseFloat(sales.rows[0].today),
      total_products: Number.parseInt(products.rows[0].total),
      low_stock:      Number.parseInt(products.rows[0].low_stock),
      total_customers:Number.parseInt(customers.rows[0].total),
      unpaid_count:   Number.parseInt(unpaid.rows[0].count),
      unpaid_amount:  Number.parseFloat(unpaid.rows[0].amount),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/reports/top-products */
router.get('/top-products', async (req, res) => {
  const userId = req.workspaceId
  const cacheKey = `reports:top-products:${userId}`
  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) return res.json(cached)

    const { rows } = await query(
      `SELECT p.name, COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS category, 
              COALESCE(NULLIF(TRIM(p.unit), ''), 'units') AS uom,
              SUM(bi.quantity) AS units_sold, SUM(bi.quantity * bi.price) AS revenue
       FROM bill_items bi JOIN products p ON bi.product_id = p.id
       JOIN bills b ON bi.bill_id = b.id
       WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
       GROUP BY p.id, p.name, p.category, p.unit ORDER BY revenue DESC LIMIT 15`,
      [userId]
    )
    await redis.set(cacheKey, rows, { ex: 30 }).catch(() => {})
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/reports/top-customers */
router.get('/top-customers', async (req, res) => {
  const userId = req.workspaceId
  const cacheKey = `reports:top-customers:${userId}`
  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) return res.json(cached)

    const { rows } = await query(
      `SELECT COALESCE(c.name, cust.name) AS name, 
              MAX(COALESCE(c.email, cust.email, '')) AS email, 
              COUNT(DISTINCT b.id) AS orders, 
              COALESCE(SUM(b.amount), 0) AS total_spent
       FROM bills b
       LEFT JOIN people c ON b.customer_id = c.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
         AND (c.name IS NOT NULL OR cust.name IS NOT NULL)
       GROUP BY COALESCE(c.name, cust.name)
       ORDER BY total_spent DESC LIMIT 15`,
      [userId]
    )
    await redis.set(cacheKey, rows, { ex: 30 }).catch(() => {})
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const COLOR_PALETTE = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
]

function buildDateCondition(dayFilter, maxDateIso) {
  if (dayFilter === 'Last 7 days') {
    return `AND (b.created_at AT TIME ZONE ${TZ}) >= (CAST('${maxDateIso}' AS TIMESTAMP WITH TIME ZONE) AT TIME ZONE ${TZ}) - INTERVAL '7 days'`
  }
  if (dayFilter === 'Last 30 days') {
    return `AND (b.created_at AT TIME ZONE ${TZ}) >= (CAST('${maxDateIso}' AS TIMESTAMP WITH TIME ZONE) AT TIME ZONE ${TZ}) - INTERVAL '30 days'`
  }
  if (dayFilter === 'Last 3 months') {
    return `AND (b.created_at AT TIME ZONE ${TZ}) >= (CAST('${maxDateIso}' AS TIMESTAMP WITH TIME ZONE) AT TIME ZONE ${TZ}) - INTERVAL '90 days'`
  }
  if (dayFilter === 'Last 6 months') {
    return `AND (b.created_at AT TIME ZONE ${TZ}) >= (CAST('${maxDateIso}' AS TIMESTAMP WITH TIME ZONE) AT TIME ZONE ${TZ}) - INTERVAL '180 days'`
  }
  if (dayFilter === 'This year') {
    return `AND EXTRACT(YEAR FROM (b.created_at AT TIME ZONE ${TZ})) = EXTRACT(YEAR FROM (CAST('${maxDateIso}' AS TIMESTAMP WITH TIME ZONE) AT TIME ZONE ${TZ}))`
  }
  return ''
}

function buildMonthsWindow(anchorDate) {
  const d = anchorDate instanceof Date && !Number.isNaN(anchorDate.getTime()) ? anchorDate : new Date()
  const months = []
  for (let i = 2; i >= 0; i--) {
    const pastDate = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push({
      num: pastDate.getMonth() + 1,
      year: pastDate.getFullYear(),
      label: pastDate.toLocaleString('default', { month: 'short' }) + ' ' + pastDate.getFullYear()
    })
  }
  return months
}

async function getDistinctCategories(userId) {
  const catRes = await query(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS category
     FROM products p
     WHERE (p.user_id::text = $1::text OR p.user_id = 'default-user' OR $1 = 'default-user')`,
    [userId]
  )
  const cats = catRes.rows.map(r => r.category).filter(Boolean)
  if (!cats.includes('Others')) cats.push('Others')

  const categoryColors = {}
  cats.forEach((cat, idx) => {
    categoryColors[cat] = COLOR_PALETTE[idx % COLOR_PALETTE.length]
  })

  const series = cats.map(cat => ({
    key: cat.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    label: cat,
    color: categoryColors[cat] || '#64748b'
  }))

  return { cats, categoryColors, series }
}

async function queryBarData({ months, series, dateCondition, customerCondition, params }) {
  const monthNums = months.map(m => m.num).join(',')
  const yearNums = Array.from(new Set(months.map(m => m.year))).join(',')

  const barQuery = `
    SELECT 
      EXTRACT(MONTH FROM (b.created_at AT TIME ZONE ${TZ})) AS month_num,
      EXTRACT(YEAR FROM (b.created_at AT TIME ZONE ${TZ})) AS year_num,
      COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS category,
      COALESCE(SUM(bi.quantity * bi.price), 0) AS category_revenue
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN people c ON b.customer_id = c.id
    LEFT JOIN customers cust ON b.customer_id = cust.id
    WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
      ${dateCondition} ${customerCondition}
      AND EXTRACT(MONTH FROM (b.created_at AT TIME ZONE ${TZ})) IN (${monthNums})
      AND EXTRACT(YEAR FROM (b.created_at AT TIME ZONE ${TZ})) IN (${yearNums})
    GROUP BY EXTRACT(MONTH FROM (b.created_at AT TIME ZONE ${TZ})), EXTRACT(YEAR FROM (b.created_at AT TIME ZONE ${TZ})), COALESCE(NULLIF(TRIM(p.category), ''), 'Others')
  `
  const barRes = await query(barQuery, params)

  const barDataMap = {}
  months.forEach(m => {
    const entry = { label: m.label }
    series.forEach(s => { entry[s.key] = 0 })
    barDataMap[`${m.year}-${m.num}`] = entry
  })

  barRes.rows.forEach(r => {
    const m = Number.parseInt(r.month_num, 10)
    const y = Number.parseInt(r.year_num, 10)
    const key = `${y}-${m}`
    if (barDataMap[key]) {
      const rawCat = r.category || 'Others'
      const seriesKey = rawCat.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const rev = Number.parseFloat(r.category_revenue) || 0
      if (barDataMap[key][seriesKey] !== undefined) {
        barDataMap[key][seriesKey] += Math.round(rev)
      } else {
        barDataMap[key].others = (barDataMap[key].others || 0) + Math.round(rev)
      }
    }
  })

  return {
    barData: months.map(m => barDataMap[`${m.year}-${m.num}`]),
    barRows: barRes.rows
  }
}

async function queryDonutData({ dateCondition, customerCondition, params, categoryColors }) {
  const donutQuery = `
    SELECT 
      COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS label,
      COUNT(DISTINCT b.id) AS count,
      COALESCE(SUM(bi.quantity * bi.price), 0) AS total_revenue
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN people c ON b.customer_id = c.id
    LEFT JOIN customers cust ON b.customer_id = cust.id
    WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
      ${dateCondition} ${customerCondition}
    GROUP BY COALESCE(NULLIF(TRIM(p.category), ''), 'Others')
    ORDER BY count DESC
  `
  const donutRes = await query(donutQuery, params)
  const totalCount = donutRes.rows.reduce((sum, r) => sum + Number.parseInt(r.count, 10), 0)

  return donutRes.rows.map(r => {
    const cnt = Number.parseInt(r.count, 10)
    const pct = totalCount > 0 ? Math.round((cnt / totalCount) * 100) : 0
    return {
      label: r.label,
      count: cnt,
      revenue: Number.parseFloat(r.total_revenue) || 0,
      pct,
      color: categoryColors[r.label] || '#64748b'
    }
  })
}

function computeTooltipData(months, barRows) {
  const tooltipData = []
  for (let i = 0; i < months.length; i++) {
    const m = months[i]
    const monthRows = barRows.filter(
      r => Number.parseInt(r.month_num, 10) === m.num && Number.parseInt(r.year_num, 10) === m.year
    )
    let topCategory = 'N/A'
    let maxRev = -1
    let revenueINR = 0

    monthRows.forEach(r => {
      const rev = Number.parseFloat(r.category_revenue) || 0
      revenueINR += rev
      if (rev > maxRev) {
        maxRev = rev
        topCategory = r.category || 'N/A'
      }
    })

    const revenueUSD = revenueINR / 83.0

    let change = '+0%'
    if (i > 0) {
      const prevM = months[i - 1]
      const prevMonthRows = barRows.filter(
        r => Number.parseInt(r.month_num, 10) === prevM.num && Number.parseInt(r.year_num, 10) === prevM.year
      )
      const prevRevenue = prevMonthRows.reduce(
        (sum, r) => sum + (Number.parseFloat(r.category_revenue) || 0),
        0
      )
      if (prevRevenue > 0) {
        const diffPct = ((revenueINR - prevRevenue) / prevRevenue) * 100
        const sign = diffPct >= 0 ? '+' : ''
        change = `${sign}${Math.round(diffPct)}%`
      }
    }

    tooltipData.push({
      month: m.label,
      product: topCategory,
      inr: '₹' + Math.round(revenueINR).toLocaleString('en-IN'),
      usd: 'USD ' + Math.round(revenueUSD).toLocaleString('en-US'),
      change
    })
  }
  return tooltipData
}

/* GET /api/reports/business-metrics — Dynamic metrics for the charts */
router.get('/business-metrics', async (req, res) => {
  const userId = req.workspaceId
  const { dayFilter = 'Last 30 days', customerFilter = 'All Customers' } = req.query
  const cacheKey = `reports:bm:${userId}:${dayFilter}:${customerFilter}`

  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) return res.json(cached)

    const dateCondition = buildDateCondition(dayFilter, new Date().toISOString())

    const params = [userId]
    let customerCondition = ''
    if (customerFilter && customerFilter !== 'All Customers') {
      params.push(customerFilter)
      customerCondition = `AND (c.name = $${params.length} OR c.name ILIKE $${params.length} OR cust.name = $${params.length} OR cust.name ILIKE $${params.length})`
    }

    const months = buildMonthsWindow(new Date())
    const { categoryColors, series } = await getDistinctCategories(userId)

    const [{ barData, barRows }, donutData] = await Promise.all([
      queryBarData({ months, series, dateCondition, customerCondition, params }),
      queryDonutData({ dateCondition, customerCondition, params, categoryColors })
    ])

    const tooltipData = computeTooltipData(months, barRows)
    const result = { series, barData, donutData, tooltipData }

    await redis.set(cacheKey, result, { ex: 30 }).catch(() => {})
    res.json(result)
  } catch (err) {
    console.error('[BUSINESS METRICS ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
