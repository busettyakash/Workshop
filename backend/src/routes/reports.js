import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* GET /api/reports/sales — daily sales summary */
router.get('/sales', async (req, res) => {
  const userId = req.workspaceId
  const { from, to } = req.query
  const start = from || new Date(Date.now() - 30 * 86400000).toISOString()
  const end   = to   || new Date().toISOString()
  try {
    const { rows } = await query(
      `SELECT DATE(created_at) AS date,
              COUNT(*) AS order_count,
              COALESCE(SUM(amount),0) AS total_revenue
       FROM bills
       WHERE status='paid' AND user_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY DATE(created_at) ORDER BY date ASC`,
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
      query(`SELECT COALESCE(SUM(amount),0) AS today FROM bills WHERE status='paid' AND user_id = $1 AND DATE(created_at)=CURRENT_DATE`, [userId]),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE stock < 5) AS low_stock FROM products WHERE user_id = $1`, [userId]),
      query(`SELECT COUNT(*) AS total FROM people WHERE user_id = $1`, [userId]),
      query(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM bills WHERE status='unpaid' AND user_id = $1`, [userId]),
    ])
    res.json({
      today_sales:    parseFloat(sales.rows[0].today),
      total_products: parseInt(products.rows[0].total),
      low_stock:      parseInt(products.rows[0].low_stock),
      total_customers:parseInt(customers.rows[0].total),
      unpaid_count:   parseInt(unpaid.rows[0].count),
      unpaid_amount:  parseFloat(unpaid.rows[0].amount),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/reports/top-products */
router.get('/top-products', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT p.name, p.category, SUM(bi.quantity) AS units_sold, SUM(bi.quantity * p.price) AS revenue
       FROM bill_items bi JOIN products p ON bi.product_id = p.id
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.status='paid' AND b.user_id = $1
       GROUP BY p.id, p.name, p.category ORDER BY revenue DESC LIMIT 10`,
      [userId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/reports/top-customers */
router.get('/top-customers', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT c.name, c.email, COUNT(b.id) AS orders, COALESCE(SUM(b.amount),0) AS total_spent
       FROM people c JOIN bills b ON b.customer_id=c.id
       WHERE b.status='paid' AND b.user_id = $1
       GROUP BY c.id, c.name, c.email ORDER BY total_spent DESC LIMIT 10`,
      [userId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function syncBillItems(userId) {
  try {
    const { rows: bills } = await query("SELECT id, items FROM bills WHERE user_id = $1", [userId])
    for (const b of bills) {
      const check = await query("SELECT id FROM bill_items WHERE bill_id = $1 LIMIT 1", [b.id])
      if (check.rows.length === 0) {
        let itemsList = []
        if (typeof b.items === 'string') {
          try { itemsList = JSON.parse(b.items) } catch(e) {}
        } else if (Array.isArray(b.items)) {
          itemsList = b.items
        }
        for (const item of itemsList) {
          const productId = item.product_id || item.id
          const qty = parseFloat(item.qty || item.quantity || 1)
          const price = parseFloat(item.price || 0)
          if (productId) {
            const prodCheck = await query("SELECT id FROM products WHERE id = $1 AND user_id = $2", [productId, userId])
            if (prodCheck.rows.length > 0) {
              await query(
                `INSERT INTO bill_items (bill_id, product_id, quantity, price)
                 VALUES ($1, $2, $3, $4)`,
                [b.id, productId, Math.round(qty), price]
              )
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SYNC BILL ITEMS ERROR]', err)
  }
}

/* GET /api/reports/business-metrics — Dynamic metrics for the charts */
router.get('/business-metrics', async (req, res) => {
  const userId = req.workspaceId
  const { dayFilter = 'Last 30 days', customerFilter = 'All Customers' } = req.query
  try {
    // Sync existing bills into bill_items on-the-fly
    await syncBillItems(userId)

    // 1. Get max date in database to anchor our date filters
    const maxDateRes = await query("SELECT COALESCE(MAX(created_at), NOW()) AS max_date FROM bills WHERE user_id = $1", [userId])
    const maxDate = maxDateRes.rows[0].max_date

    // 2. Build date condition based on dayFilter
    let dateCondition = "AND b.created_at BETWEEN '2024-07-01' AND '2024-09-30 23:59:59'"
    if (dayFilter === 'Last 7 days') {
      dateCondition = `AND b.created_at >= CAST('${maxDate.toISOString()}' AS TIMESTAMP) - INTERVAL '7 days'`
    } else if (dayFilter === 'Last 30 days') {
      dateCondition = `AND b.created_at >= CAST('${maxDate.toISOString()}' AS TIMESTAMP) - INTERVAL '30 days'`
    } else if (dayFilter === 'Last 3 months') {
      dateCondition = `AND b.created_at >= CAST('${maxDate.toISOString()}' AS TIMESTAMP) - INTERVAL '90 days'`
    } else if (dayFilter === 'Last 6 months') {
      dateCondition = `AND b.created_at >= CAST('${maxDate.toISOString()}' AS TIMESTAMP) - INTERVAL '180 days'`
    } else if (dayFilter === 'This year') {
      dateCondition = `AND EXTRACT(YEAR FROM b.created_at) = EXTRACT(YEAR FROM CAST('${maxDate.toISOString()}' AS TIMESTAMP))`
    }

    // 3. Build customer condition
    let customerCondition = ""
    if (customerFilter !== 'All Customers') {
      customerCondition = "AND c.name = $2"
    }

    // Calculate the last 3 months based on maxDate or current date
    const d = new Date(maxDate)
    const months = []
    for (let i = 2; i >= 0; i--) {
      const pastDate = new Date(d.getFullYear(), d.getMonth() - i, 1)
      months.push({
        num: pastDate.getMonth() + 1,
        year: pastDate.getFullYear(),
        label: pastDate.toLocaleString('default', { month: 'short' }) + ' ' + pastDate.getFullYear()
      })
    }

    const monthNums = months.map(m => m.num).join(',')
    const yearNums = Array.from(new Set(months.map(m => m.year))).join(',')

    // 4. Query Bar Chart Data grouped by Product Category
    const barQuery = `
      SELECT 
        EXTRACT(MONTH FROM b.created_at) AS month_num,
        EXTRACT(YEAR FROM b.created_at) AS year_num,
        p.category,
        COALESCE(SUM(bi.quantity * bi.price), 0) AS category_revenue
      FROM bills b
      JOIN bill_items bi ON bi.bill_id = b.id
      JOIN products p ON bi.product_id = p.id
      LEFT JOIN people c ON b.customer_id = c.id
      WHERE b.status = 'paid' AND b.user_id = $1 ${dateCondition} ${customerCondition}
        AND EXTRACT(MONTH FROM b.created_at) IN (${monthNums})
        AND EXTRACT(YEAR FROM b.created_at) IN (${yearNums})
      GROUP BY EXTRACT(MONTH FROM b.created_at), EXTRACT(YEAR FROM b.created_at), p.category
    `
    const barParams = [userId]
    if (customerFilter !== 'All Customers') {
      barParams.push(customerFilter)
    }
    const barRes = await query(barQuery, barParams)

    const barDataMap = {}
    months.forEach(m => {
      barDataMap[`${m.year}-${m.num}`] = {
        label: m.label,
        electronics: 0,
        apparel: 0,
        grocery: 0,
        appliances: 0,
        others: 0
      }
    })
    
    barRes.rows.forEach(r => {
      const m = parseInt(r.month_num)
      const y = parseInt(r.year_num)
      const key = `${y}-${m}`
      if (barDataMap[key]) {
        const cat = (r.category || 'Others').toLowerCase()
        const scaledVal = Math.round(parseFloat(r.category_revenue) / 20000.0)
        
        if (cat === 'electronics') barDataMap[key].electronics += scaledVal
        else if (cat === 'apparel') barDataMap[key].apparel += scaledVal
        else if (cat === 'grocery') barDataMap[key].grocery += scaledVal
        else if (cat === 'appliances') barDataMap[key].appliances += scaledVal
        else barDataMap[key].others += scaledVal
      }
    })
    const barData = months.map(m => barDataMap[`${m.year}-${m.num}`])

    // 5. Query Donut Chart Data (Product Categories)
    const donutQuery = `
      SELECT 
        p.category AS label,
        COUNT(DISTINCT b.id) AS count
      FROM bill_items bi
      JOIN products p ON bi.product_id = p.id
      JOIN bills b ON bi.bill_id = b.id
      LEFT JOIN people c ON b.customer_id = c.id
      WHERE b.status = 'paid' AND b.user_id = $1 ${dateCondition} ${customerCondition}
      GROUP BY p.category
    `
    const donutParams = [userId]
    if (customerFilter !== 'All Customers') {
      donutParams.push(customerFilter)
    }
    const donutRes = await query(donutQuery, donutParams)
    const totalDonutCount = donutRes.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
    
    const colors = {
      'Electronics': '#f43f5e',
      'Apparel': '#38bdf8',
      'Grocery': '#10b981',
      'Appliances': '#a78bfa',
      'Others': '#fb923c'
    }

    const donutData = donutRes.rows.map(r => {
      const pct = totalDonutCount > 0 ? Math.round((parseInt(r.count) / totalDonutCount) * 100) : 0
      return {
        label: r.label,
        pct: pct,
        color: colors[r.label] || '#9ca3af'
      }
    })

    if (donutData.length === 0) {
      Object.keys(colors).forEach(cat => {
        donutData.push({ label: cat, pct: 0, color: colors[cat] })
      })
    }

    // 6. Query Tooltip Data (month stats, top product category, etc.)
    const tooltipData = []

    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      const topCatQuery = `
        SELECT p.category, SUM(bi.quantity * bi.price) AS cat_revenue
        FROM bill_items bi
        JOIN products p ON bi.product_id = p.id
        JOIN bills b ON bi.bill_id = b.id
        LEFT JOIN people c ON b.customer_id = c.id
        WHERE b.status = 'paid' AND b.user_id = $1
          AND EXTRACT(MONTH FROM b.created_at) = ${m.num}
          AND EXTRACT(YEAR FROM b.created_at) = ${m.year}
          ${customerCondition}
        GROUP BY p.category
        ORDER BY cat_revenue DESC
        LIMIT 1
      `
      const topCatParams = [userId]
      if (customerFilter !== 'All Customers') {
        topCatParams.push(customerFilter)
      }
      const topCatRes = await query(topCatQuery, topCatParams)
      const topCategory = topCatRes.rows[0]?.category || 'N/A'

      const monthlyRevQuery = `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bills b
        LEFT JOIN people c ON b.customer_id = c.id
        WHERE b.status = 'paid' AND b.user_id = $1
          AND EXTRACT(MONTH FROM b.created_at) = ${m.num}
          AND EXTRACT(YEAR FROM b.created_at) = ${m.year}
          ${customerCondition}
      `
      const monthlyRevParams = [userId]
      if (customerFilter !== 'All Customers') {
        monthlyRevParams.push(customerFilter)
      }
      const monthlyRevRes = await query(monthlyRevQuery, monthlyRevParams)
      const revenueINR = parseFloat(monthlyRevRes.rows[0].total)
      const revenueUSD = revenueINR / 83.0

      let change = '+0%'
      if (i > 0) {
        const prevM = months[i - 1]
        const prevMonthQuery = `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM bills b
          LEFT JOIN people c ON b.customer_id = c.id
          WHERE b.status = 'paid' AND b.user_id = $1
            AND EXTRACT(MONTH FROM b.created_at) = ${prevM.num}
            AND EXTRACT(YEAR FROM b.created_at) = ${prevM.year}
            ${customerCondition}
        `
        const prevMonthParams = [userId]
        if (customerFilter !== 'All Customers') {
          prevMonthParams.push(customerFilter)
        }
        const prevMonthRes = await query(prevMonthQuery, prevMonthParams)
        const prevRevenue = parseFloat(prevMonthRes.rows[0].total)
        if (prevRevenue > 0) {
          const diffPct = ((revenueINR - prevRevenue) / prevRevenue) * 100
          change = (diffPct >= 0 ? '+' : '') + Math.round(diffPct) + '%'
        }
      }

      tooltipData.push({
        month: m.label,
        product: topCategory,
        inr: '₹' + Math.round(revenueINR).toLocaleString('en-IN'),
        usd: 'USD ' + Math.round(revenueUSD).toLocaleString('en-US'),
        change: change
      })
    }

    res.json({ barData, donutData, tooltipData })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
