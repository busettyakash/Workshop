import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { getProductHsnMap, enrichItemsWithCache } from '../lib/productCache.js'


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

/* GET /api/billing?status=paid|unpaid */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { status, search, sort } = req.query

  const params = [userId]
  const conditions = ['(b.user_id::text = $1::text OR b.user_id = \'default-user\' OR $1 = \'default-user\')']
  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`) }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(p.name ILIKE $${params.length} OR cust.name ILIKE $${params.length} OR CAST(b.id AS TEXT) ILIKE $${params.length})`)
  }

  let orderCol = 'b.created_at DESC, b.id DESC'
  if (sort === 'id_asc') orderCol = 'b.id ASC'
  else if (sort === 'id_desc') orderCol = 'b.id DESC'
  else if (sort === 'amount_asc') orderCol = 'b.amount ASC, b.id DESC'
  else if (sort === 'amount_desc') orderCol = 'b.amount DESC, b.id DESC'

  try {
    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(b.created_at, b.id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
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
         LIMIT $${params.length}`,
        params
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
        : null

      return res.json({ data: rows, limit, hasNextPage, nextCursor })
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const count = await query(
      `SELECT COUNT(*) FROM bills b 
       LEFT JOIN people p ON b.customer_id = p.id
       LEFT JOIN customers cust ON b.customer_id = cust.id
       ${where}`,
      params
    )
    const total = parseInt(count.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1

    params.push(limit, offset)
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
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
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

/* GET /api/billing/summary — paid/unpaid totals */
router.get('/summary', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
       FROM bills WHERE (user_id::text = $1::text OR user_id = 'default-user' OR $1 = 'default-user') GROUP BY status`,
      [userId]
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
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/billing */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { customer_id, items, amount, due_date, notes, discount, status } = req.body

  const computedAmount = (items || []).reduce((acc, item) => {
    const qty = parseFloat(item.qty || 1)
    const price = parseFloat(item.price || 0)
    const itemDisc = parseFloat(item.discount || 0)
    return acc + Math.max(0, (qty * price) - itemDisc)
  }, 0)
  const finalAmount = amount !== undefined ? parseFloat(amount) : Math.max(0, computedAmount - parseFloat(discount || 0))

  const parsedCustomerId = Number.isInteger(Number(customer_id)) && Number(customer_id) > 0 ? parseInt(customer_id, 10) : null

  // Generate unique random 5-digit invoice number (e.g. INV-84920)
  let billNumber = `INV-${Math.floor(10000 + Math.random() * 90000)}`
  try {
    let isUnique = false
    let attempts = 0
    while (!isUnique && attempts < 5) {
      const check = await query("SELECT id FROM bills WHERE bill_number = $1 LIMIT 1", [billNumber]).catch(() => ({ rows: [] }))
      if (!check.rows.length) {
        isUnique = true
      } else {
        billNumber = `INV-${Math.floor(10000 + Math.random() * 90000)}`
        attempts++
      }
    }
  } catch (_e) { }

  // Enrich items with actual product names and HSN codes from fast Redis/In-Memory Cache (Zero DB load)
  const catalogMap = await getProductHsnMap()
  const enrichedItems = enrichItemsWithCache(items || [], catalogMap)

  const finalItemsJson = JSON.stringify(enrichedItems)

  try {
    let insertedRows
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
          parseFloat(discount || 0),
          due_date || null,
          notes || '',
          status || 'unpaid',
          userId
        ]
      )
      insertedRows = resDb.rows
    } catch (_insertErr) {
      // Fallback insert if bill_number column missing
      const resDb = await query(
        `INSERT INTO bills (customer_id, items, amount, discount, due_date, notes, status, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          parsedCustomerId,
          finalItemsJson,
          finalAmount,
          parseFloat(discount || 0),
          due_date || null,
          notes || '',
          status || 'unpaid',
          userId
        ]
      )
      insertedRows = resDb.rows
    }

    // Deduct stock for items in the bill based on purchased quantity and UOM
    for (const item of (enrichedItems || [])) {
      if (!item) continue
      const qty = parseFloat(item.qty || item.quantity || 0)
      const prodId = item.product_id || item.id || item.productId
      const itemName = item.name || item.product_name || item.productName || ''
      if (qty <= 0) continue

      let prodRes = null
      if (prodId) {
        prodRes = await query(
          `SELECT id, name, sku, stock, bag_weight, unit FROM products 
           WHERE (id::text = $1::text OR ($2 <> '' AND name ILIKE $2))
             AND (user_id::text = $3::text OR user_id = 'default-user' OR $3 = 'default-user') 
           LIMIT 1`,
          [String(prodId), itemName.trim(), userId || 'default-user']
        ).catch(e => { console.error('[Stock Lookup Error]', e.message); return null })
      } else if (itemName) {
        prodRes = await query(
          `SELECT id, name, sku, stock, bag_weight, unit FROM products 
           WHERE name ILIKE $1 
             AND (user_id::text = $2::text OR user_id = 'default-user' OR $2 = 'default-user') 
           LIMIT 1`,
          [itemName.trim(), userId || 'default-user']
        ).catch(e => { console.error('[Stock Lookup Error by Name]', e.message); return null })
      }

      const prod = prodRes?.rows?.[0]
      if (!prod) {
        console.warn('[Stock Deduction Warning] Product not found for stock deduction:', prodId, itemName)
        continue
      }

      const bw = parseFloat(prod.bag_weight || 1)
      const unitStr = String(item.unit || prod.unit || '').toLowerCase()
      const isBaseUnit = ['kgs', 'kg', 'ltr', 'mtr', 'g', 'gm'].some(u => unitStr.includes(u))

      let bagsToDeduct = qty
      if (isBaseUnit && bw > 1) {
        bagsToDeduct = qty / bw
      }

      if (bagsToDeduct > 0) {
        await query(
          `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2`,
          [bagsToDeduct, prod.id]
        ).catch(e => console.error('[Billing Products Stock Decrease Error]', e.message))

        await query(
          `UPDATE import_stock SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE (user_id::text = $2::text OR user_id = 'default-user' OR $2 = 'default-user') AND (name ILIKE $3 OR (sku <> '' AND sku = $4))`,
          [bagsToDeduct, userId || 'default-user', prod.name || itemName, prod.sku || '']
        ).catch(e => console.error('[Billing ImportStock Stock Decrease Error]', e.message))
      }
    }

    // Clear redis cache
    try {
      const keys = await redis.keys(`*${userId}*`).catch(() => [])
      for (const key of keys) { await redis.del(key).catch(() => { }) }
    } catch (_err) { }

    res.status(201).json(insertedRows[0])
  } catch (err) {
    console.error('[Create Bill Error]', err)
    res.status(500).json({ error: 'Failed to create bill: ' + err.message })
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
      `DELETE FROM bills WHERE id = $1 AND (user_id::text = $2::text OR user_id = 'default-user' OR $2 = 'default-user') RETURNING id`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })

    try {
      const keys = await redis.keys(`billing:${userId}:*`).catch(() => [])
      for (const key of keys) { await redis.del(key).catch(() => { }) }
    } catch (_err) { }

    res.json({ message: 'Bill deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router