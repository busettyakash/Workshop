import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)



import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

// Add schema update
query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS next_restock_time TEXT DEFAULT 'TBD'`).catch(() => {})
query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2)`).catch(() => {})
query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE`).catch(() => {})
query(`CREATE TABLE IF NOT EXISTS product_price_history (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL,
  user_id TEXT NOT NULL,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  effective_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)`).catch(() => {})

async function logPriceHistory(productId, userId, oldPrice, newPrice, effectiveDate, notes = 'Price update') {
  if (!newPrice || isNaN(parseFloat(newPrice))) return
  try {
    await query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [productId, userId, oldPrice ? parseFloat(oldPrice) : null, parseFloat(newPrice), effectiveDate || new Date().toISOString().split('T')[0], notes]
    )
  } catch (e) {
    console.warn('[Products] Price history log error:', e.message)
  }
}

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

/* GET /api/products/:id/price-history */
router.get('/:id/price-history', async (req, res) => {
  const userId = req.workspaceId
  const productId = req.params.id
  try {
    const { rows: productRows } = await query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [productId, userId])
    if (!productRows.length) return res.status(404).json({ error: 'Product not found' })
    const prod = productRows[0]

    const { rows } = await query(
      'SELECT * FROM product_price_history WHERE product_id = $1 AND user_id = $2 ORDER BY effective_date DESC, created_at DESC',
      [productId, userId]
    )

    if (!rows.length) {
      // Dynamic fallback items from product record
      const fallbackList = []
      if (prod.updated_price) {
        fallbackList.push({
          id: 'ph-2',
          product_id: prod.id,
          old_price: prod.price,
          new_price: prod.updated_price,
          effective_date: prod.updated_price_date ? String(prod.updated_price_date).split('T')[0] : new Date().toISOString().split('T')[0],
          notes: 'Updated Price'
        })
      }
      if (prod.price) {
        fallbackList.push({
          id: 'ph-1',
          product_id: prod.id,
          old_price: null,
          new_price: prod.price,
          effective_date: prod.created_at ? String(prod.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
          notes: 'Initial Base Price'
        })
      }
      return res.json(fallbackList)
    }

    res.json(rows)
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
  const { name, sku, category, price, updated_price, updated_price_date, stock, status, description, next_restock_time, bag_weight } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' })
  try {
    const { rows } = await query(
      `INSERT INTO products (name, sku, category, price, updated_price, updated_price_date, stock, status, description, next_restock_time, user_id, bag_weight, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`,
      [
        name, sku, category, price,
        updated_price ? parseFloat(updated_price) : null,
        updated_price_date || new Date().toISOString().split('T')[0],
        stock || 0, status || 'active', description, next_restock_time || 'TBD', userId, parseFloat(bag_weight) || 1
      ]
    )
    const newProduct = rows[0]
    await logPriceHistory(newProduct.id, userId, null, newProduct.price, new Date().toISOString().split('T')[0], 'Initial Base Price')
    if (newProduct.updated_price) {
      await logPriceHistory(newProduct.id, userId, newProduct.price, newProduct.updated_price, newProduct.updated_price_date, 'Updated Price')
    }

    res.status(201).json(newProduct)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/products/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, updated_price, updated_price_date, stock, status, description, next_restock_time, bag_weight } = req.body
  try {
    const { rows: existingRows } = await query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    const oldProduct = existingRows[0]

    const { rows } = await query(
      `UPDATE products SET name=$1,sku=$2,category=$3,price=$4,updated_price=$5,updated_price_date=$6,stock=$7,status=$8,description=$9,next_restock_time=$10,bag_weight=$11,updated_at=NOW()
       WHERE id=$12 AND user_id = $13 RETURNING *`,
      [
        name, sku, category, price,
        updated_price ? parseFloat(updated_price) : null,
        updated_price_date || new Date().toISOString().split('T')[0],
        stock, status, description, next_restock_time, parseFloat(bag_weight) || 1, req.params.id, userId
      ]
    )
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    const updatedProduct = rows[0]

    if (updated_price && String(updated_price) !== String(oldProduct?.updated_price)) {
      await logPriceHistory(updatedProduct.id, userId, oldProduct?.updated_price || oldProduct?.price, updated_price, updated_price_date, 'Updated Price')
    } else if (price && String(price) !== String(oldProduct?.price)) {
      await logPriceHistory(updatedProduct.id, userId, oldProduct?.price, price, null, 'Price Modified')
    }

    res.json(updatedProduct)
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
