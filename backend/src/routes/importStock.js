import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

const LOG_PREFIX = '[ImportStock]'

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

let ensureImportStockSchemaPromise

async function clearImportStockCache(userId) {
  try {
    const keys1 = await redis.keys(`import_stock:${userId}*`).catch(() => [])
    const keys2 = await redis.keys(`import_stock_note:${userId}*`).catch(() => [])
    const allKeys = [...keys1, ...keys2]
    for (const key of allKeys) {
      await redis.del(key).catch(() => {})
    }
  } catch (_err) {
    console.warn('%s Failed to clear import stock cache', LOG_PREFIX)
  }
}

async function ensureImportStockSchema() {
  // Batch all ALTER TABLE ADD COLUMN calls into a single DO $$ block — 1 round trip instead of 15+
  await query(`
    DO $$
    BEGIN
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS updated_price_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_name TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_city TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buyer_state TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS price_covers DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS loose_kg NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS note TEXT;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS add_stock_qty NUMERIC;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS supplier_total_cost DECIMAL(10, 2);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
    END $$;
    CREATE TABLE IF NOT EXISTS import_stock_payments (
      id SERIAL PRIMARY KEY,
      import_stock_id INT NOT NULL,
      user_id TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      payment_mode VARCHAR(50) NOT NULL,
      payment_date DATE,
      note TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS payment_date DATE;
    ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE import_stock_payments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE import_stock_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE import_stock_payments FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS import_stock_payments_user_policy ON public.import_stock_payments;
    DROP POLICY IF EXISTS user_isolation_policy ON public.import_stock_payments;
    CREATE POLICY user_isolation_policy ON public.import_stock_payments FOR ALL USING ((user_id = current_setting('app.current_user_id'::text, true)) OR (current_setting('app.bypass_rls'::text, true) = 'on'::text));
  `).catch(() => {})

  // Run data-fix queries in parallel — no dependency between them
  await Promise.all([
    query(`UPDATE import_stock SET updated_price_date = CURRENT_DATE WHERE updated_price IS NOT NULL AND (updated_price_date < CURRENT_DATE OR updated_price_date IS NULL)`).catch(() => {}),
    query(`UPDATE products SET updated_price_date = CURRENT_DATE WHERE updated_price IS NOT NULL AND (updated_price_date < CURRENT_DATE OR updated_price_date IS NULL)`).catch(() => {}),
  ])

  // Restore import_stock.stock to original purchased qty using the earliest stock_before in history
  // (The stock history records what the quantity was BEFORE each deduction, so max = original purchased qty)
  await query(`
    UPDATE import_stock i
    SET stock = orig.original_stock
    FROM (
      SELECT p.id AS product_id,
             MAX(psh.stock_before::numeric) AS original_stock
      FROM product_stock_history psh
      JOIN products p ON p.id = psh.product_id
      WHERE psh.source IN ('Bill', 'Quote')
      GROUP BY p.id
    ) orig
    JOIN products p ON p.id = orig.product_id
    WHERE (LOWER(TRIM(i.name)) = LOWER(TRIM(p.name)) OR (i.sku IS NOT NULL AND i.sku <> '' AND i.sku <> 'N/A' AND i.sku = p.sku))
      AND i.status = 'added'
      AND orig.original_stock > i.stock
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

const IMPORT_STOCK_LATERAL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT id, stock, loose_kg, price_covers, updated_price, updated_price_date, updated_at FROM products 
    WHERE (user_id::text = i.user_id::text OR user_id = 'default-user' OR i.user_id = 'default-user') 
      AND (
        (i.sku IS NOT NULL AND i.sku <> '' AND i.sku <> 'N/A' AND (sku = i.sku OR hsn_code = i.sku))
        OR (LOWER(TRIM(name)) = LOWER(TRIM(i.name)))
      ) 
    ORDER BY updated_at DESC, created_at DESC LIMIT 1
  ) p ON true
`

const IMPORT_STOCK_SELECT_FIELDS = `
  i.*, p.id AS product_id,
  CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock,
  CASE WHEN i.status = 'added' THEN COALESCE(p.loose_kg, i.loose_kg) ELSE i.loose_kg END AS loose_kg,
  CASE WHEN i.status = 'added' THEN COALESCE(p.price_covers, i.price_covers) ELSE i.price_covers END AS price_covers,
  CASE 
    WHEN i.status = 'added' THEN COALESCE(p.updated_price, i.updated_price)
    ELSE i.updated_price
  END AS updated_price,
  CASE 
    WHEN i.status = 'added' AND p.updated_price IS NOT NULL THEN COALESCE(GREATEST(p.updated_price_date, (p.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date), p.updated_price_date, i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)
    WHEN i.updated_price IS NOT NULL THEN COALESCE(GREATEST(i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date), i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)
    ELSE COALESCE(p.updated_price_date, i.updated_price_date)
  END AS updated_price_date
`

function buildImportStockFilters(userId, search, status, sort) {
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

  return { params, conditions, orderCol }
}

async function fetchImportStockCursor(res, { conditions, params, limit, orderCol, cursor, cacheKey }) {
  if (cursor.created_at && cursor.id) {
    params.push(cursor.created_at, cursor.id)
    conditions.push(`(i.created_at, i.id) < ($${params.length - 1}, $${params.length})`)
  }
  const where = `WHERE ${conditions.join(' AND ')}`
  params.push(limit + 1)
  const { rows } = await query(
    `SELECT ${IMPORT_STOCK_SELECT_FIELDS}
     FROM import_stock i
     ${IMPORT_STOCK_LATERAL_JOIN}
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

  const responsePayload = { data: rows, limit, hasNextPage, nextCursor }
  await redis.set(cacheKey, JSON.stringify(responsePayload), { ex: 300 }).catch(() => {})
  return res.json(responsePayload)
}

async function fetchImportStockOffset(res, { conditions, params, limit, offset, page, orderCol, cacheKey }) {
  const where = `WHERE ${conditions.join(' AND ')}`
  const countRes = await query(
    `SELECT COUNT(*) FROM import_stock i ${where}`,
    params
  )
  const total = Number.parseInt(countRes.rows[0].count, 10) || 0
  const totalPages = Math.ceil(total / limit) || 1

  params.push(limit, offset)
  const { rows } = await query(
    `SELECT ${IMPORT_STOCK_SELECT_FIELDS}
     FROM import_stock i
     ${IMPORT_STOCK_LATERAL_JOIN}
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

  const responsePayload = {
    data: rows,
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    nextCursor
  }
  await redis.set(cacheKey, JSON.stringify(responsePayload), { ex: 300 }).catch(() => {})
  return res.json(responsePayload)
}

/* GET /api/import-stock */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search, status, sort } = req.query
  console.log('%s GET /', LOG_PREFIX)

  const { params, conditions, orderCol } = buildImportStockFilters(userId, search, status, sort)
  const cacheKey = `import_stock:${userId}:${JSON.stringify({ search, status, sort, page, limit, cursor })}`

  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) {
      console.log(`${LOG_PREFIX} GET / — CACHE HIT`)
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached)
    }

    if (cursor) {
      return await fetchImportStockCursor(res, { conditions, params, limit, orderCol, cursor, cacheKey })
    }
    return await fetchImportStockOffset(res, { conditions, params, limit, offset, page, orderCol, cacheKey })
  } catch (err) {
    console.error('%s GET / ERROR', LOG_PREFIX)
    return res.status(500).json({ error: err.message })
  }
})

/* GET /api/import-stock/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  console.log('%s GET /:id', LOG_PREFIX)
  try {

    const { rows } = await query(
      `SELECT i.id, i.status, i.created_at, i.updated_at, i.user_id, i.buying_price, i.buyer_name, i.buyer_phone, i.buyer_city, i.buyer_state, i.add_stock_qty, i.supplier_total_cost, i.paid_amount, i.payment_mode,
        CASE WHEN i.status = 'added' THEN COALESCE(p.name, i.name) ELSE i.name END AS name,
        CASE WHEN i.status = 'added' THEN COALESCE(p.sku, i.sku) ELSE i.sku END AS sku,
        CASE WHEN i.status = 'added' THEN COALESCE(p.category, i.category) ELSE i.category END AS category,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price, i.price) ELSE i.price END AS price,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price_covers, i.price_covers) ELSE i.price_covers END AS price_covers,
        CASE WHEN i.status = 'added' THEN COALESCE(p.updated_price, i.updated_price) ELSE i.updated_price END AS updated_price,
        CASE 
          WHEN i.status = 'added' AND p.updated_price IS NOT NULL THEN COALESCE(GREATEST(p.updated_price_date, (p.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date), p.updated_price_date, i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)
          WHEN i.updated_price IS NOT NULL THEN COALESCE(GREATEST(i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date), i.updated_price_date, (i.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)
          ELSE COALESCE(p.updated_price_date, i.updated_price_date)
        END AS updated_price_date,
        i.stock AS stock,
        CASE WHEN i.status = 'added' THEN COALESCE(p.unit, i.unit) ELSE i.unit END AS unit,
        CASE WHEN i.status = 'added' THEN COALESCE(p.description, i.description) ELSE i.description END AS description,
        CASE WHEN i.status = 'added' THEN COALESCE(p.bag_weight, i.bag_weight) ELSE i.bag_weight END AS bag_weight,
        i.loose_kg AS loose_kg
       FROM import_stock i
       LEFT JOIN LATERAL (
         SELECT name, sku, category, price, price_covers, updated_price, updated_price_date, stock, unit, description, bag_weight, loose_kg, updated_at
         FROM products 
         WHERE (user_id::text = i.user_id::text OR user_id = 'default-user')
           AND (
             (i.sku IS NOT NULL AND i.sku <> '' AND i.sku <> 'N/A' AND (sku = i.sku OR hsn_code = i.sku))
             OR (LOWER(TRIM(name)) = LOWER(TRIM(i.name)))
           ) 
         ORDER BY updated_at DESC, created_at DESC LIMIT 1
       ) p ON true
       WHERE i.id = $1 AND i.user_id = $2`, 
      [req.params.id, userId]
    )
    if (!rows.length) {
      console.warn('%s GET /:id — NOT FOUND', LOG_PREFIX)
      return res.status(404).json({ error: 'Import stock not found' })
    }
    console.log('%s GET /:id — found', LOG_PREFIX)
    
    const payments = await query(
      `SELECT id, amount, payment_mode, payment_date, COALESCE(note, notes) as note, created_at 
       FROM import_stock_payments 
       WHERE import_stock_id = $1 AND user_id = $2 
       ORDER BY created_at DESC`, 
      [req.params.id, userId]
    )
    
    const rec = rows[0]
    const prodRes = await query(
      `SELECT stock, loose_kg FROM products WHERE user_id=$1 AND (sku=$2 OR name=$3) LIMIT 1`,
      [userId, rec.sku || 'N/A', rec.name]
    )
    const liveProductStock = prodRes.rows.length > 0 ? Number.parseFloat(prodRes.rows[0].stock || 0) : null
    const looseKg = prodRes.rows.length > 0 ? Number.parseFloat(prodRes.rows[0].loose_kg || 0) : 0

    const responsePayload = {
      data: {
        ...rec,
        live_product_stock: liveProductStock,
        loose_kg: looseKg,
        payments: payments.rows
      }
    }
    res.json(responsePayload)
  } catch (err) {
    console.error('%s GET /:id ERROR', LOG_PREFIX)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, note, add_stock_qty, supplier_total_cost } = req.body
  console.log('%s POST / — creating stock item', LOG_PREFIX)
  if (!name || !price) {
    console.warn('%s POST / — VALIDATION FAILED: missing required fields', LOG_PREFIX)
    return res.status(400).json({ error: 'name and price are required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO import_stock (name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, user_id, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, note, add_stock_qty, supplier_total_cost, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()) RETURNING *`,
      [
        name, sku, category, price,
        buying_price ? Number.parseFloat(buying_price) : null,
        price_covers ? Number.parseFloat(price_covers) : null,
        updated_price ? Number.parseFloat(updated_price) : null,
        updated_price_date || getIndianDateStr(),
        stock || 0, status || 'pending', unit || 'pcs', description, userId, Number.parseFloat(bag_weight) || 1,
        buyer_name || null, buyer_phone || null, buyer_city || null, buyer_state || null,
        note || null,
        add_stock_qty ? Number.parseFloat(add_stock_qty) : null,
        supplier_total_cost ? Number.parseFloat(supplier_total_cost) : null
      ]
    )
    console.log('%s POST / SUCCESS', LOG_PREFIX)
    await clearImportStockCache(userId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('%s POST / ERROR', LOG_PREFIX)
    res.status(500).json({ error: err.message })
  }
})

async function syncProductStockFromImportEdit(userId, oldRec, body, finalUpdatedPrice, finalPriceDate, importId) {
  const existingProduct = await query(
    `SELECT id, stock, price, updated_price FROM products WHERE user_id=$1 AND (sku=$2 OR name=$3) LIMIT 1`,
    [userId, oldRec.sku || 'N/A', oldRec.name]
  )
  if (!existingProduct.rows.length) return

  const prod = existingProduct.rows[0]
  const oldEffective = prod.updated_price !== null && prod.updated_price !== undefined && prod.updated_price !== ''
    ? Number.parseFloat(prod.updated_price)
    : Number.parseFloat(prod.price || 0)

  const currentLiveStock = prod.stock !== undefined && prod.stock !== null ? Number.parseFloat(prod.stock) : 0
  const explicitAddStock = (body.add_stock_qty !== undefined && body.add_stock_qty !== null && body.add_stock_qty !== '') ? Number.parseFloat(body.add_stock_qty) : 0

  const oldBatchStock = Number.parseFloat(oldRec.stock || 0)
  const newBatchStock = body.stock !== undefined && body.stock !== null ? Number.parseFloat(body.stock) : oldBatchStock
  const batchStockDiff = newBatchStock - oldBatchStock

  const totalStockDelta = explicitAddStock !== 0 ? explicitAddStock : batchStockDiff
  const finalProductStock = currentLiveStock + totalStockDelta
  const finalImportBatchStock = explicitAddStock !== 0 ? (oldBatchStock + explicitAddStock) : newBatchStock

  await query(
    `UPDATE import_stock SET stock = $1, add_stock_qty = NULL WHERE id = $2 AND user_id = $3`,
    [finalImportBatchStock, importId, userId]
  )

  await query(
    `UPDATE products SET name=$1, sku=$2, category=$3, price=$4, price_covers=$5, updated_price=$6, updated_price_date=$7, stock=$8, unit=$9, description=$10, bag_weight=$11, updated_at=NOW()
     WHERE id=$12`,
    [
      body.name, body.sku, body.category, body.price,
      body.price_covers ? Number.parseFloat(body.price_covers) : null,
      finalUpdatedPrice,
      finalPriceDate,
      finalProductStock,
      body.unit || 'pcs', body.description, Number.parseFloat(body.bag_weight) || 1, prod.id
    ]
  )

  if (totalStockDelta !== 0) {
    const changeType = totalStockDelta > 0 ? 'added' : 'deducted'
    const changeNotes = totalStockDelta > 0
      ? `Stock updated via Import Stock edit (+${totalStockDelta} ${body.unit || 'bags'})`
      : `Stock updated via Import Stock edit (${totalStockDelta} ${body.unit || 'bags'})`

    await query(
      `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [prod.id, userId, changeType, totalStockDelta, currentLiveStock, finalProductStock, 'Import Stock Update', changeNotes]
    ).catch(() => {})
  }

  const newEffective = finalUpdatedPrice !== null && finalUpdatedPrice !== undefined
    ? finalUpdatedPrice
    : Number.parseFloat(body.price)

  if (newEffective !== oldEffective) {
    await query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [prod.id, userId, oldEffective, newEffective, finalPriceDate, 'Import Stock Update']
    ).catch(() => console.warn('%s Price history log error', LOG_PREFIX))
  }
}

/* PUT /api/import-stock/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, note, add_stock_qty, supplier_total_cost } = req.body
  console.log('%s PUT /:id', LOG_PREFIX)
  try {
    const oldImport = await query('SELECT sku, name, stock, updated_price, updated_price_date FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    const oldRec = oldImport.rows[0]

    const isUpdatedPriceChanged = updated_price !== undefined && updated_price !== null && String(updated_price) !== String(oldRec?.updated_price)
    const todayStr = getIndianDateStr()
    const finalPriceDate = isUpdatedPriceChanged
      ? todayStr
      : (updated_price_date || oldRec?.updated_price_date || todayStr)

    let finalUpdatedPrice = oldRec?.updated_price
    if (updated_price !== undefined && updated_price !== null && updated_price !== '') {
      finalUpdatedPrice = Number.parseFloat(updated_price)
    }

    const { rows } = await query(
      `UPDATE import_stock SET name=$1, sku=$2, category=$3, price=$4, buying_price=$5, price_covers=$6, updated_price=$7, updated_price_date=$8, stock=$9, status=$10, unit=$11, description=$12, bag_weight=$13, buyer_name=$14, buyer_phone=$15, buyer_city=$16, buyer_state=$17, note=$18, add_stock_qty=$19, supplier_total_cost=$20, updated_at=NOW()
       WHERE id=$21 AND user_id = $22 RETURNING *`,
      [
        name, sku, category, price,
        buying_price ? Number.parseFloat(buying_price) : null,
        price_covers ? Number.parseFloat(price_covers) : null,
        finalUpdatedPrice,
        finalPriceDate,
        stock, status || 'pending', unit || 'pcs', description, Number.parseFloat(bag_weight) || 1,
        buyer_name || null, buyer_phone || null, buyer_city || null, buyer_state || null,
        note || null,
        add_stock_qty ? Number.parseFloat(add_stock_qty) : null,
        supplier_total_cost ? Number.parseFloat(supplier_total_cost) : null,
        req.params.id, userId
      ]
    )
    if (!rows.length) {
      console.warn('%s PUT /:id NOT FOUND', LOG_PREFIX)
      return res.status(404).json({ error: 'Import stock not found' })
    }

    if (oldRec) {
      await syncProductStockFromImportEdit(userId, oldRec, req.body, finalUpdatedPrice, finalPriceDate, req.params.id)
    }

    console.log('%s PUT /:id — SUCCESS', LOG_PREFIX)
    await clearImportStockCache(userId)
    return res.json(rows[0])
  } catch (err) {
    console.error('%s PUT /:id ERROR', LOG_PREFIX)
    return res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/import-stock/:id/supplier-cost */
router.patch('/:id/supplier-cost', async (req, res) => {
  const userId = req.workspaceId
  const { supplier_total_cost } = req.body
  try {
    const { rows } = await query(
      `UPDATE import_stock SET supplier_total_cost = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [supplier_total_cost !== undefined && supplier_total_cost !== '' ? Number.parseFloat(supplier_total_cost) : null, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Import stock not found' })
    await clearImportStockCache(userId)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/import-stock/:id/payment */
router.patch('/:id/payment', async (req, res) => {
  const userId = req.workspaceId
  const { paid_amount, payment_mode } = req.body
  try {
    const { rows } = await query(
      `UPDATE import_stock 
       SET paid_amount = $1, payment_mode = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        paid_amount !== undefined && paid_amount !== '' ? Number.parseFloat(paid_amount) : 0,
        payment_mode || null,
        req.params.id,
        userId
      ]
    )
    if (!rows.length) return res.status(404).json({ error: 'Import stock not found' })
    await clearImportStockCache(userId)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/:id/payments */
router.post('/:id/payments', async (req, res) => {
  const userId = req.workspaceId
  const { amount, payment_mode, payment_date, note, notes } = req.body
  const paymentNote = note || notes || null
  if (!amount || Number.parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO import_stock_payments (import_stock_id, user_id, amount, payment_mode, payment_date, note, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, NOW()) RETURNING *`,
      [
        req.params.id,
        userId,
        Number.parseFloat(amount),
        payment_mode || 'Cash',
        payment_date || getIndianDateStr(),
        paymentNote
      ]
    )
    await clearImportStockCache(userId)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/import-stock/:id/payments/:paymentId */
router.delete('/:id/payments/:paymentId', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query(
      `DELETE FROM import_stock_payments 
       WHERE id = $1 AND import_stock_id = $2 AND user_id = $3`,
      [req.params.paymentId, req.params.id, userId]
    )
    await clearImportStockCache(userId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function syncOrInsertProductFromImportItem(item, userId) {
  const existing = await query(
    `SELECT id, price, updated_price FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
    [userId, item.sku || 'N/A', item.name]
  )

  const dateStr = item.updated_price_date || new Date().toISOString().split('T')[0]
  const looseKg = Number.parseFloat(item.loose_kg || 0)
  const priceCovers = item.price_covers ? Number.parseFloat(item.price_covers) : null

  if (existing.rows.length > 0) {
    const targetId = existing.rows[0].id
    const prevP = existing.rows[0].updated_price || existing.rows[0].price
    const newP = item.updated_price || item.price
    const currentStock = Number.parseFloat(existing.rows[0].stock || 0)
    const importedQty = Number.parseFloat(item.stock || 0)
    const newStock = currentStock + importedQty
    let unitLabel = item.unit || 'pcs'
    if (Number(item.bag_weight || 1) > 1) {
      unitLabel = importedQty === 1 ? 'Bag' : 'Bags'
    }

    await query(
      `UPDATE products SET stock = stock + $1, loose_kg = COALESCE(loose_kg, 0) + $2, price = $3, price_covers = $4, updated_price = $5, updated_price_date = $6, bag_weight = $7, status = 'active', updated_at = NOW() WHERE id = $8`,
      [item.stock, looseKg, item.price, priceCovers, item.updated_price || null, dateStr, item.bag_weight || 1, targetId]
    )

    await query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [targetId, userId, prevP, newP, dateStr, 'Import Stock Restock']
    ).catch(() => {})

    if (importedQty > 0) {
      const supplierSuffix = item.buyer_name ? ` (Supplier: ${item.buyer_name})` : ''
      await query(
        `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
         VALUES ($1, $2, 'added', $3, $4, $5, 'Stock Import', $6, NOW())`,
        [
          targetId, userId, importedQty, currentStock, newStock,
          `Restocked +${importedQty} ${unitLabel} via Stock Import${supplierSuffix}`
        ]
      ).catch(() => {})
    }

    return targetId
  }

  const newProd = await query(
    `INSERT INTO products (name, sku, category, price, price_covers, updated_price, updated_price_date, stock, loose_kg, unit, status, description, user_id, bag_weight, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, NOW(), NOW()) RETURNING id`,
    [item.name, item.sku, item.category, item.price, priceCovers, item.updated_price || null, dateStr, item.stock, looseKg, item.unit || 'pcs', item.description, userId, item.bag_weight || 1]
  )
  const targetId = newProd.rows[0].id
  const importedQty = Number.parseFloat(item.stock || 0)
  let unitLabel = item.unit || 'pcs'
  if (Number(item.bag_weight || 1) > 1) {
    unitLabel = importedQty === 1 ? 'Bag' : 'Bags'
  }

  await query(
    `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
     VALUES ($1, $2, NULL, $3, NOW(), 'Initial Base Price', NOW())`,
    [targetId, userId, item.price]
  ).catch(() => {})
  if (item.updated_price) {
    await query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Updated Price', NOW())`,
      [targetId, userId, item.price, item.updated_price, dateStr]
    ).catch(() => {})
  }
  if (importedQty > 0) {
    const supplierSuffix = item.buyer_name ? ` (Supplier: ${item.buyer_name})` : ''
    await query(
      `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
       VALUES ($1, $2, 'added', $3, 0, $4, 'Stock Import', $5, NOW())`,
      [
        targetId, userId, importedQty, importedQty,
        `Initial imported stock of ${importedQty} ${unitLabel} from Stock Import${supplierSuffix}`
      ]
    ).catch(() => {})
  }
  return targetId
}

/* POST /api/import-stock/bulk-add-to-products */
router.post('/bulk-add-to-products', async (req, res) => {
  const userId = req.workspaceId
  const { ids } = req.body
  console.log('%s POST /bulk-add-to-products', LOG_PREFIX)
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
      await syncOrInsertProductFromImportItem(item, userId)
    }

    const { rows } = await query(
      "UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = ANY($1::int[]) AND user_id = $2 RETURNING *",
      [ids, userId]
    )

    await clearImportStockCache(userId)
    console.log(`${LOG_PREFIX} POST /bulk-add-to-products — SUCCESS, ${importRows.length} products added`)
    return res.json({ message: `${importRows.length} products added successfully`, data: rows })
  } catch (err) {
    console.error('%s POST /bulk-add-to-products ERROR', LOG_PREFIX)
    return res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/:id/add-to-products */
router.post('/:id/add-to-products', async (req, res) => {
  const userId = req.workspaceId
  console.log('%s POST /:id/add-to-products', LOG_PREFIX)
  try {
    const { rows: importRows } = await query('SELECT * FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    if (!importRows.length) {
      console.warn('%s POST /:id/add-to-products NOT FOUND', LOG_PREFIX)
      return res.status(404).json({ error: 'Pending import stock not found' })
    }
    const item = importRows[0]
    
    if (item.status !== 'active') {
      console.warn('%s POST /:id/add-to-products Not active status', LOG_PREFIX)
      return res.status(400).json({ error: 'Only stock items with "active" status can be added to products' })
    }

    await syncOrInsertProductFromImportItem(item, userId)

    const { rows } = await query(
      "UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, userId]
    )

    await clearImportStockCache(userId)
    console.log('%s POST /:id/add-to-products — SUCCESS', LOG_PREFIX)
    return res.json(rows[0])
  } catch (err) {
    console.error('%s POST /:id/add-to-products ERROR', LOG_PREFIX)
    return res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/import-stock/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  console.log('%s DELETE /:id', LOG_PREFIX)
  try {
    await query('DELETE FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    await query('DELETE FROM import_stock_payments WHERE import_stock_id = $1 AND user_id = $2', [req.params.id, userId]).catch(() => {})
    await clearImportStockCache(userId)
    console.log('%s DELETE /:id — SUCCESS', LOG_PREFIX)
    res.json({ message: 'Import stock deleted' })
  } catch (err) {
    console.error('%s DELETE /:id ERROR', LOG_PREFIX)
    res.status(500).json({ error: err.message })
  }
})

export default router
