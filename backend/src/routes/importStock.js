import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

const LOG_PREFIX = '[ImportStock]'

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

let ensureImportStockSchemaPromise

async function ensureImportStockSchema() {
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50)`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2)`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_name TEXT`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_phone TEXT`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_city TEXT`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_state TEXT`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10, 2)`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS price_covers DECIMAL(10, 2)`).catch(() => {})
  await query(`ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS loose_kg NUMERIC(10, 2) DEFAULT 0`).catch(() => {})
  await query(`UPDATE import_stock SET updated_price_date = CURRENT_DATE WHERE updated_price IS NOT NULL AND (updated_price_date < CURRENT_DATE OR updated_price_date IS NULL)`).catch(() => {})
  await query(`UPDATE products SET updated_price_date = CURRENT_DATE WHERE updated_price IS NOT NULL AND (updated_price_date < CURRENT_DATE OR updated_price_date IS NULL)`).catch(() => {})
  await query(`
    UPDATE products p
    SET stock = i.stock, loose_kg = 0, updated_at = NOW()
    FROM import_stock i
    WHERE (p.sku = i.sku OR p.name = i.name)
      AND i.stock IS NOT NULL
      AND i.updated_at >= p.updated_at
  `).catch(() => {})
}

router.use(async (_req, _res, next) => {
  try {
    ensureImportStockSchemaPromise ||= ensureImportStockSchema().catch((err) => {
      ensureImportStockSchemaPromise = null
      throw err
    })
    await ensureImportStockSchemaPromise
    next()
  } catch (err) {
    next(err)
  }
})

function getIndianDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

/* GET /api/import-stock */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search, status, sort } = req.query
  console.log(`${LOG_PREFIX} GET / — userId: ${userId}, page: ${page}, limit: ${limit}`)
  
  const params = [userId]
  const conditions = ['i.user_id = $1']

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length})`)
  }

  if (status && status !== 'all') {
    params.push(status)
    conditions.push(`i.status = $${params.length}`)
  }

  let orderCol = 'i.created_at DESC, i.id DESC'
  if (sort === 'name_asc') orderCol = 'i.name ASC, i.id DESC'
  else if (sort === 'name_desc') orderCol = 'i.name DESC, i.id DESC'

  try {
    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(i.created_at, i.id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
      const { rows } = await query(
        `SELECT i.*, p.id AS product_id,
          CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock,
          COALESCE(p.loose_kg, 0) AS loose_kg,
          CASE WHEN i.status = 'added' THEN COALESCE(p.price_covers, i.price_covers) ELSE i.price_covers END AS price_covers,
          CASE 
            WHEN i.status = 'added' THEN COALESCE(p.updated_price, i.updated_price)
            ELSE i.updated_price
          END AS updated_price,
          CASE 
            WHEN i.status = 'added' AND p.updated_price IS NOT NULL THEN COALESCE(GREATEST(p.updated_price_date, p.updated_at::date), p.updated_price_date, i.updated_price_date, i.updated_at::date)
            WHEN i.updated_price IS NOT NULL THEN COALESCE(GREATEST(i.updated_price_date, i.updated_at::date), i.updated_price_date, i.updated_at::date)
            ELSE COALESCE(p.updated_price_date, i.updated_price_date)
          END AS updated_price_date
         FROM import_stock i
         LEFT JOIN LATERAL (
           SELECT id, stock, loose_kg, price_covers, updated_price, updated_price_date, updated_at FROM products 
           WHERE (user_id::text = i.user_id::text OR user_id = 'default-user' OR i.user_id = 'default-user') AND (sku = i.sku OR name = i.name OR hsn_code = i.sku) 
           ORDER BY updated_at DESC, created_at DESC LIMIT 1
         ) p ON true
         ${where}
         ORDER BY ${orderCol}
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
    const countRes = await query(
      `SELECT COUNT(*) FROM import_stock i ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1

    params.push(limit, offset)
    const { rows } = await query(
      `SELECT i.*, p.id AS product_id,
        CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock,
        COALESCE(p.loose_kg, 0) AS loose_kg,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price_covers, i.price_covers) ELSE i.price_covers END AS price_covers,
        CASE 
          WHEN i.status = 'added' THEN COALESCE(p.updated_price, i.updated_price)
          ELSE i.updated_price
        END AS updated_price,
        CASE 
          WHEN i.status = 'added' AND p.updated_price IS NOT NULL THEN COALESCE(GREATEST(p.updated_price_date, p.updated_at::date), p.updated_price_date, i.updated_price_date, i.updated_at::date)
          WHEN i.updated_price IS NOT NULL THEN COALESCE(GREATEST(i.updated_price_date, i.updated_at::date), i.updated_price_date, i.updated_at::date)
          ELSE COALESCE(p.updated_price_date, i.updated_price_date)
        END AS updated_price_date
       FROM import_stock i
       LEFT JOIN LATERAL (
         SELECT id, stock, loose_kg, price_covers, updated_price, updated_price_date, updated_at FROM products 
         WHERE (user_id::text = i.user_id::text OR user_id = 'default-user' OR i.user_id = 'default-user') AND (sku = i.sku OR name = i.name OR hsn_code = i.sku) 
         ORDER BY updated_at DESC, created_at DESC LIMIT 1
       ) p ON true
       ${where}
       ORDER BY ${orderCol}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const hasNextPage = page < totalPages
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
    const nextCursor = (hasNextPage && lastRow)
      ? encodeCursor({ created_at: lastRow.created_at, id: lastRow.id })
      : null

    console.log(`${LOG_PREFIX} GET / — returned ${rows.length} rows of ${total}`)
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
    console.error(`${LOG_PREFIX} GET / — ERROR:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/import-stock/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  console.log(`${LOG_PREFIX} GET /${req.params.id} — userId: ${userId}`)
  try {
    const { rows } = await query(
      `SELECT i.id, i.status, i.created_at, i.updated_at, i.user_id, i.buying_price, i.buyer_name, i.buyer_phone, i.buyer_city, i.buyer_state,
        CASE WHEN i.status = 'added' THEN COALESCE(p.name, i.name) ELSE i.name END AS name,
        CASE WHEN i.status = 'added' THEN COALESCE(p.sku, i.sku) ELSE i.sku END AS sku,
        CASE WHEN i.status = 'added' THEN COALESCE(p.category, i.category) ELSE i.category END AS category,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price, i.price) ELSE i.price END AS price,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price_covers, i.price_covers) ELSE i.price_covers END AS price_covers,
        CASE WHEN i.status = 'added' THEN COALESCE(p.updated_price, i.updated_price) ELSE i.updated_price END AS updated_price,
        CASE 
          WHEN i.status = 'added' AND p.updated_price IS NOT NULL THEN COALESCE(GREATEST(p.updated_price_date, p.updated_at::date), p.updated_price_date, i.updated_price_date, i.updated_at::date)
          WHEN i.updated_price IS NOT NULL THEN COALESCE(GREATEST(i.updated_price_date, i.updated_at::date), i.updated_price_date, i.updated_at::date)
          ELSE COALESCE(p.updated_price_date, i.updated_price_date)
        END AS updated_price_date,
        CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock,
        CASE WHEN i.status = 'added' THEN COALESCE(p.unit, i.unit) ELSE i.unit END AS unit,
        CASE WHEN i.status = 'added' THEN COALESCE(p.description, i.description) ELSE i.description END AS description,
        CASE WHEN i.status = 'added' THEN COALESCE(p.bag_weight, i.bag_weight) ELSE i.bag_weight END AS bag_weight
       FROM import_stock i
       LEFT JOIN LATERAL (
         SELECT name, sku, category, price, price_covers, updated_price, updated_price_date, stock, unit, description, bag_weight, updated_at
         FROM products 
         WHERE user_id = i.user_id AND (sku = i.sku OR name = i.name) 
         ORDER BY updated_at DESC, created_at DESC LIMIT 1
       ) p ON true
       WHERE i.id = $1 AND i.user_id = $2`, 
      [req.params.id, userId]
    )
    if (!rows.length) {
      console.warn(`${LOG_PREFIX} GET /${req.params.id} — NOT FOUND`)
      return res.status(404).json({ error: 'Import stock not found' })
    }
    console.log(`${LOG_PREFIX} GET /${req.params.id} — found`)
    res.json({ data: rows[0] })
  } catch (err) {
    console.error('%s GET /%s — ERROR: %s', LOG_PREFIX, req.params.id, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state } = req.body
  console.log(`${LOG_PREFIX} POST / — userId: ${userId}, name: ${name}, price: ${price}`)
  if (!name || !price) {
    console.warn(`${LOG_PREFIX} POST / — VALIDATION FAILED: name=${name}, price=${price}`)
    return res.status(400).json({ error: 'name and price are required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO import_stock (name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, user_id, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()) RETURNING *`,
      [
        name, sku, category, price,
        buying_price ? parseFloat(buying_price) : null,
        price_covers ? parseFloat(price_covers) : null,
        updated_price ? parseFloat(updated_price) : null,
        updated_price_date || getIndianDateStr(),
        stock || 0, status || 'pending', unit || 'pcs', description, userId, parseFloat(bag_weight) || 1,
        buyer_name || null, buyer_phone || null, buyer_city || null, buyer_state || null
      ]
    )
    console.log(`${LOG_PREFIX} POST / — SUCCESS, id: ${rows[0]?.id}`)
    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn(`${LOG_PREFIX} POST / — Redis cache clear failed:`, e.message)
    })
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(`${LOG_PREFIX} POST / — ERROR:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/import-stock/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state } = req.body
  console.log(`${LOG_PREFIX} PUT /${req.params.id} — userId: ${userId}, name: ${name}`)
  try {
    const oldImport = await query('SELECT sku, name, updated_price, updated_price_date FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    const oldRec = oldImport.rows[0]

    const isUpdatedPriceChanged = updated_price !== undefined && updated_price !== null && String(updated_price) !== String(oldRec?.updated_price)

    const todayStr = getIndianDateStr()
    const finalPriceDate = isUpdatedPriceChanged
      ? todayStr
      : (updated_price_date || oldRec?.updated_price_date || todayStr)

    let finalUpdatedPrice = oldRec?.updated_price
    if (updated_price !== undefined && updated_price !== null && updated_price !== '') {
      let upVal = parseFloat(updated_price)
      const bw = parseFloat(bag_weight) || 1
      const pc = parseFloat(price_covers) || 0
      if (pc > 0 && bw > 0 && pc !== bw && upVal >= 2000) {
        upVal = (upVal / pc) * bw
      }
      finalUpdatedPrice = upVal
    }

    const { rows } = await query(
      `UPDATE import_stock SET name=$1, sku=$2, category=$3, price=$4, buying_price=$5, price_covers=$6, updated_price=$7, updated_price_date=$8, stock=$9, status=$10, unit=$11, description=$12, bag_weight=$13, buyer_name=$14, buyer_phone=$15, buyer_city=$16, buyer_state=$17, updated_at=NOW()
       WHERE id=$18 AND user_id = $19 RETURNING *`,
      [
        name, sku, category, price,
        buying_price ? parseFloat(buying_price) : null,
        price_covers ? parseFloat(price_covers) : null,
        finalUpdatedPrice,
        finalPriceDate,
        stock, status || 'pending', unit || 'pcs', description, parseFloat(bag_weight) || 1,
        buyer_name || null, buyer_phone || null, buyer_city || null, buyer_state || null,
        req.params.id, userId
      ]
    )
    if (!rows.length) {
      console.warn(`${LOG_PREFIX} PUT /${req.params.id} — NOT FOUND`)
      return res.status(404).json({ error: 'Import stock not found' })
    }

    if (oldRec) {
      const existingProduct = await query(
        `SELECT id, stock, price, updated_price FROM products WHERE user_id=$1 AND (sku=$2 OR name=$3) LIMIT 1`,
        [userId, oldRec.sku || 'N/A', oldRec.name]
      );

      if (existingProduct.rows.length > 0) {
        const prod = existingProduct.rows[0]
        const oldEffective = prod.updated_price !== null && prod.updated_price !== undefined && prod.updated_price !== ''
          ? parseFloat(prod.updated_price)
          : parseFloat(prod.price || 0)

        const oldStockVal = prod.stock !== undefined && prod.stock !== null ? parseFloat(prod.stock) : 0
        const newStockVal = stock !== undefined && stock !== null ? parseFloat(stock) : oldStockVal
        const stockDiff = newStockVal - oldStockVal

        await query(
          `UPDATE products SET name=$1, sku=$2, category=$3, price=$4, price_covers=$5, updated_price=$6, updated_price_date=$7, stock=$8, unit=$9, description=$10, bag_weight=$11, updated_at=NOW()
           WHERE id=$12`,
          [
            name, sku, category, price, price_covers ? parseFloat(price_covers) : null,
            finalUpdatedPrice,
            finalPriceDate,
            stock !== undefined && stock !== null ? parseFloat(stock) : 0,
            unit || 'pcs', description, parseFloat(bag_weight) || 1, prod.id
          ]
        );

        if (stockDiff !== 0) {
          const changeType = stockDiff > 0 ? 'added' : 'deducted'
          const changeNotes = stockDiff > 0
            ? `Stock updated via Import Stock edit (+${stockDiff} ${unit || 'bags'})`
            : `Stock updated via Import Stock edit (${stockDiff} ${unit || 'bags'})`

          await query(
            `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [prod.id, userId, changeType, stockDiff, oldStockVal, newStockVal, 'Import Stock Update', changeNotes]
          ).catch(() => {})
        }

        const newEffective = finalUpdatedPrice !== null && finalUpdatedPrice !== undefined
          ? finalUpdatedPrice
          : parseFloat(price)

        if (newEffective !== oldEffective) {
          await query(
            `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              prod.id,
              userId,
              oldEffective,
              newEffective,
              finalPriceDate,
              'Import Stock Update'
            ]
          ).catch(e => console.warn('[ImportStock] Price history log error:', e.message))
        }
      }
    }

    console.log(`${LOG_PREFIX} PUT /${req.params.id} — SUCCESS`)
    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn(`${LOG_PREFIX} PUT / — Redis cache clear failed:`, e.message)
    })
    res.json(rows[0])
  } catch (err) {
    console.error('%s PUT /%s — ERROR: %s', LOG_PREFIX, req.params.id, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/bulk-add-to-products */
router.post('/bulk-add-to-products', async (req, res) => {
  const userId = req.workspaceId
  const { ids } = req.body
  console.log('%s POST /bulk-add-to-products — userId: %s, ids:', LOG_PREFIX, userId, ids)
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    console.warn(`${LOG_PREFIX} POST /bulk-add-to-products — VALIDATION FAILED: invalid ids`)
    return res.status(400).json({ error: 'ids array is required' })
  }
  try {
    const { rows: importRows } = await query(
      "SELECT * FROM import_stock WHERE id = ANY($1::int[]) AND status = 'active' AND user_id = $2",
      [ids, userId]
    )
    if (!importRows.length) {
      console.warn(`${LOG_PREFIX} POST /bulk-add-to-products — No valid active items found`)
      return res.status(400).json({ error: 'No active status import stock found for the provided IDs' })
    }

    console.log(`${LOG_PREFIX} POST /bulk-add-to-products — Adding ${importRows.length} items to products`)
    for (const item of importRows) {
      // Check if product exists by SKU or Name
      const existing = await query(
        `SELECT id, price, updated_price FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
        [userId, item.sku || 'N/A', item.name]
      )

      if (existing.rows.length > 0) {
        const targetId = existing.rows[0].id
        const prevP = existing.rows[0].updated_price || existing.rows[0].price
        const newP = item.updated_price || item.price

        // Restock existing product and set status to active
        await query(
          `UPDATE products SET stock = stock + $1, price = $2, price_covers = $3, updated_price = $4, updated_price_date = $5, bag_weight = $6, status = 'active', updated_at = NOW() WHERE id = $7`,
          [item.stock, item.price, item.price_covers ? parseFloat(item.price_covers) : null, item.updated_price || null, item.updated_price_date || new Date().toISOString().split('T')[0], item.bag_weight || 1, targetId]
        )

        await query(
          `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [targetId, userId, prevP, newP, item.updated_price_date || new Date().toISOString().split('T')[0], 'Import Stock Restock']
        ).catch(() => {})
      } else {
        // Insert new product
        const newProd = await query(
          `INSERT INTO products (name, sku, category, price, price_covers, updated_price, updated_price_date, stock, unit, status, description, user_id, bag_weight, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, NOW(), NOW()) RETURNING id`,
          [item.name, item.sku, item.category, item.price, item.price_covers ? parseFloat(item.price_covers) : null, item.updated_price || null, item.updated_price_date || new Date().toISOString().split('T')[0], item.stock, item.unit || 'pcs', item.description, userId, item.bag_weight || 1]
        )
        const targetId = newProd.rows[0].id
        await query(
          `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
           VALUES ($1, $2, NULL, $3, NOW(), 'Initial Base Price', NOW())`,
          [targetId, userId, item.price]
        ).catch(() => {})
        if (item.updated_price) {
          await query(
            `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, 'Updated Price', NOW())`,
            [targetId, userId, item.price, item.updated_price, item.updated_price_date || new Date().toISOString().split('T')[0]]
          ).catch(() => {})
        }
      }
    }

    const { rows } = await query(
      "UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = ANY($1::int[]) AND user_id = $2 RETURNING *",
      [ids, userId]
    )

    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn(`${LOG_PREFIX} POST /bulk-add-to-products — Redis cache clear failed:`, e.message)
    })

    console.log(`${LOG_PREFIX} POST /bulk-add-to-products — SUCCESS, ${importRows.length} products added`)
    res.json({ message: `${importRows.length} products added successfully`, data: rows })
  } catch (err) {
    console.error('%s POST /bulk-add-to-products — ERROR: %s', LOG_PREFIX, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/:id/add-to-products */
router.post('/:id/add-to-products', async (req, res) => {
  const userId = req.workspaceId
  console.log(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — userId: ${userId}`)
  try {
    const { rows: importRows } = await query('SELECT * FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    if (!importRows.length) {
      console.warn(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — NOT FOUND`)
      return res.status(404).json({ error: 'Pending import stock not found' })
    }
    const item = importRows[0]
    
    if (item.status !== 'active') {
      console.warn(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — Not active status (status: ${item.status})`)
      return res.status(400).json({ error: 'Only stock items with "active" status can be added to products' })
    }

    // Check if product exists by SKU or Name
    const existing = await query(
      `SELECT id, price, updated_price FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
      [userId, item.sku || 'N/A', item.name]
    )

    let targetProductId
    let prevPrice = item.price
    let isNewProd = false

    if (existing.rows.length > 0) {
      targetProductId = existing.rows[0].id
      prevPrice = existing.rows[0].updated_price || existing.rows[0].price
      // Restock existing product and set status to active
      await query(
        `UPDATE products SET stock = stock + $1, price = $2, price_covers = $3, updated_price = $4, updated_price_date = $5, bag_weight = $6, status = 'active', updated_at = NOW() WHERE id = $7`,
        [item.stock, item.price, item.price_covers ? parseFloat(item.price_covers) : null, item.updated_price || null, item.updated_price_date || new Date().toISOString().split('T')[0], item.bag_weight || 1, targetProductId]
      )
    } else {
      isNewProd = true
      // Insert new product
      const newProdRes = await query(
        `INSERT INTO products (name, sku, category, price, price_covers, updated_price, updated_price_date, stock, unit, status, description, user_id, bag_weight, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, NOW(), NOW()) RETURNING id`,
        [item.name, item.sku, item.category, item.price, item.price_covers ? parseFloat(item.price_covers) : null, item.updated_price || null, item.updated_price_date || new Date().toISOString().split('T')[0], item.stock, item.unit || 'pcs', item.description, userId, item.bag_weight || 1]
      )
      targetProductId = newProdRes.rows[0].id
    }

    if (targetProductId) {
      if (isNewProd) {
        query(
          `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
           VALUES ($1, $2, NULL, $3, NOW(), 'Initial Base Price', NOW())`,
          [targetProductId, userId, item.price]
        ).catch(() => {})
        if (item.updated_price) {
          query(
            `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, 'Updated Price', NOW())`,
            [targetProductId, userId, item.price, item.updated_price, item.updated_price_date || new Date().toISOString().split('T')[0]]
          ).catch(() => {})
        }
      } else {
        query(
          `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [targetProductId, userId, prevPrice, item.updated_price || item.price, item.updated_price_date || new Date().toISOString().split('T')[0], 'Import Stock Restock']
        ).catch(() => {})
      }
    }

    const { rows } = await query(
      "UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, userId]
    )

    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn('%s POST /%s/add-to-products — Redis cache clear failed: %s', LOG_PREFIX, req.params.id, e.message)
    })

    console.log(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — SUCCESS`)
    res.json(rows[0])
  } catch (err) {
    console.error('%s POST /%s/add-to-products — ERROR: %s', LOG_PREFIX, req.params.id, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/import-stock/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  console.log(`${LOG_PREFIX} DELETE /${req.params.id} — userId: ${userId}`)
  try {
    await query('DELETE FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn('%s DELETE /%s — Redis cache clear failed: %s', LOG_PREFIX, req.params.id, e.message)
    })
    console.log(`${LOG_PREFIX} DELETE /${req.params.id} — SUCCESS`)
    res.json({ message: 'Import stock deleted' })
  } catch (err) {
    console.error('%s DELETE /%s — ERROR: %s', LOG_PREFIX, req.params.id, err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
