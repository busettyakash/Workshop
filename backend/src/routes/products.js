import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { clearProductHsnCache } from '../lib/productCache.js'
import { getOrSetCache, invalidateCachePattern } from '../lib/redisCache.js'

const router = Router()
router.use(requireAuth)

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

let ensureProductsSchemaPromise

async function ensureProductsSchema() {
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS next_restock_time TEXT DEFAULT 'TBD'`).catch(() => {})
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2)`).catch(() => {})
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE`).catch(() => {})
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50)`).catch(() => {})
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_covers DECIMAL(10, 2)`).catch(() => {})
  await query(`CREATE TABLE IF NOT EXISTS product_price_history (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    user_id TEXT NOT NULL,
    old_price NUMERIC(10, 2),
    new_price NUMERIC(10, 2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {})
  await query(`CREATE TABLE IF NOT EXISTS product_stock_history (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    user_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    qty_change NUMERIC(10, 2) NOT NULL,
    stock_before NUMERIC(10, 2),
    stock_after NUMERIC(10, 2),
    source TEXT,
    source_ref TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {})
  await query(`ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY; ALTER TABLE product_price_history FORCE ROW LEVEL SECURITY;`).catch(() => {})
  await query(`ALTER TABLE product_stock_history ENABLE ROW LEVEL SECURITY; ALTER TABLE product_stock_history FORCE ROW LEVEL SECURITY;`).catch(() => {})
}

router.use(async (_req, _res, next) => {
  try {
    ensureProductsSchemaPromise ||= ensureProductsSchema().catch((err) => {
      ensureProductsSchemaPromise = null
      throw err
    })
    await ensureProductsSchemaPromise
    next()
  } catch (err) {
    next(err)
  }
})

function getIndianDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

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

export async function logStockHistory(productId, userId, changeType, qtyChange, stockBefore, stockAfter, source, sourceRef, notes) {
  try {
    await query(
      `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, source_ref, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [productId, userId, changeType, qtyChange, stockBefore ?? null, stockAfter ?? null, source || null, sourceRef || null, notes || null]
    )
  } catch (e) {
    console.warn('[Products] Stock history log error:', e.message)
  }
}

/* GET /api/products */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search, category, status, sort } = req.query

  const params = [userId]
  const conditions = ['(user_id::text = $1::text OR user_id = \'default-user\' OR $1 = \'default-user\')']

  if (search && search.trim()) { 
    params.push(`%${search.trim()}%`)
    conditions.push(`(COALESCE(name, '') ILIKE $${params.length} OR COALESCE(sku, '') ILIKE $${params.length} OR COALESCE(hsn_code, '') ILIKE $${params.length})`) 
  }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
  
  const finalStatus = status === 'all' ? null : (status || 'active')
  if (finalStatus) {
    params.push(finalStatus)
    conditions.push(`status = $${params.length}`)
  }

  let orderCol = 'created_at DESC, id DESC'
  if (sort === 'price_asc') orderCol = 'price ASC, id DESC'
  else if (sort === 'price_desc') orderCol = 'price DESC, id DESC'
  else if (sort === 'stock_asc') orderCol = 'stock ASC, id DESC'
  else if (sort === 'stock_desc') orderCol = 'stock DESC, id DESC'

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
    const count = await query(`SELECT COUNT(*) FROM products ${where}`, params)
    const total = parseInt(count.rows[0].count, 10) || 0
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
    let { rows: prodRows } = await query(
      `SELECT * FROM products WHERE (id::text = $1 OR sku = $1 OR name = $1) AND (user_id::text = $2 OR user_id = 'default-user') ORDER BY updated_at DESC LIMIT 1`,
      [productId, userId]
    )

    if (!prodRows.length) {
      // Check if productId is an import_stock ID
      const { rows: impRows } = await query(
        `SELECT i.*, p.id as real_prod_id FROM import_stock i LEFT JOIN products p ON (p.sku = i.sku OR p.name = i.name) WHERE i.id::text = $1 LIMIT 1`,
        [productId]
      )
      if (impRows.length && impRows[0].real_prod_id) {
        prodRows = (await query(`SELECT * FROM products WHERE id = $1`, [impRows[0].real_prod_id])).rows
      }
    }

    if (!prodRows.length) return res.status(404).json({ error: 'Product not found' })
    const prod = prodRows[0]

    const { rows } = await query(
      `SELECT * FROM product_price_history WHERE product_id = $1 AND (user_id::text = $2 OR user_id = 'default-user') ORDER BY created_at DESC`,
      [prod.id, userId]
    )

    const hasBaseLog = rows.some(r => r.old_price === null)
    if (!hasBaseLog) {
      const createdTime = prod.created_at ? new Date(prod.created_at).toISOString() : new Date().toISOString()
      try {
        const insertedBase = await query(
          `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
           VALUES ($1, $2, NULL, $3, $4, 'Initial Base Price', $5) RETURNING *`,
          [prod.id, userId, parseFloat(prod.price), createdTime.split('T')[0], createdTime]
        )
        if (insertedBase.rows.length) {
          rows.push(insertedBase.rows[0])
        }
      } catch (e) {
        console.warn('[Products] Failed to persist initial base price log:', e.message)
      }
    }

    const updatedPriceNum = prod.updated_price ? parseFloat(prod.updated_price) : null
    if (updatedPriceNum !== null && !isNaN(updatedPriceNum)) {
      const hasUpdated = rows.some(r => parseFloat(r.new_price) === updatedPriceNum)
      if (!hasUpdated) {
        let updatedTime = new Date().toISOString()
        if (prod.updated_at) {
          updatedTime = new Date(prod.updated_at).toISOString()
        } else if (prod.updated_price_date) {
          updatedTime = new Date(prod.updated_price_date).toISOString()
        }
        try {
          const insertedUpd = await query(
            `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, 'Updated Price', $6) RETURNING *`,
            [prod.id, userId, parseFloat(prod.price), updatedPriceNum, updatedTime.split('T')[0], updatedTime]
          )
          if (insertedUpd.rows.length) {
            rows.unshift(insertedUpd.rows[0])
          }
        } catch (e) {
          console.warn('[Products] Failed to persist active updated price log:', e.message)
        }
      }
    }

    const finalHistory = [...rows]
    finalHistory.sort((a, b) => new Date(b.created_at || b.effective_date || 0) - new Date(a.created_at || a.effective_date || 0))

    return res.json(finalHistory)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/products/:id/stock-history */
router.get('/:id/stock-history', async (req, res) => {
  const userId = req.workspaceId
  const productId = req.params.id
  try {
    const { rows } = await query(
      `SELECT * FROM product_stock_history WHERE product_id = $1 AND (user_id = $2 OR user_id = 'default-user' OR $2 = 'default-user') ORDER BY created_at DESC LIMIT 100`,
      [productId, userId]
    )
    return res.json(rows)
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
  const { name, sku, hsn_code, category, price, price_covers, updated_price, updated_price_date, stock, status, description, next_restock_time, bag_weight } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' })
  const finalHsn = hsn_code || sku || '10064000'
  try {
    const { rows } = await query(
      `INSERT INTO products (name, sku, hsn_code, category, price, price_covers, updated_price, updated_price_date, stock, status, description, next_restock_time, user_id, bag_weight, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING *`,
      [
        name, sku || finalHsn, finalHsn, category, price,
        price_covers ? parseFloat(price_covers) : null,
        updated_price ? parseFloat(updated_price) : null,
        updated_price_date || new Date().toISOString().split('T')[0],
        stock || 0, status || 'active', description, next_restock_time || 'TBD', userId, parseFloat(bag_weight) || 1
      ]
    )
    const newProduct = rows[0]
    clearProductHsnCache()
    await logPriceHistory(newProduct.id, userId, null, newProduct.price, new Date().toISOString().split('T')[0], 'Initial Base Price')
    if (newProduct.updated_price) {
      await logPriceHistory(newProduct.id, userId, newProduct.price, newProduct.updated_price, newProduct.updated_price_date, 'Updated Price')
    }

    res.status(201).json(newProduct)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/products/:id/price-history */
router.post('/:id/price-history', async (req, res) => {
  const userId = req.workspaceId
  const productId = req.params.id
  const { old_price, new_price, effective_date, notes } = req.body
  if (!new_price || isNaN(parseFloat(new_price))) {
    return res.status(400).json({ error: 'Valid new_price is required' })
  }
  try {
    const effDate = effective_date || new Date().toISOString()
    const { rows } = await query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        productId,
        userId,
        old_price !== null && old_price !== undefined && !isNaN(parseFloat(old_price)) ? parseFloat(old_price) : null,
        parseFloat(new_price),
        effDate.split('T')[0],
        notes || 'Price adjustment log',
        effDate
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/products/:id/price-history/:logId */
router.delete('/:id/price-history/:logId', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query(
      'DELETE FROM product_price_history WHERE id = $1 AND product_id = $2 AND user_id = $3',
      [req.params.logId, req.params.id, userId]
    )
    res.json({ message: 'Price history log deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/products/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, hsn_code, category, price, price_covers, updated_price, updated_price_date, stock, status, description, next_restock_time, bag_weight } = req.body
  const finalHsn = hsn_code || sku || '10064000'
  try {
    const { rows: existingRows } = await query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    if (!existingRows.length) return res.status(404).json({ error: 'Product not found' })
    const oldProduct = existingRows[0]

    const isUpdatedPriceChanged = updated_price !== undefined && updated_price !== null && String(updated_price) !== String(oldProduct?.updated_price)
    const isPriceChanged = price !== undefined && price !== null && String(price) !== String(oldProduct?.price)

    const todayStr = getIndianDateStr()
    const finalUpdatedPriceDate = (isUpdatedPriceChanged || isPriceChanged)
      ? todayStr
      : (updated_price_date || oldProduct?.updated_price_date || todayStr)

    let finalUpdatedPrice = oldProduct?.updated_price
    if (updated_price !== undefined) {
      finalUpdatedPrice = updated_price ? parseFloat(updated_price) : null
    }

    const { rows } = await query(
      `UPDATE products SET
         name=COALESCE($1,name),
         sku=COALESCE($2,sku),
         hsn_code=COALESCE($3,hsn_code),
         category=COALESCE($4,category),
         price=COALESCE($5,price),
         price_covers=COALESCE($6,price_covers),
         updated_price=COALESCE($7,updated_price),
         updated_price_date=COALESCE($8,updated_price_date),
         stock=COALESCE($9,stock),
         status=COALESCE($10,status),
         description=COALESCE($11,description),
         next_restock_time=COALESCE($12,next_restock_time),
         bag_weight=COALESCE($13,bag_weight),
         updated_at=NOW()
       WHERE id=$14 AND user_id=$15 RETURNING *`,
      [
        name, sku || finalHsn, finalHsn, category, price,
        price_covers !== undefined && price_covers !== null && price_covers !== '' ? parseFloat(price_covers) : oldProduct?.price_covers,
        finalUpdatedPrice,
        finalUpdatedPriceDate,
        stock, status, description, next_restock_time, bag_weight ? parseFloat(bag_weight) : oldProduct?.bag_weight,
        req.params.id, userId
      ]
    )

    const updatedProd = rows[0]
    clearProductHsnCache()

    if (isUpdatedPriceChanged && updatedProd.updated_price) {
      await logPriceHistory(updatedProd.id, userId, oldProduct?.updated_price || oldProduct?.price, updatedProd.updated_price, finalUpdatedPriceDate, 'Updated Price Changed')
    } else if (isPriceChanged && updatedProd.price) {
      await logPriceHistory(updatedProd.id, userId, oldProduct?.price, updatedProd.price, todayStr, 'Base Price Changed')
    }

    res.json(updatedProd)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/products/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query('DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, userId])
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    clearProductHsnCache()
    res.json({ message: 'Product deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
