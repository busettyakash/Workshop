import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

/* GET /api/billing?status=paid|unpaid */
router.get('/', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  const params = []
  let where = ''
  if (status) { params.push(status); where = `WHERE status = $1` }
  params.push(limit, offset)

  try {
    const { rows } = await query(
      `SELECT b.*, c.name AS customer_name
       FROM bills b
       LEFT JOIN people c ON b.customer_id = c.id
       ${where} ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const count = await query(`SELECT COUNT(*) FROM bills ${where}`, params.slice(0, -2))
    res.json({ data: rows, total: parseInt(count.rows[0].count), page: +page, limit: +limit })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/billing/summary — paid/unpaid totals */
router.get('/summary', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
       FROM bills GROUP BY status`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/billing/:id */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT b.*, c.name AS customer_name FROM bills b
       LEFT JOIN people c ON b.customer_id = c.id WHERE b.id=$1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/billing */
router.post('/', async (req, res) => {
  const { customer_id, items, amount, due_date, notes, discount, status } = req.body
  if (!customer_id || !amount) return res.status(400).json({ error: 'customer_id and amount required' })
  const billStatus = status === 'paid' ? 'paid' : 'unpaid'
  const paidAt = billStatus === 'paid' ? 'NOW()' : 'NULL'
  try {
    const { rows } = await query(
      `INSERT INTO bills (customer_id, items, amount, discount, status, due_date, notes, paid_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,${paidAt},NOW()) RETURNING *`,
      [customer_id, JSON.stringify(items || []), amount, discount || 0, billStatus, due_date || null, notes]
    )

    // Update stock for both products and import_stock tables and insert to bill_items
    const itemsList = items || []
    for (const item of itemsList) {
      if (item.product_id) {
        const qty = parseFloat(item.qty || 1)
        
        // 1. Decrement products table stock
        await query(
          "UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2",
          [qty, item.product_id]
        )

        // 2. Insert into bill_items table
        await query(
          "INSERT INTO bill_items (bill_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
          [rows[0].id, item.product_id, Math.round(qty), item.price || 0]
        )
        
        // 3. Query product to find its SKU and decrement matching stock in import_stock table
        const prodRes = await query("SELECT sku, name FROM products WHERE id = $1", [item.product_id])
        if (prodRes.rows.length > 0) {
          const { sku, name } = prodRes.rows[0]
          if (sku) {
            await query(
              "UPDATE import_stock SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE sku = $2",
              [qty, sku]
            )
          } else if (name) {
            await query(
              "UPDATE import_stock SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE name = $2",
              [qty, name]
            )
          }
        }
      }
    }

    // Invalidate import_stock Redis cache
    await redis.del('import_stock:all').catch(() => {})

    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/billing/:id/pay */
router.patch('/:id/pay', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE bills SET status='paid', paid_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/billing/:id */
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM bills WHERE id=$1', [req.params.id])
    res.json({ message: 'Bill deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
