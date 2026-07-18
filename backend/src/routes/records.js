import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const ALLOWED_TABLES = [
  'account_groups', 'activities', 'categories', 'brands', 'variants', 'bundles', 
  'price_books', 'pricing_rules', 'taxes', 'opportunities', 'quotes', 'sales_orders', 
  'deliveries', 'sales_returns', 'approval_queue', 'payments', 'credit_notes', 
  'debit_notes', 'refunds', 'expenses', 'customer_ledger', 'credit_sales', 
  'outstanding_dues', 'collections', 'payment_reminders', 'warehouses', 
  'purchase_orders', 'goods_received', 'stock_transfers', 'stock_adjustments', 
  'cycle_counts', 'low_stock_alerts', 'supplier_quotations', 'purchase_requests', 
  'purchase_approvals', 'vendor_comparisons', 'purchase_returns', 'scheduled_reports', 
  'business_rules', 'branches', 'tax_configurations', 'numbering_series', 
  'integrations', 'audit_logs', 'system_settings'
]

// Middleware to validate table name to prevent SQL injection
const validateTable = (req, res, next) => {
  const { module } = req.params
  if (!ALLOWED_TABLES.includes(module)) {
    return res.status(400).json({ error: `Invalid or unauthorized module: ${module}` })
  }
  next()
}

router.use('/:module', validateTable)

/* GET /api/records/:module */
router.get('/:module', async (req, res) => {
  const userId = req.workspaceId
  const { module } = req.params
  const { page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit

  try {
    const { rows } = await query(
      `SELECT * FROM ${module} WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    )
    const countRes = await query(`SELECT COUNT(*) FROM ${module} WHERE user_id = $1`, [userId])
    const total = parseInt(countRes.rows[0].count)

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/records/:module/:id */
router.get('/:module/:id', async (req, res) => {
  const userId = req.workspaceId
  const { module, id } = req.params

  try {
    const { rows } = await query(
      `SELECT * FROM ${module} WHERE id = $1 AND user_id = $2`,
      [id, userId]
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
  const { module } = req.params
  
  // Exclude fields like id, created_at, updated_at
  const bodyFields = { ...req.body }
  delete bodyFields.id
  delete bodyFields.created_at
  delete bodyFields.updated_at
  
  bodyFields.user_id = userId

  const keys = Object.keys(bodyFields)
  if (keys.length === 0) {
    return res.status(400).json({ error: 'No fields provided for creation' })
  }

  const columnsStr = keys.map(k => `"${k}"`).join(', ')
  const placeholdersStr = keys.map((_, idx) => `$${idx + 1}`).join(', ')
  const values = keys.map(k => bodyFields[k])

  try {
    const { rows } = await query(
      `INSERT INTO ${module} (${columnsStr}) VALUES (${placeholdersStr}) RETURNING *`,
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
  const { module, id } = req.params

  const bodyFields = { ...req.body }
  delete bodyFields.id
  delete bodyFields.created_at
  delete bodyFields.updated_at
  delete bodyFields.user_id

  const keys = Object.keys(bodyFields)
  if (keys.length === 0) {
    return res.status(400).json({ error: 'No fields provided for update' })
  }

  const setStr = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ')
  const values = keys.map(k => bodyFields[k])
  
  // Add ID and UserID placeholders
  values.push(id, userId)
  const idPlaceholderIdx = values.length - 1
  const userPlaceholderIdx = values.length

  try {
    const { rows } = await query(
      `UPDATE ${module} SET ${setStr} WHERE id = $${idPlaceholderIdx} AND user_id = $${userPlaceholderIdx} RETURNING *`,
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
  const { module, id } = req.params

  try {
    const { rowCount } = await query(
      `DELETE FROM ${module} WHERE id = $1 AND user_id = $2`,
      [id, userId]
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
