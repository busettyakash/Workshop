import { Router } from 'express'
import crypto from 'node:crypto'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { getProductHsnMap, enrichItemsWithCache } from '../lib/productCache.js'
import { logStockHistory } from './products.js'


const router = Router()
router.use(requireAuth)

let ensureBillingSchemaPromise

async function ensureBillingSchema() {
  await query(
    `ALTER TABLE bill_items
     ALTER COLUMN quantity TYPE NUMERIC(10, 2)
     USING quantity::numeric(10, 2)`
  ).catch(() => { })
  await query(`ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS address TEXT`).catch(() => { })
  await query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50)`).catch(() => { })
  await query(`ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_customer_id_fkey`).catch(() => { })
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_kg NUMERIC(10, 2) DEFAULT 0`).catch(() => { })
}

router.use(async (_req, _res, next) => {
  try {
    ensureBillingSchemaPromise ||= ensureBillingSchema().catch((err) => {
      ensureBillingSchemaPromise = null
      throw err
    })
    await ensureBillingSchemaPromise
    next()
  } catch (err) {
    next(err)
  }
})

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

function buildBillingWhere(queryObj, userId, includeStatus = true) {
  const { status, search, date, month, year, startDate, endDate } = queryObj
  const params = [userId]
  const conditions = ["(b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')"]

  if (includeStatus && status && status !== 'all') {
    params.push(status)
    conditions.push(`b.status = $${params.length}`)
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`)
    conditions.push(`(
      COALESCE(p.name, '') ILIKE $${params.length} 
      OR COALESCE(cust.name, '') ILIKE $${params.length} 
      OR COALESCE(b.bill_number, '') ILIKE $${params.length} 
      OR COALESCE(b.order_number, '') ILIKE $${params.length} 
      OR CAST(b.id AS TEXT) ILIKE $${params.length}
    )`)
  }

  if (date) {
    params.push(date)
    conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}::date`)
  } else {
    if (year) {
      params.push(Number.parseInt(year, 10))
      conditions.push(`EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) = $${params.length}`)
    }
    if (month) {
      params.push(Number.parseInt(month, 10))
      conditions.push(`EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) = $${params.length}`)
    }
    if (startDate) {
      params.push(startDate)
      conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`)
    }
    if (endDate) {
      params.push(endDate)
      conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`)
    }
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params }
}

/* GET /api/billing?status=paid|unpaid&date=YYYY-MM-DD&month=1-12&year=2026 */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { sort } = req.query

  const { where, params } = buildBillingWhere(req.query, userId, true)

  let orderCol = 'b.created_at DESC, b.id DESC'
  if (sort === 'id_asc') orderCol = 'b.id ASC'
  else if (sort === 'id_desc') orderCol = 'b.id DESC'
  else if (sort === 'amount_asc') orderCol = 'b.amount ASC, b.id DESC'
  else if (sort === 'amount_desc') orderCol = 'b.amount DESC, b.id DESC'

  try {
    if (cursor) {
      const cursorParams = [...params]
      const cursorConditions = [where ? where.replace(/^WHERE /, '') : '']
      if (cursor.created_at && cursor.id) {
        cursorParams.push(cursor.created_at, cursor.id)
        cursorConditions.push(`(b.created_at, b.id) < ($${cursorParams.length - 1}, $${cursorParams.length})`)
      }
      const cursorWhere = `WHERE ${cursorConditions.filter(Boolean).join(' AND ')}`
      cursorParams.push(limit + 1)
      const { rows } = await query(
        `SELECT b.*,
           COALESCE(p.name, cust.name, 'General Customer') AS customer_name,
           COALESCE(p.phone, cust.phone, '') AS customer_phone,
           sp.shop_name,
           sp.gstin AS shop_gstin,
           sp.phone AS shop_phone
         FROM bills b
         LEFT JOIN people p ON b.customer_id = p.id
         LEFT JOIN customers cust ON b.customer_id = cust.id
         LEFT JOIN shop_profiles sp ON b.user_id::text = sp.user_id::text
         ${cursorWhere} ORDER BY ${orderCol}
         LIMIT $${cursorParams.length}`,
        cursorParams
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
        : null

      return res.json({ data: rows, limit, hasNextPage, nextCursor })
    }

    const count = await query(
      `SELECT COUNT(*) FROM bills b 
       LEFT JOIN people p ON b.customer_id = p.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       ${where}`,
      params
    )
    const total = Number.parseInt(count.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1

    const listParams = [...params, limit, offset]
    const { rows } = await query(
      `SELECT b.*,
         COALESCE(p.name, cust.name, 'General Customer') AS customer_name,
         COALESCE(p.phone, cust.phone, '') AS customer_phone,
         sp.shop_name,
         sp.gstin AS shop_gstin,
         sp.phone AS shop_phone
       FROM bills b
       LEFT JOIN people p ON b.customer_id = p.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       LEFT JOIN shop_profiles sp ON b.user_id::text = sp.user_id::text
       ${where} ORDER BY ${orderCol}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    )

    const hasNextPage = page < totalPages
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
    const nextCursor = (hasNextPage && lastRow)
      ? encodeCursor({ created_at: lastRow.created_at, id: lastRow.id })
      : null

    res.json({
      data: rows,
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      nextCursor
    })
  } catch (err) {
    console.error('[Billing GET Error]', err)
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/billing/summary — paid/unpaid totals with optional date/month/year filters */
router.get('/summary', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { where, params } = buildBillingWhere(req.query, userId, false)
    const { rows } = await query(
      `SELECT b.status, COUNT(*) AS count, COALESCE(SUM(b.amount),0) AS total
       FROM bills b ${where} GROUP BY b.status`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/billing/daily-stats — bills grouped by day: count, revenue, paid count, pending count */
router.get('/daily-stats', async (req, res) => {
  const userId = req.workspaceId
  const { month, year, startDate, endDate } = req.query

  const params = [userId]
  const conditions = ["(b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')"]

  if (startDate) {
    params.push(startDate)
    conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`)
  }
  if (endDate) {
    params.push(endDate)
    conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`)
  }
  if (!startDate && year) {
    params.push(Number.parseInt(year, 10))
    conditions.push(`EXTRACT(YEAR FROM (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) = $${params.length}`)
  }
  if (!startDate && month) {
    params.push(Number.parseInt(month, 10))
    conditions.push(`EXTRACT(MONTH FROM (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) = $${params.length}`)
  }

  // Default: last 30 days if no date range given
  if (!startDate && !endDate && !month && !year) {
    conditions.push(`(b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= (CURRENT_DATE - INTERVAL '29 days')`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  try {
    const { rows } = await query(
      `SELECT
         (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS day,
         COUNT(*) AS total_bills,
         COALESCE(SUM(b.amount), 0) AS total_revenue,
         COUNT(*) FILTER (WHERE b.status = 'paid') AS paid_count,
         COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'paid'), 0) AS paid_revenue,
         COUNT(*) FILTER (WHERE b.status = 'unpaid') AS pending_count,
         COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'unpaid'), 0) AS pending_revenue
       FROM bills b
       ${where}
       GROUP BY (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date
       ORDER BY (b.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/billing/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT b.*,
         COALESCE(p.name, cust.name, 'General Customer') AS customer_name,
         COALESCE(p.phone, cust.phone, '') AS customer_phone,
         sp.shop_name,
         sp.gstin AS shop_gstin,
         sp.phone AS shop_phone
       FROM bills b
       LEFT JOIN people p ON b.customer_id = p.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       LEFT JOIN shop_profiles sp ON b.user_id::text = sp.user_id::text
       WHERE b.id=$1 AND (b.user_id::text = $2::text OR b.user_id = 'default-user' OR $2 = 'default-user')`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })
    return res.json(rows[0])
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

function calculateBillAmount(items, amount, discount) {
  const computedAmount = (items || []).reduce((acc, item) => {
    const qty = Number.parseFloat(item.qty || 1)
    const price = Number.parseFloat(item.price || 0)
    const itemDisc = Number.parseFloat(item.discount || 0)
    return acc + Math.max(0, (qty * price) - itemDisc)
  }, 0)
  return amount !== undefined ? Number.parseFloat(amount) : Math.max(0, computedAmount - Number.parseFloat(discount || 0))
}

async function generateUniqueBillNumber(customBillNum) {
  let billNumber = (customBillNum && customBillNum.trim()) ? customBillNum.trim() : `INV-${crypto.randomInt(10000, 100000)}`
  try {
    for (let attempts = 0; attempts < 5; attempts++) {
      const check = await query("SELECT id FROM bills WHERE bill_number = $1 LIMIT 1", [billNumber]).catch(() => ({ rows: [] }))
      if (!check.rows.length) break
      billNumber = `INV-${crypto.randomInt(10000, 100000)}`
    }
  } catch { }
  return billNumber
}

async function insertBillRecord({ parsedCustomerId, billNumber, finalItemsJson, finalAmount, discount, due_date, notes, status, userId }) {
  try {
    const resDb = await query(
      `INSERT INTO bills (customer_id, bill_number, items, amount, discount, due_date, notes, status, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        parsedCustomerId,
        billNumber,
        finalItemsJson,
        finalAmount,
        Number.parseFloat(discount || 0),
        due_date || null,
        notes || '',
        status || 'unpaid',
        userId
      ]
    )
    return resDb.rows
  } catch {
    const resDb = await query(
      `INSERT INTO bills (customer_id, items, amount, discount, due_date, notes, status, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        parsedCustomerId,
        finalItemsJson,
        finalAmount,
        Number.parseFloat(discount || 0),
        due_date || null,
        notes || '',
        status || 'unpaid',
        userId
      ]
    )
    return resDb.rows
  }
}

function buildStockDeductionNote(isBaseUnit, bw, qty, rawUnit, prodUnit) {
  if (isBaseUnit || bw <= 1) {
    return `Deducted ${qty} ${rawUnit} for bill creation`
  }
  const uomLower = (prodUnit || '').toLowerCase()
  let containerLabel = 'Bag'
  if (uomLower.includes('liter')) containerLabel = 'Drum'
  else if (uomLower.includes('meter')) containerLabel = 'Roll'
  else if (uomLower.includes('box') || uomLower.includes('pc')) containerLabel = 'Box'

  let baseShort = 'kg'
  if (uomLower.includes('liter')) baseShort = 'ltr'
  else if (uomLower.includes('meter')) baseShort = 'mtr'
  else if (uomLower.includes('box') || uomLower.includes('pc')) baseShort = 'pc'

  const totalBase = (qty * bw).toFixed(0)
  return `Deducted ${qty} ${containerLabel} (${bw}${baseShort}) (${totalBase} ${baseShort}) for bill creation`
}

async function deductStockForItem(item, userId, billId) {
  if (!item) return
  const qty = Number.parseFloat(item.qty || item.quantity || 0)
  if (qty <= 0) return

  const prodId = item.product_id || item.id || item.productId
  const itemName = item.name || item.product_name || item.productName || ''
  const itemCode = item.hsn_code || item.hsn || item.sku || ''

  const prodRes = await query(
    `SELECT id, name, sku, hsn_code, stock, loose_kg, bag_weight, unit FROM products 
     WHERE (
       ( $1::text <> '' AND id::text = $1::text )
       OR ( $2::text <> '' AND name ILIKE $2 )
       OR ( $3::text <> '' AND (hsn_code = $3 OR sku = $3) )
     )
     AND (user_id::text = $4::text OR user_id = 'default-user' OR $4 = 'default-user') 
     LIMIT 1`,
    [prodId ? String(prodId) : '', itemName.trim(), itemCode.trim(), userId || 'default-user']
  ).catch(e => { console.error('[Product Lookup Error]', e.message); return null })

  const prod = prodRes?.rows?.[0]
  if (!prod) return

  const bw = Number.parseFloat(prod.bag_weight || 1)
  const itemUnitStr = String(item.unit || item.unitLabel || '').trim().toLowerCase()
  const prodUnitStr = String(prod.unit || 'pcs').trim().toLowerCase()
  const containerKeywords = ['bag', 'bags', 'drum', 'drums', 'can', 'cans', 'roll', 'rolls', 'box', 'boxes', 'carton', 'cartons', 'dozen', 'doz', 'pack', 'packs', 'bundle', 'bundles']

  let isBaseUnit = true
  if (itemUnitStr) {
    isBaseUnit = !containerKeywords.some(c => itemUnitStr.includes(c))
  } else if (prodUnitStr) {
    isBaseUnit = !containerKeywords.some(c => prodUnitStr.includes(c))
  }

  const rawUnit = item.unit || item.unitLabel || (isBaseUnit ? 'kgs' : prod.unit) || 'pcs'
  const currentStock = Number.parseFloat(prod.stock || 0)
  const currentLoose = Number.parseFloat(prod.loose_kg || 0)

  const totalBaseBefore = (bw > 1) ? ((currentStock * bw) + currentLoose) : currentStock
  const qtyDeductedBase = (isBaseUnit || bw <= 1) ? qty : (qty * bw)
  const totalBaseAfter = Math.max(0, totalBaseBefore - qtyDeductedBase)

  const newStock = (bw > 1) ? Math.floor(totalBaseAfter / bw) : totalBaseAfter
  const newLooseKg = (bw > 1) ? +(totalBaseAfter % bw).toFixed(2) : 0

  await query(
    `UPDATE products SET stock = $1, loose_kg = $2, updated_at = NOW() WHERE id = $3`,
    [newStock, newLooseKg, prod.id]
  ).catch(e => console.error('[Products Stock Update Error]', e.message))

  const noteDetail = buildStockDeductionNote(isBaseUnit, bw, qty, rawUnit, prod.unit)

  await logStockHistory(
    prod.id,
    userId || 'default-user',
    'deducted',
    -qty,
    currentStock,
    newStock,
    'Bill',
    billId || null,
    noteDetail,
    newLooseKg
  ).catch(e => console.warn('[Stock History Log Error]', e.message))
}

async function deductStockForBillItems(items, userId, billId) {
  for (const item of (items || [])) {
    await deductStockForItem(item, userId, billId)
  }
  if (userId) {
    const keys1 = await redis.keys(`import_stock:${userId}*`).catch(() => [])
    const keys2 = await redis.keys(`import_stock_note:${userId}*`).catch(() => [])
    for (const k of [...keys1, ...keys2]) { await redis.del(k).catch(() => { }) }
  }
}

/* POST /api/billing */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { customer_id, bill_number: customBillNum, items, amount, due_date, notes, discount, status } = req.body

  const finalAmount = calculateBillAmount(items, amount, discount)
  const parsedCustomerId = Number.isInteger(Number(customer_id)) && Number(customer_id) > 0 ? Number.parseInt(customer_id, 10) : null
  const billNumber = await generateUniqueBillNumber(customBillNum)

  const catalogMap = await getProductHsnMap()
  const enrichedItems = enrichItemsWithCache(items || [], catalogMap)
  const finalItemsJson = JSON.stringify(enrichedItems)

  try {
    const insertedRows = await insertBillRecord({
      parsedCustomerId,
      billNumber,
      finalItemsJson,
      finalAmount,
      discount,
      due_date,
      notes,
      status,
      userId
    })

    const billRecord = insertedRows[0]
    await deductStockForBillItems(enrichedItems, userId, billRecord?.id)

    try {
      const keys = await redis.keys(`*${userId}*`).catch(() => [])
      for (const key of keys) { await redis.del(key).catch(() => { }) }
    } catch { }

    return res.status(201).json(billRecord)
  } catch (err) {
    console.error('[Create Bill Error]', err)
    return res.status(500).json({ error: 'Failed to create bill: ' + err.message })
  }
})

/* PATCH /api/billing/:id/pay — Mark bill as paid */
router.patch('/:id/pay', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `UPDATE bills SET status = 'paid', updated_at = NOW()
       WHERE id = $1 AND (user_id::text = $2::text OR user_id = 'default-user' OR $2 = 'default-user')
       RETURNING *`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })

    try {
      const keys = await redis.keys(`billing:${userId}:*`).catch(() => [])
      for (const key of keys) { await redis.del(key).catch(() => { }) }
    } catch (_err) { }

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/billing/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `DELETE FROM bills WHERE id = $1 AND (user_id::text = $2::text OR user_id = 'default-user' OR $2 = 'default-user') RETURNING id, bill_number`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })

    const deletedBill = rows[0]
    const invoiceNum = deletedBill.bill_number || `INV-${String(deletedBill.id).padStart(5, '0')}`

    try {
      const keys = await redis.keys(`*${userId}*`).catch(() => [])
      for (const key of keys) { await redis.del(key).catch(() => { }) }
    } catch (_err) { }

    res.json({ message: `Bill ${invoiceNum} deleted successfully`, bill_number: invoiceNum, id: deletedBill.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router