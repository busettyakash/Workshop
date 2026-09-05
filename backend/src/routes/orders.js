import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimit.js'
import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

const router = Router()
router.use(apiLimiter)
router.use(requireAuth)

let ensureOrdersSchemaPromise

async function ensureOrdersSchema() {
  await query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS order_number VARCHAR(50)`).catch(() => { })
}

router.use(async (_req, _res, next) => {
  try {
    ensureOrdersSchemaPromise ||= ensureOrdersSchema().catch((err) => {
      ensureOrdersSchemaPromise = null
      throw err
    })
    await ensureOrdersSchemaPromise
    next()
  } catch (err) {
    next(err)
  }
})

function ordersUnion(whereClause = '') {
  return `
    SELECT *
    FROM (
      SELECT
        q.id,
        'quote' AS source,
        COALESCE(NULLIF(q.order_number, ''), 'ORD-' || REPLACE(q.quote_number, 'QT-', ''), 'ORD-' || q.id::text) AS order_number,
        NULL::text AS bill_number,
        q.quote_number,
        NULL::integer AS customer_id,
        q.customer_company,
        q.customer_name,
        q.customer_phone,
        q.customer_email,
        q.total_amount,
        q.tax_amount,
        q.status,
        NULL::date AS due_date,
        q.issue_date,
        q.valid_until,
        q.line_items::text AS line_items,
        q.notes,
        q.user_id,
        q.created_at,
        q.updated_at
      FROM quotes q
      WHERE (q.user_id::text = $1::text OR q.user_id = 'default-user' OR $1 = 'default-user')
        AND q.status ILIKE 'Accepted'
    ) orders
    ${whereClause}
  `
}

async function fetchOrdersWithCursor(res, { conditions, params, limit, cursor }) {
  params.push(cursor.created_at, cursor.id)
  conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`)
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit + 1)

  const { rows } = await query(
    `${ordersUnion(where)} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params
  )
  const hasNextPage = rows.length > limit
  if (hasNextPage) rows.pop()
  const nextCursor = (hasNextPage && rows.length > 0)
    ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
    : null

  return res.json({ data: rows, limit, hasNextPage, nextCursor })
}

async function fetchOrdersWithOffset(res, { conditions, params, page, limit, offset }) {
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRes = await query(`SELECT COUNT(*) FROM (${ordersUnion(where)}) counted_orders`, params)
  const total = Number.parseInt(countRes.rows[0].count, 10) || 0
  const totalPages = Math.ceil(total / limit) || 1

  params.push(limit, offset)
  const { rows } = await query(
    `${ordersUnion(where)} ORDER BY created_at DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const hasNextPage = page < totalPages
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
  const nextCursor = (hasNextPage && lastRow)
    ? encodeCursor({ created_at: lastRow.created_at, id: lastRow.id })
    : null

  return res.json({ data: rows, total, page, limit, totalPages, hasNextPage, nextCursor })
}

/* GET /api/orders */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search } = req.query

  const params = [userId]
  const conditions = []

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`)
    conditions.push(`(
      COALESCE(order_number, '') ILIKE $${params.length}
      OR COALESCE(quote_number, '') ILIKE $${params.length}
      OR COALESCE(customer_name, '') ILIKE $${params.length}
      OR COALESCE(customer_email, '') ILIKE $${params.length}
    )`)
  }

  try {
    if (cursor?.created_at && cursor?.id) {
      return await fetchOrdersWithCursor(res, { conditions, params, limit, cursor })
    }
    return await fetchOrdersWithOffset(res, { conditions, params, page, limit, offset })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/* GET /api/orders/summary */
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
       FROM (${ordersUnion()}) order_summary
       GROUP BY status`,
      [req.workspaceId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[Orders Summary Error]', err)
    res.status(500).json({ error: 'Failed to fetch order summary' })
  }
})

/* GET /api/orders/:id */
router.get('/:id', async (req, res) => {
  const params = [req.workspaceId, req.params.id]
  const conditions = ['id::text = $2::text']

  try {
    const { rows } = await query(ordersUnion(`WHERE ${conditions.join(' AND ')}`), params)
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[Order GET Error]', err)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

export default router
