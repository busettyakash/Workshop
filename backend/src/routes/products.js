import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)



import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

// Add schema update
query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS next_restock_time TEXT DEFAULT 'TBD'`).catch(() => {})

/* GET /api/products */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search, category, status, sort } = req.query

  const params = [userId]
  const conditions = ['user_id = $1']

  if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`) }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
  
  const finalStatus = status === 'all' ? null : (status || 'active')
  if (finalStatus) {
    params.push(finalStatus)
    conditions.push(`status = $${params.length}`)
  }

  let orderCol = 'created_at DESC, id DESC'
  if (sort === 'name_asc') orderCol = 'name ASC, id DESC'
  else if (sort === 'name_desc') orderCol = 'name DESC, id DESC'

  try {
    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
      const { rows } = await query(
        `SELECT * FROM products ${where} ORDER BY ${orderCol} LIMIT $${params.length}`,
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
    const countRow = await query(`SELECT COUNT(*) FROM products ${where}`, params)
    const total = parseInt(countRow.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1

    params.push(limit, offset)
    const { rows } = await query(
      `SELECT * FROM products ${where} ORDER BY ${orderCol} LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/products/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/products */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, stock, status, description, next_restock_time, bag_weight } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' })
  try {
    const { rows } = await query(
      `INSERT INTO products (name, sku, category, price, stock, status, description, next_restock_time, user_id, bag_weight, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [name, sku, category, price, stock || 0, status || 'active', description, next_restock_time || 'TBD', userId, parseFloat(bag_weight) || 1]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/products/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, stock, status, description, next_restock_time, bag_weight } = req.body
  try {
    const { rows } = await query(
      `UPDATE products SET name=$1,sku=$2,category=$3,price=$4,stock=$5,status=$6,description=$7,next_restock_time=$8,bag_weight=$9,updated_at=NOW()
       WHERE id=$10 AND user_id = $11 RETURNING *`,
      [name, sku, category, price, stock, status, description, next_restock_time, parseFloat(bag_weight) || 1, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/products/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query('DELETE FROM products WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    res.json({ message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
