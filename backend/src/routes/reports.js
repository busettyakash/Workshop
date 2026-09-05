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
      `SELECT COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(cust.name), ''), 'Walking Customer') AS name, 
              MAX(COALESCE(c.email, cust.email, '—')) AS email, 
              COUNT(DISTINCT b.id) AS orders, 
              COALESCE(SUM(b.amount), 0) AS total_spent
       FROM bills b
       LEFT JOIN people c ON b.customer_id = c.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
       GROUP BY COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(cust.name), ''), 'Walking Customer')
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

function buildLast7DaysBuckets(d) {
  const buckets = []
  for (let i = 6; i >= 0; i--) {
    const past = new Date(d)
    past.setDate(past.getDate() - i)
    const iso = past.toISOString().slice(0, 10)
    const label = past.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    buckets.push({ key: iso, label, type: 'day', dateStr: iso })
  }
  return {
    buckets,
    dateCondition: `AND (b.created_at AT TIME ZONE 'Asia/Kolkata') >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days'`,
    groupBy: 'day'
  }
}

function buildLast30DaysBuckets(d) {
  const buckets = []
  for (let i = 4; i >= 0; i--) {
    const startD = new Date(d)
    startD.setDate(startD.getDate() - (i * 6 + 5))
    const endD = new Date(d)
    endD.setDate(endD.getDate() - (i * 6))
    const label = startD.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' - ' + endD.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    buckets.push({
      key: `r_${i}`,
      label,
      type: 'range',
      startDateStr: startD.toISOString().slice(0, 10),
      endDateStr: endD.toISOString().slice(0, 10)
    })
  }
  return {
    buckets,
    dateCondition: `AND (b.created_at AT TIME ZONE 'Asia/Kolkata') >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '29 days'`,
    groupBy: 'day'
  }
}

function buildCustomBuckets(d, startDate, endDate) {
  const s = startDate ? new Date(startDate) : new Date(d.getTime() - 6 * 86400000)
  const e = endDate ? new Date(endDate) : new Date(d)
  const startIso = s.toISOString().slice(0, 10)
  const endIso = e.toISOString().slice(0, 10)
  const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  if (diffDays <= 31) {
    const buckets = []
    for (let cur = new Date(s); cur <= e; cur = new Date(cur.getTime() + 86400000)) {
      const iso = cur.toISOString().slice(0, 10)
      const label = cur.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      buckets.push({ key: iso, label, type: 'day', dateStr: iso })
    }
    return {
      buckets,
      dateCondition: `AND (b.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN '${startIso}'::date AND '${endIso}'::date`,
      groupBy: 'day'
    }
  }

  const buckets = []
  const endMonth = new Date(e.getFullYear(), e.getMonth(), 1)
  for (let cur = new Date(s.getFullYear(), s.getMonth(), 1); cur <= endMonth; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) {
    const num = cur.getMonth() + 1
    const year = cur.getFullYear()
    const label = cur.toLocaleString('default', { month: 'short' }) + ' ' + year
    buckets.push({ key: `${year}-${num}`, label, num, year, type: 'month' })
  }
  return {
    buckets,
    dateCondition: `AND (b.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN '${startIso}'::date AND '${endIso}'::date`,
    groupBy: 'month'
  }
}

function buildMonthSpanBuckets(d, dayFilter) {
  let count = d.getMonth() + 1
  if (dayFilter === 'Last 3 months') {
    count = 3
  } else if (dayFilter === 'Last 6 months') {
    count = 6
  }
  const buckets = []
  for (let i = count - 1; i >= 0; i--) {
    const past = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const num = past.getMonth() + 1
    const year = past.getFullYear()
    const label = past.toLocaleString('default', { month: 'short' }) + ' ' + year
    buckets.push({ key: `${year}-${num}`, label, num, year, type: 'month' })
  }
  return {
    buckets,
    dateCondition: `AND (b.created_at AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '${count - 1} months')`,
    groupBy: 'month'
  }
}

function buildTimeBuckets(dayFilter, anchorDate = new Date(), startDate = '', endDate = '') {
  const d = anchorDate instanceof Date && !Number.isNaN(anchorDate.getTime()) ? anchorDate : new Date()

  if (dayFilter === 'Last 7 days') return buildLast7DaysBuckets(d)
  if (dayFilter === 'Last 30 days') return buildLast30DaysBuckets(d)
  if (dayFilter === 'Custom date' || dayFilter === 'Custom range' || dayFilter === 'Custom Date' || (startDate && endDate)) {
    return buildCustomBuckets(d, startDate, endDate)
  }
  return buildMonthSpanBuckets(d, dayFilter)
}

async function getDistinctCategories(userId) {
  const catRes = await query(
    `SELECT DISTINCT TRIM(p.category) AS category
     FROM products p
     WHERE (p.user_id::text = $1::text OR p.user_id = 'default-user' OR $1 = 'default-user')
       AND p.category IS NOT NULL AND TRIM(p.category) != ''
     ORDER BY TRIM(p.category) ASC`,
    [userId]
  )
  const cats = catRes.rows.map(r => r.category).filter(Boolean)

  const categoryColors = {}
  cats.forEach((cat, idx) => {
    categoryColors[cat] = COLOR_PALETTE[idx % COLOR_PALETTE.length]
  })

  const series = cats.map(cat => ({
    key: cat.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    label: cat,
    color: categoryColors[cat] || '#10b981'
  }))

  return { cats, categoryColors, series }
}

async function queryBarData({ timeConfig, series, customerCondition, params }) {
  const { buckets, dateCondition, groupBy } = timeConfig

  let barQuery = ''
  if (groupBy === 'day') {
    barQuery = `
      SELECT 
        (b.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date_str,
        COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS category,
        COALESCE(SUM(bi.quantity * bi.price), 0) AS category_revenue
      FROM bills b
      JOIN bill_items bi ON bi.bill_id = b.id
      LEFT JOIN products p ON bi.product_id = p.id
      LEFT JOIN people c ON b.customer_id = c.id
      LEFT JOIN customers cust ON b.customer_id = cust.id
      WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
        ${dateCondition} ${customerCondition}
      GROUP BY (b.created_at AT TIME ZONE 'Asia/Kolkata')::date, COALESCE(NULLIF(TRIM(p.category), ''), 'Others')
    `
  } else {
    barQuery = `
      SELECT 
        EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')) AS month_num,
        EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')) AS year_num,
        COALESCE(NULLIF(TRIM(p.category), ''), 'Others') AS category,
        COALESCE(SUM(bi.quantity * bi.price), 0) AS category_revenue
      FROM bills b
      JOIN bill_items bi ON bi.bill_id = b.id
      LEFT JOIN products p ON bi.product_id = p.id
      LEFT JOIN people c ON b.customer_id = c.id
      LEFT JOIN customers cust ON b.customer_id = cust.id
      WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
        ${dateCondition} ${customerCondition}
      GROUP BY EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')), EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')), COALESCE(NULLIF(TRIM(p.category), ''), 'Others')
    `
  }

  const barRes = await query(barQuery, params)

  const barDataMap = {}
  buckets.forEach(b => {
    const entry = { label: b.label }
    series.forEach(s => { entry[s.key] = 0 })
    barDataMap[b.key] = entry
  })

  barRes.rows.forEach(r => {
    const rawCat = r.category || 'Others'
    const seriesKey = rawCat.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const rev = Number.parseFloat(r.category_revenue) || 0

    if (groupBy === 'day') {
      const rowDate = r.date_str
      buckets.forEach(b => {
        const matches = (b.type === 'day' && b.dateStr === rowDate) || (b.type === 'range' && rowDate >= b.startDateStr && rowDate <= b.endDateStr)

        if (matches && barDataMap[b.key]) {
          if (barDataMap[b.key][seriesKey] !== undefined) {
            barDataMap[b.key][seriesKey] += Math.round(rev)
          } else {
            barDataMap[b.key].others = (barDataMap[b.key].others || 0) + Math.round(rev)
          }
        }
      })
    } else {
      const m = Number.parseInt(r.month_num, 10)
      const y = Number.parseInt(r.year_num, 10)
      const key = `${y}-${m}`
      if (barDataMap[key]) {
        if (barDataMap[key][seriesKey] !== undefined) {
          barDataMap[key][seriesKey] += Math.round(rev)
        } else {
          barDataMap[key].others = (barDataMap[key].others || 0) + Math.round(rev)
        }
      }
    }
  })

  return {
    barData: buckets.map(b => barDataMap[b.key]),
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

function computeTooltipData(buckets, barData, series) {
  const tooltipData = []
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i]
    const dataEntry = barData[i] || {}

    let topCategory = 'N/A'
    let maxRev = -1
    let revenueINR = 0

    series.forEach(s => {
      const rev = Number(dataEntry[s.key]) || 0
      revenueINR += rev
      if (rev > maxRev && rev > 0) {
        maxRev = rev
        topCategory = s.label
      }
    })

    const revenueUSD = revenueINR / 83.0

    let change = '+0%'
    if (i > 0) {
      const prevData = barData[i - 1] || {}
      let prevRevenue = 0
      series.forEach(s => {
        prevRevenue += Number(prevData[s.key]) || 0
      })
      if (prevRevenue > 0) {
        const diffPct = ((revenueINR - prevRevenue) / prevRevenue) * 100
        const sign = diffPct >= 0 ? '+' : ''
        change = `${sign}${Math.round(diffPct)}%`
      }
    }

    tooltipData.push({
      month: b.label,
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
  const { dayFilter = 'Last 30 days', customerFilter = 'All Customers', productFilter = 'All Products', startDate = '', endDate = '' } = req.query
  const cacheKey = `reports:bm:${userId}:${dayFilter}:${customerFilter}:${productFilter}:${startDate}:${endDate}`

  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) return res.json(cached)

    const timeConfig = buildTimeBuckets(dayFilter, new Date(), startDate, endDate)

    const params = [userId]
    let customerCondition = ''
    if (customerFilter && customerFilter !== 'All Customers') {
      if (customerFilter.toLowerCase().includes('walk') || customerFilter.toLowerCase().includes('general')) {
        customerCondition = `AND (b.customer_id IS NULL OR c.name ILIKE '%walk%' OR cust.name ILIKE '%walk%' OR c.name IS NULL)`
      } else {
        params.push(customerFilter)
        customerCondition = `AND (c.name = $${params.length} OR c.name ILIKE $${params.length} OR cust.name = $${params.length} OR cust.name ILIKE $${params.length})`
      }
    }

    if (productFilter && productFilter !== 'All Products') {
      params.push(productFilter)
      customerCondition += ` AND (p.name = $${params.length} OR p.name ILIKE $${params.length})`
    }

    const { categoryColors, series } = await getDistinctCategories(userId)

    const [{ barData }, donutData] = await Promise.all([
      queryBarData({ timeConfig, series, customerCondition, params }),
      queryDonutData({ dateCondition: timeConfig.dateCondition, customerCondition, params, categoryColors })
    ])

    const tooltipData = computeTooltipData(timeConfig.buckets, barData, series)
    const result = { series, barData, donutData, tooltipData }

    await redis.set(cacheKey, result, { ex: 15 }).catch(() => {})
    res.json(result)
  } catch (err) {
    console.error('[BUSINESS METRICS ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

function buildCategorySeries(allCategoryProducts, productFilter) {
  const isProductFiltered = Boolean(productFilter && productFilter !== 'All Products')
  const filteredProds = isProductFiltered
    ? allCategoryProducts.filter(p => p.name.toLowerCase() === productFilter.toLowerCase())
    : allCategoryProducts

  const series = (filteredProds.length > 0 ? filteredProds : allCategoryProducts).map((prod) => {
    const originalIdx = allCategoryProducts.findIndex(p => p.id === prod.id)
    return {
      key: `prod_${prod.id}`,
      id: prod.id,
      label: prod.name,
      unit: prod.unit,
      color: COLOR_PALETTE[(originalIdx >= 0 ? originalIdx : 0) % COLOR_PALETTE.length]
    }
  })

  return { isProductFiltered, filteredProds, series }
}

function buildCategoryBreakdownFilters(userId, category, customerFilter, productFilter, isProductFiltered) {
  const params = [userId, category]
  let customerCondition = ''
  if (customerFilter && customerFilter !== 'All Customers') {
    if (customerFilter.toLowerCase().includes('walk') || customerFilter.toLowerCase().includes('general')) {
      customerCondition = `AND (b.customer_id IS NULL OR c.name ILIKE '%walk%' OR cust.name ILIKE '%walk%' OR c.name IS NULL)`
    } else {
      params.push(customerFilter)
      customerCondition = `AND (c.name = $${params.length} OR c.name ILIKE $${params.length} OR cust.name = $${params.length} OR cust.name ILIKE $${params.length})`
    }
  }

  let prodFilterCondition = ''
  if (isProductFiltered) {
    params.push(productFilter)
    prodFilterCondition = `AND (p.name = $${params.length} OR p.name ILIKE $${params.length})`
  }

  return { params, customerCondition, prodFilterCondition }
}

function getCategoryBarQuery(groupBy, dateCondition, customerCondition, prodFilterCondition) {
  if (groupBy === 'day') {
    return `
      SELECT 
        (b.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date_str,
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(SUM(bi.quantity), 0) AS units_sold,
        COALESCE(SUM(bi.quantity * bi.price), 0) AS product_revenue
      FROM bills b
      JOIN bill_items bi ON bi.bill_id = b.id
      JOIN products p ON bi.product_id = p.id
      LEFT JOIN people c ON b.customer_id = c.id
      LEFT JOIN customers cust ON b.customer_id = cust.id
      WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
        AND COALESCE(NULLIF(TRIM(p.category), ''), 'Others') ILIKE $2
        ${dateCondition} ${customerCondition} ${prodFilterCondition}
      GROUP BY (b.created_at AT TIME ZONE 'Asia/Kolkata')::date, p.id, p.name
    `
  }
  return `
    SELECT 
      EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')) AS month_num,
      EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')) AS year_num,
      p.id AS product_id,
      p.name AS product_name,
      COALESCE(SUM(bi.quantity), 0) AS units_sold,
      COALESCE(SUM(bi.quantity * bi.price), 0) AS product_revenue
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    JOIN products p ON bi.product_id = p.id
    LEFT JOIN people c ON b.customer_id = c.id
    LEFT JOIN customers cust ON b.customer_id = cust.id
    WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
      AND COALESCE(NULLIF(TRIM(p.category), ''), 'Others') ILIKE $2
      ${dateCondition} ${customerCondition} ${prodFilterCondition}
    GROUP BY EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')), EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'Asia/Kolkata')), p.id, p.name
  `
}

function aggregateCategoryBarRows(rows, buckets, groupBy, series) {
  const barDataMap = {}
  buckets.forEach(b => {
    const entry = { label: b.label }
    series.forEach(s => { entry[s.key] = 0 })
    barDataMap[b.key] = entry
  })

  rows.forEach(r => {
    const seriesKey = `prod_${r.product_id}`
    const rev = Number.parseFloat(r.product_revenue) || 0

    if (groupBy === 'day') {
      const rowDate = r.date_str
      buckets.forEach(b => {
        const matches = (b.type === 'day' && b.dateStr === rowDate) || (b.type === 'range' && rowDate >= b.startDateStr && rowDate <= b.endDateStr)
        if (matches && barDataMap[b.key] && barDataMap[b.key][seriesKey] !== undefined) {
          barDataMap[b.key][seriesKey] = (barDataMap[b.key][seriesKey] || 0) + Math.round(rev)
        }
      })
    } else {
      const m = Number.parseInt(r.month_num, 10)
      const y = Number.parseInt(r.year_num, 10)
      const key = `${y}-${m}`
      if (barDataMap[key] && barDataMap[key][seriesKey] !== undefined) {
        barDataMap[key][seriesKey] = (barDataMap[key][seriesKey] || 0) + Math.round(rev)
      }
    }
  })

  return buckets.map(b => barDataMap[b.key])
}

async function queryCategoryBarData({ timeConfig, series, params, customerCondition, prodFilterCondition }) {
  const { buckets, dateCondition, groupBy } = timeConfig
  const barQuery = getCategoryBarQuery(groupBy, dateCondition, customerCondition, prodFilterCondition)
  const barRes = await query(barQuery, params)
  return aggregateCategoryBarRows(barRes.rows, buckets, groupBy, series)
}

async function queryCategoryDonutData({ params, dateCondition, customerCondition, prodFilterCondition, isProductFiltered, filteredProds, series }) {
  const donutQuery = `
    SELECT 
      p.id AS product_id,
      p.name AS label,
      COALESCE(NULLIF(TRIM(p.unit), ''), 'pcs') AS unit,
      COUNT(DISTINCT b.id) AS count,
      COALESCE(SUM(bi.quantity), 0) AS total_units,
      COALESCE(SUM(bi.quantity * bi.price), 0) AS total_revenue
    FROM bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    JOIN products p ON bi.product_id = p.id
    LEFT JOIN people c ON b.customer_id = c.id
    LEFT JOIN customers cust ON b.customer_id = cust.id
    WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')
      AND COALESCE(NULLIF(TRIM(p.category), ''), 'Others') ILIKE $2
      ${dateCondition} ${customerCondition} ${prodFilterCondition}
    GROUP BY p.id, p.name, p.unit
    ORDER BY total_revenue DESC
  `
  const donutRes = await query(donutQuery, params)
  const totalRevAll = donutRes.rows.reduce((sum, r) => sum + Number.parseFloat(r.total_revenue || 0), 0)

  if (donutRes.rows.length === 0 && isProductFiltered && filteredProds.length > 0) {
    const selProd = filteredProds[0]
    const matchedSeries = series.find(s => String(s.id) === String(selProd.id))
    return {
      donutRes,
      totalRevAll,
      donutData: [{
        id: selProd.id,
        label: selProd.name,
        unit: selProd.unit,
        count: 0,
        units_sold: 0,
        revenue: 0,
        pct: 0,
        color: matchedSeries ? matchedSeries.color : COLOR_PALETTE[0]
      }]
    }
  }

  const donutData = donutRes.rows.map((r, idx) => {
    const rev = Number.parseFloat(r.total_revenue) || 0
    const pct = totalRevAll > 0 ? Math.round((rev / totalRevAll) * 100) : 0
    const matchedSeries = series.find(s => String(s.id) === String(r.product_id))
    return {
      id: r.product_id,
      label: r.label,
      unit: r.unit,
      count: Number.parseInt(r.count, 10),
      units_sold: Number.parseFloat(r.total_units) || 0,
      revenue: rev,
      pct,
      color: matchedSeries ? matchedSeries.color : COLOR_PALETTE[idx % COLOR_PALETTE.length]
    }
  })

  return { donutRes, totalRevAll, donutData }
}

/* GET /api/reports/category-breakdown — Product-level breakdown for a specific category */
router.get('/category-breakdown', async (req, res) => {
  const userId = req.workspaceId
  const { category = 'Grains', dayFilter = 'Last 7 days', customerFilter = 'All Customers', productFilter = 'All Products', startDate = '', endDate = '' } = req.query
  const cacheKey = `reports:cat-breakdown:${userId}:${category}:${dayFilter}:${customerFilter}:${productFilter}:${startDate}:${endDate}`

  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) return res.json(cached)

    const timeConfig = buildTimeBuckets(dayFilter, new Date(), startDate, endDate)

    // 1. Get ALL distinct products in this category
    const allProdRes = await query(
      `SELECT DISTINCT p.id, p.name, COALESCE(NULLIF(TRIM(p.unit), ''), 'pcs') AS unit
       FROM products p
       WHERE (p.user_id::text = $1::text OR p.user_id = 'default-user' OR $1 = 'default-user')
         AND COALESCE(NULLIF(TRIM(p.category), ''), 'Others') ILIKE $2
       ORDER BY p.name ASC`,
      [userId, category]
    )

    const allCategoryProducts = allProdRes.rows
    const { isProductFiltered, filteredProds, series } = buildCategorySeries(allCategoryProducts, productFilter)
    const { params, customerCondition, prodFilterCondition } = buildCategoryBreakdownFilters(userId, category, customerFilter, productFilter, isProductFiltered)

    const [barData, { donutRes, totalRevAll, donutData }] = await Promise.all([
      queryCategoryBarData({ timeConfig, series, params, customerCondition, prodFilterCondition }),
      queryCategoryDonutData({ params, dateCondition: timeConfig.dateCondition, customerCondition, prodFilterCondition, isProductFiltered, filteredProds, series })
    ])

    const tooltipData = computeTooltipData(timeConfig.buckets, barData, series)

    const result = {
      category,
      series,
      allCategoryProducts: allCategoryProducts.map(p => p.name),
      barData,
      donutData,
      tooltipData,
      totalRevenue: totalRevAll,
      totalOrders: donutRes.rows.reduce((sum, r) => sum + Number.parseInt(r.count, 10), 0),
      totalUnits: donutRes.rows.reduce((sum, r) => sum + Number.parseFloat(r.total_units, 10), 0),
      totalProductsCount: allCategoryProducts.length
    }

    await redis.set(cacheKey, result, { ex: 15 }).catch(() => {})
    res.json(result)
  } catch (err) {
    console.error('[CATEGORY BREAKDOWN ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
