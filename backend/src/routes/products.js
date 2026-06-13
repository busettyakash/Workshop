import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* GET /api/products */
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search, category, status } = req.query
  const offset = (page - 1) * limit
  const params = []
  const conditions = []

  if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`) }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
  
  // Default to status = 'active' if not specified, but return all if status = 'all'
  const finalStatus = status === 'all' ? null : (status || 'active')
  if (finalStatus) {
    params.push(finalStatus)
    conditions.push(`status = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  try {
    const { rows } = await query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const countRow = await query(`SELECT COUNT(*) FROM products ${where}`, params.slice(0, -2))
    res.json({ data: rows, total: parseInt(countRow.rows[0].count), page: +page, limit: +limit })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/products/:id */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/products */
router.post('/', async (req, res) => {
  const { name, sku, category, price, stock, status, description } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' })
  try {
    const { rows } = await query(
      `INSERT INTO products (name, sku, category, price, stock, status, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [name, sku, category, price, stock || 0, status || 'active', description]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/products/:id */
router.put('/:id', async (req, res) => {
  const { name, sku, category, price, stock, status, description } = req.body
  try {
    const { rows } = await query(
      `UPDATE products SET name=$1,sku=$2,category=$3,price=$4,stock=$5,status=$6,description=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, sku, category, price, stock, status, description, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/products/:id */
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM products WHERE id = $1', [req.params.id])
    res.json({ message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
