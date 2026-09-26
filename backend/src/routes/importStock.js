import { Router } from 'express'
import { query, querySerial } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { getCached, setCached, deleteCached, deleteCachedPattern, clearMemoryCachePrefix } from '../lib/fastCache.js'
import { clearProductsCache } from './products.js'

const router = Router()
router.use(requireAuth)

const LOG_PREFIX = '[ImportStock]'

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

let ensureImportStockSchemaPromise

async function clearImportStockCache(userId) {
  try {
    // Use prefix deletion (avoids slow O(N) redis.keys scan)
    clearMemoryCachePrefix(`import_stock:${userId}`)
    clearMemoryCachePrefix(`import_stock_note:${userId}`)
    deleteCached(redis, `profit_margin:${userId}`)
    await Promise.all([
      deleteCachedPattern(redis, `import_stock:${userId}*`),
      deleteCachedPattern(redis, `import_stock_note:${userId}*`),
      clearProductsCache(userId),
    ]).catch(() => {})
  } catch (_err) {
    console.warn('%s Failed to clear import stock cache: %s', LOG_PREFIX, _err?.message || _err)
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
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
      ALTER TABLE import_stock ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(50);
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
}

async function syncImportStockFinancials(importStockId, userId) {
  try {
    // Use querySerial to run all 3 statements on ONE db connection
    // (avoids 2 extra pool.connect() + set_config() round-trips)
    const [itemRes, payRes] = await querySerial([
      {
        text: `SELECT id, stock, bag_weight, buying_price, price_covers FROM import_stock WHERE id = $1 AND user_id = $2`,
        params: [importStockId, userId]
      },
      {
        text: `SELECT COALESCE(SUM(amount), 0) AS total_paid, 
                (SELECT payment_mode FROM import_stock_payments WHERE import_stock_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1) as last_payment_mode
         FROM import_stock_payments 
         WHERE import_stock_id = $1 AND user_id = $2`,
        params: [importStockId, userId]
      },
    ])

    if (!itemRes.rows.length) return

    const item = itemRes.rows[0]
    const stockQty = Number.parseFloat(item.stock || 0)
    const bagWeight = Number.parseFloat(item.bag_weight || 1)
    const buyingPrice = Number.parseFloat(item.buying_price || 0)
    const priceCovers = Number.parseFloat(item.price_covers || 0)

    let totalAmount = 0
    if (priceCovers > 0) {
      totalAmount = stockQty * bagWeight * (buyingPrice / priceCovers)
    } else {
      totalAmount = stockQty * buyingPrice
    }
    totalAmount = Math.round(totalAmount * 100) / 100

    const totalPaid = Math.round(Number.parseFloat(payRes.rows[0]?.total_paid || 0) * 100) / 100
    const lastPaymentMode = payRes.rows[0]?.last_payment_mode || null
    const balanceDue = Math.max(0, Math.round((totalAmount - totalPaid) * 100) / 100)

    await query(
      `UPDATE import_stock 
       SET total_amount = $1,
           amount_paid = $2,
           paid_amount = $2,
           balance_due = $3,
           payment_mode = COALESCE($4, payment_mode)
       WHERE id = $5 AND user_id = $6`,
      [totalAmount, totalPaid, balanceDue, lastPaymentMode, importStockId, userId]
    )
  } catch (err) {
    console.error('[ImportStock] Error syncing financials:', err.message)
  }
}

router.use((_req, _res, next) => {
  if (!ensureImportStockSchemaPromise) {
    ensureImportStockSchemaPromise = ensureImportStockSchema().catch((err) => {
      ensureImportStockSchemaPromise = null
      console.warn('[ImportStock Schema Warning]', err.message)
    })
  }
  next()
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
  i.*,
  COALESCE(
    NULLIF(TRIM(i.created_by_name), 'Admin'),
    (SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') FROM shop_profiles WHERE user_id::text = i.user_id::text LIMIT 1),
    (SELECT shop_name FROM shop_profiles WHERE user_id::text = i.user_id::text LIMIT 1),
    'Admin'
  ) AS created_by_name,
  CASE WHEN i.created_by_role ILIKE 'member' THEN 'Member' ELSE 'Admin' END AS created_by_role,
  p.id AS product_id,
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
    conditions.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR i.hsn_code ILIKE $${params.length})`)
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
  setCached(redis, cacheKey, responsePayload, 120)
  return res.json(responsePayload)
}

async function fetchImportStockOffset(res, { conditions, params, limit, offset, page, orderCol, cacheKey }) {
  const where = `WHERE ${conditions.join(' AND ')}`
  const queryParams = [...params, limit, offset]

  const { rows: rawRows } = await query(
    `SELECT ${IMPORT_STOCK_SELECT_FIELDS}, COUNT(*) OVER() AS _total_count
     FROM import_stock i
     ${IMPORT_STOCK_LATERAL_JOIN}
     ${where}
     ORDER BY ${orderCol}
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams
  )

  let total = rawRows.length > 0 ? Number.parseInt(rawRows[0]._total_count, 10) : 0
  if (total === 0 && offset > 0) {
    const countRes = await query(`SELECT COUNT(*) FROM import_stock i ${where}`, params)
    total = Number.parseInt(countRes.rows[0]?.count, 10) || 0
  }

  const rows = rawRows.map(r => {
    const { _total_count, ...rest } = r
    return rest
  })
  const totalPages = Math.ceil(total / limit) || 1

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
  setCached(redis, cacheKey, responsePayload, 120)
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
    const cached = await getCached(redis, cacheKey, 200)
    if (cached) {
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
  const noteKey = `import_stock_note:${userId}:${req.params.id}`
  try {
    // Serve from cache (60s TTL) — cleared on every payment add/delete/edit
    const cached = await getCached(redis, noteKey, 100)
    if (cached) {
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached)
    }

    // Run all 3 queries in parallel to avoid 3 sequential round-trips
    const [stockRes, paymentsRes] = await Promise.all([
      query(
        `SELECT i.id, i.status, i.created_at, i.updated_at, i.user_id, i.buying_price, i.buyer_name, i.buyer_phone, i.buyer_city, i.buyer_state, i.add_stock_qty, i.paid_amount, i.payment_mode, i.total_amount, i.amount_paid, i.balance_due,
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
          COALESCE(p.loose_kg, i.loose_kg) AS loose_kg,
          COALESCE(p.stock, i.stock) AS live_product_stock
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
      ),
      query(
        `SELECT id, amount, payment_mode, payment_date, COALESCE(note, notes) as note, created_at 
         FROM import_stock_payments 
         WHERE import_stock_id = $1 AND user_id = $2 
         ORDER BY created_at DESC`,
        [req.params.id, userId]
      ),
    ])

    if (!stockRes.rows.length) {
      console.warn('%s GET /:id — NOT FOUND', LOG_PREFIX)
      return res.status(404).json({ error: 'Import stock not found' })
    }

    const rec = stockRes.rows[0]
    const responsePayload = {
      data: {
        ...rec,
        payments: paymentsRes.rows
      }
    }

    // Cache for 60s — invalidated on any payment or stock edit
    setCached(redis, noteKey, responsePayload, 60)
    res.json(responsePayload)
  } catch (err) {
    console.error('%s GET /:id ERROR', LOG_PREFIX)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, note, add_stock_qty } = req.body
  console.log('%s POST / — creating stock item', LOG_PREFIX)
  if (!name || !price) {
    console.warn('%s POST / — VALIDATION FAILED: missing required fields', LOG_PREFIX)
    return res.status(400).json({ error: 'name and price are required' })
  }
  const creatorName = (req.user?.firstName || req.user?.first_name)
    ? `${req.user.firstName || req.user.first_name} ${req.user?.lastName || req.user?.last_name || ''}`.trim()
    : (req.user?.shopName || req.user?.email?.split('@')[0] || 'Admin')
  const creatorEmail = req.user?.email || ''
  const creatorRole = req.memberRole?.toLowerCase() === 'member' ? 'Member' : 'Admin'

  try {
    const stockQty = Number.parseFloat(stock) || 0
    const bagWeightVal = Number.parseFloat(bag_weight) || 1
    const buyingPriceVal = Number.parseFloat(buying_price) || 0
    const priceCoversVal = Number.parseFloat(price_covers) || 0

    let totalAmount = 0
    if (priceCoversVal > 0) {
      totalAmount = stockQty * bagWeightVal * (buyingPriceVal / priceCoversVal)
    } else {
      totalAmount = stockQty * buyingPriceVal
    }
    totalAmount = Math.round(totalAmount * 100) / 100
    const balanceDue = totalAmount

    const { rows } = await query(
      `INSERT INTO import_stock (
        name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date,
        stock, status, unit, description, user_id, bag_weight, buyer_name, buyer_phone,
        buyer_city, buyer_state, note, add_stock_qty, total_amount, amount_paid, paid_amount,
        balance_due, created_by_name, created_by_email, created_by_role, created_at, updated_at
      )
       VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, 0, 0,
        $22, $23, $24, $25, NOW(), NOW()
      ) RETURNING *`,
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
        totalAmount,
        balanceDue,
        creatorName, creatorEmail, creatorRole
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

async function logImportStockDelta(prodId, userId, totalStockDelta, currentLiveStock, finalProductStock, unit) {
  if (totalStockDelta === 0) return
  const changeType = totalStockDelta > 0 ? 'added' : 'deducted'
  const changeNotes = totalStockDelta > 0
    ? `Stock updated via Import Stock edit (+${totalStockDelta} ${unit || 'bags'})`
    : `Stock updated via Import Stock edit (${totalStockDelta} ${unit || 'bags'})`

  await query(
    `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [prodId, userId, changeType, totalStockDelta, currentLiveStock, finalProductStock, 'Import Stock Update', changeNotes]
  ).catch(() => {})
}

async function logImportPriceChange(prodId, userId, oldEffective, newEffective, finalPriceDate) {
  if (newEffective === oldEffective) return
  await query(
    `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [prodId, userId, oldEffective, newEffective, finalPriceDate, 'Import Stock Update']
  ).catch(() => console.warn('%s Price history log error', LOG_PREFIX))
}

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

  await logImportStockDelta(prod.id, userId, totalStockDelta, currentLiveStock, finalProductStock, body.unit)

  const newEffective = finalUpdatedPrice !== null && finalUpdatedPrice !== undefined
    ? finalUpdatedPrice
    : Number.parseFloat(body.price)

  await logImportPriceChange(prod.id, userId, oldEffective, newEffective, finalPriceDate)
}

/* PUT /api/import-stock/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, buying_price, price_covers, updated_price, updated_price_date, stock, status, unit, description, bag_weight, buyer_name, buyer_phone, buyer_city, buyer_state, note, add_stock_qty } = req.body
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
      `UPDATE import_stock SET name=$1, sku=$2, category=$3, price=$4, buying_price=$5, price_covers=$6, updated_price=$7, updated_price_date=$8, stock=$9, status=$10, unit=$11, description=$12, bag_weight=$13, buyer_name=$14, buyer_phone=$15, buyer_city=$16, buyer_state=$17, note=$18, add_stock_qty=$19, updated_at=NOW()
       WHERE id=$20 AND user_id = $21 RETURNING *`,
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

    await syncImportStockFinancials(req.params.id, userId)
    console.log('%s PUT /:id — SUCCESS', LOG_PREFIX)
    await clearImportStockCache(userId)
    return res.json(rows[0])
  } catch (err) {
    console.error('%s PUT /:id ERROR', LOG_PREFIX)
    return res.status(500).json({ error: err.message })
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
    await syncImportStockFinancials(req.params.id, userId)
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
    await syncImportStockFinancials(req.params.id, userId)
    await clearImportStockCache(userId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getImportUnitLabel(item, importedQty) {
  if (Number(item.bag_weight || 1) > 1) {
    return importedQty === 1 ? 'Bag' : 'Bags'
  }
  return item.unit || 'pcs'
}

async function updateExistingProductFromImport(existingProduct, item, userId, dateStr, looseKg, priceCovers) {
  const targetId = existingProduct.id
  const prevP = existingProduct.updated_price || existingProduct.price
  const newP = item.updated_price || item.price
  const currentStock = Number.parseFloat(existingProduct.stock || 0)
  const importedQty = Number.parseFloat(item.stock || 0)
  const newStock = currentStock + importedQty
  const unitLabel = getImportUnitLabel(item, importedQty)

  await query(
    `UPDATE products SET stock = stock + $1, loose_kg = COALESCE(loose_kg, 0) + $2, price = $3, price_covers = $4, updated_price = $5, updated_price_date = $6, bag_weight = $7, status = 'active', updated_at = NOW() WHERE id = $8`,
    [item.stock, looseKg, item.price, priceCovers, item.updated_price || null, dateStr, item.bag_weight || 1, targetId]
  )

  const historyPromises = [
    query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [targetId, userId, prevP, newP, dateStr, 'Import Stock Restock']
    ).catch(() => {})
  ]

  if (importedQty > 0) {
    const supplierSuffix = item.buyer_name ? ` (Supplier: ${item.buyer_name})` : ''
    historyPromises.push(
      query(
        `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
         VALUES ($1, $2, 'added', $3, $4, $5, 'Stock Import', $6, NOW())`,
        [
          targetId, userId, importedQty, currentStock, newStock,
          `Restocked +${importedQty} ${unitLabel} via Stock Import${supplierSuffix}`
        ]
      ).catch(() => {})
    )
  }

  Promise.all(historyPromises).catch(() => {})
  return targetId
}

async function insertNewProductFromImport(item, userId, dateStr, looseKg, priceCovers) {
  const creatorName = item.created_by_name || 'Admin'
  const creatorEmail = item.created_by_email || ''
  const creatorRole = item.created_by_role?.toLowerCase() === 'member' ? 'Member' : 'Admin'

  const newProd = await query(
    `INSERT INTO products (name, sku, category, price, price_covers, updated_price, updated_price_date, stock, loose_kg, unit, status, description, user_id, bag_weight, created_by_name, created_by_email, created_by_role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, $15, $16, NOW(), NOW()) RETURNING id`,
    [
      item.name, item.sku, item.category, item.price, priceCovers,
      item.updated_price || null, dateStr, item.stock, looseKg,
      item.unit || 'pcs', item.description, userId, item.bag_weight || 1,
      creatorName, creatorEmail, creatorRole
    ]
  )
  const targetId = newProd.rows[0].id
  const importedQty = Number.parseFloat(item.stock || 0)
  const unitLabel = getImportUnitLabel(item, importedQty)

  const historyPromises = [
    query(
      `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
       VALUES ($1, $2, NULL, $3, NOW(), 'Initial Base Price', NOW())`,
      [targetId, userId, item.price]
    ).catch(() => {})
  ]

  if (item.updated_price) {
    historyPromises.push(
      query(
        `INSERT INTO product_price_history (product_id, user_id, old_price, new_price, effective_date, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Updated Price', NOW())`,
        [targetId, userId, item.price, item.updated_price, dateStr]
      ).catch(() => {})
    )
  }

  if (importedQty > 0) {
    const supplierSuffix = item.buyer_name ? ` (Supplier: ${item.buyer_name})` : ''
    historyPromises.push(
      query(
        `INSERT INTO product_stock_history (product_id, user_id, change_type, qty_change, stock_before, stock_after, source, notes, created_at)
         VALUES ($1, $2, 'added', $3, 0, $4, 'Stock Import', $5, NOW())`,
        [
          targetId, userId, importedQty, importedQty,
          `Initial imported stock of ${importedQty} ${unitLabel} from Stock Import${supplierSuffix}`
        ]
      ).catch(() => {})
    )
  }

  Promise.all(historyPromises).catch(() => {})
  return targetId
}

async function syncOrInsertProductFromImportItem(item, userId) {
  const existing = await query(
    `SELECT id, price, updated_price, stock FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
    [userId, item.sku || 'N/A', item.name]
  )

  const dateStr = item.updated_price_date || new Date().toISOString().split('T')[0]
  const looseKg = Number.parseFloat(item.loose_kg || 0)
  const priceCovers = item.price_covers ? Number.parseFloat(item.price_covers) : null

  if (existing.rows.length > 0) {
    return updateExistingProductFromImport(existing.rows[0], item, userId, dateStr, looseKg, priceCovers)
  }

  return insertNewProductFromImport(item, userId, dateStr, looseKg, priceCovers)
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
    await Promise.all(importRows.map(item => syncOrInsertProductFromImportItem(item, userId)))

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
