import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimit.js'
import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

const router = Router()
router.use(apiLimiter)
router.use(requireAuth)

// Strict static table literal mapper for CodeQL static analysis compliance
function getTableLiteral(moduleName) {
  switch (String(moduleName || '').toLowerCase().trim()) {
    case 'products':     return 'products'
    case 'customers':    return 'customers'
    case 'bills':        return 'bills'
    case 'quotes':       return 'quotes'
    case 'orders':       return 'orders'
    case 'import_stock': return 'import_stock'
    case 'people':       return 'people'
    case 'notes':        return 'notes'
    default:             return null
  }
}

// Strict whitelist of permitted column names per table
const ALLOWED_COLUMNS = Object.freeze({
  products:     Object.freeze(['name', 'sku', 'category', 'price', 'stock', 'unit', 'status', 'description', 'bag_weight', 'updated_price', 'updated_price_date', 'price_covers']),
  customers:    Object.freeze(['name', 'email', 'phone', 'address', 'gst_number']),
  bills:        Object.freeze(['customer_id', 'items', 'amount', 'discount', 'status', 'due_date', 'notes', 'paid_at']),
  quotes:       Object.freeze(['quote_number', 'customer_id', 'customer_name', 'customer_email', 'status', 'line_items', 'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'valid_until', 'notes']),
  orders:       Object.freeze(['order_number', 'customer_id', 'status', 'items', 'total_amount']),
  import_stock: Object.freeze(['name', 'sku', 'category', 'price', 'stock', 'unit', 'status', 'description', 'bag_weight', 'price_covers']),
  people:       Object.freeze(['name', 'email', 'phone', 'persona', 'status', 'notes', 'company', 'company_name']),
  notes:        Object.freeze(['title', 'content', 'category'])
})

// Middleware to validate and bind static table name
const validateTable = (req, res, next) => {
  const table = getTableLiteral(req.params.module)
  if (!table) {
    return res.status(400).json({ error: 'Invalid or unauthorized module' })
  }
  req.targetTable = table
  next()
}

router.use('/:module', validateTable)

/* GET /api/records/:module */
router.get('/:module', async (req, res) => {
  const userId = req.workspaceId
  const table = req.targetTable
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 50)

  try {
    if (cursor && cursor.id) {
      const { rows } = await query(
        `SELECT * FROM ${table} WHERE user_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3`,
        [userId, cursor.id, limit + 1]
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ id: rows[rows.length - 1].id })
        : null

      return res.json({ data: rows, limit, hasNextPage, nextCursor })
    }

    const { rows } = await query(
      `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )
    const countRes = await query(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [userId])
    const total = parseInt(countRes.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1
    const hasNextPage = page < totalPages
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
    const nextCursor = (hasNextPage && lastRow)
      ? encodeCursor({ id: lastRow.id })
      : null

    res.json({ data: rows, total, page, limit, totalPages, hasNextPage, nextCursor })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/records/:module/:id */
router.get('/:module/:id', async (req, res) => {
  const userId = req.workspaceId
  const table = req.targetTable
  const recordId = req.params.id

  try {
    const { rows } = await query(
      `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Record not found' })
    }
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/records/:module */
router.post('/:module', async (req, res) => {
  const userId = req.workspaceId
  const table = req.targetTable
  const allowed = ALLOWED_COLUMNS[table] || []

  // Filter keys strictly against allowed static column list
  const validKeys = Object.keys(req.body || {}).filter(k => allowed.includes(k))
  if (validKeys.length === 0) {
    return res.status(400).json({ error: 'No permitted fields provided for creation' })
  }

  // Include user_id
  const columns = [...validKeys, 'user_id']
  const values = validKeys.map(k => req.body[k])
  values.push(userId)

  const columnsStr = columns.map(c => `"${c}"`).join(', ')
  const placeholdersStr = columns.map((_, idx) => `$${idx + 1}`).join(', ')

  try {
    const { rows } = await query(
      `INSERT INTO ${table} (${columnsStr}) VALUES (${placeholdersStr}) RETURNING *`,
      values
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/records/:module/:id */
router.put('/:module/:id', async (req, res) => {
  const userId = req.workspaceId
  const table = req.targetTable
  const recordId = req.params.id
  const allowed = ALLOWED_COLUMNS[table] || []

  const validKeys = Object.keys(req.body || {}).filter(k => allowed.includes(k))
  if (validKeys.length === 0) {
    return res.status(400).json({ error: 'No permitted fields provided for update' })
  }

  const setStr = validKeys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ')
  const values = validKeys.map(k => req.body[k])

  // Append ID and UserID as query parameters
  values.push(recordId, userId)
  const idPlaceholderIdx = values.length - 1
  const userPlaceholderIdx = values.length

  try {
    const { rows } = await query(
      `UPDATE ${table} SET ${setStr} WHERE id = $${idPlaceholderIdx} AND user_id = $${userPlaceholderIdx} RETURNING *`,
      values
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Record not found or unauthorized' })
    }
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/records/:module/:id */
router.delete('/:module/:id', async (req, res) => {
  const userId = req.workspaceId
  const table = req.targetTable
  const recordId = req.params.id

  try {
    const { rowCount } = await query(
      `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    )
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Record not found or unauthorized' })
    }
    res.json({ success: true, message: 'Record deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
