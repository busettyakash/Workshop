import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

const LOG_PREFIX = '[ImportStock]'

/* GET /api/import-stock */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  console.log(`${LOG_PREFIX} GET / — userId: ${userId}`)
  try {
    const { rows } = await query(
      `SELECT i.*, 
        CASE 
          WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock)
          ELSE i.stock
        END AS stock 
       FROM import_stock i
       LEFT JOIN LATERAL (
         SELECT stock FROM products 
         WHERE user_id = i.user_id AND (sku = i.sku OR name = i.name) 
         ORDER BY created_at DESC LIMIT 1
       ) p ON true
       WHERE i.user_id = $1 
       ORDER BY i.created_at DESC`,
      [userId]
    )
    console.log(`${LOG_PREFIX} GET / — returned ${rows.length} rows`)
    res.json({ data: rows })
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
      `SELECT i.id, i.status, i.created_at, i.updated_at, i.user_id,
        CASE WHEN i.status = 'added' THEN COALESCE(p.name, i.name) ELSE i.name END AS name,
        CASE WHEN i.status = 'added' THEN COALESCE(p.sku, i.sku) ELSE i.sku END AS sku,
        CASE WHEN i.status = 'added' THEN COALESCE(p.category, i.category) ELSE i.category END AS category,
        CASE WHEN i.status = 'added' THEN COALESCE(p.price, i.price) ELSE i.price END AS price,
        CASE WHEN i.status = 'added' THEN COALESCE(p.stock, i.stock) ELSE i.stock END AS stock,
        CASE WHEN i.status = 'added' THEN COALESCE(p.unit, i.unit) ELSE i.unit END AS unit,
        CASE WHEN i.status = 'added' THEN COALESCE(p.description, i.description) ELSE i.description END AS description
       FROM import_stock i
       LEFT JOIN LATERAL (
         SELECT name, sku, category, price, stock, unit, description 
         FROM products 
         WHERE user_id = i.user_id AND (sku = i.sku OR name = i.name) 
         ORDER BY created_at DESC LIMIT 1
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
    console.error(`${LOG_PREFIX} GET /${req.params.id} — ERROR:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, sku, category, price, stock, status, unit, description } = req.body
  console.log(`${LOG_PREFIX} POST / — userId: ${userId}, name: ${name}, price: ${price}`)
  if (!name || !price) {
    console.warn(`${LOG_PREFIX} POST / — VALIDATION FAILED: name=${name}, price=${price}`)
    return res.status(400).json({ error: 'name and price are required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO import_stock (name, sku, category, price, stock, status, unit, description, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [name, sku, category, price, stock || 0, status || 'pending', unit || 'pcs', description, userId]
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
  const { name, sku, category, price, stock, status, unit, description } = req.body
  console.log(`${LOG_PREFIX} PUT /${req.params.id} — userId: ${userId}, name: ${name}`)
  try {
    const oldImport = await query('SELECT sku, name FROM import_stock WHERE id = $1 AND user_id = $2', [req.params.id, userId]);

    const { rows } = await query(
      `UPDATE import_stock SET name=$1, sku=$2, category=$3, price=$4, stock=$5, status=$6, unit=$7, description=$8, updated_at=NOW()
       WHERE id=$9 AND user_id = $10 RETURNING *`,
      [name, sku, category, price, stock, status || 'pending', unit || 'pcs', description, req.params.id, userId]
    )
    if (!rows.length) {
      console.warn(`${LOG_PREFIX} PUT /${req.params.id} — NOT FOUND`)
      return res.status(404).json({ error: 'Import stock not found' })
    }

    if (oldImport.rows.length > 0) {
      const old = oldImport.rows[0];
      await query(
        `UPDATE products SET name=$1, sku=$2, category=$3, price=$4, unit=$5, description=$6, updated_at=NOW()
         WHERE user_id=$7 AND (sku=$8 OR name=$9)`,
        [name, sku, category, price, unit || 'pcs', description, userId, old.sku || 'N/A', old.name]
      );
    }

    console.log(`${LOG_PREFIX} PUT /${req.params.id} — SUCCESS`)
    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn(`${LOG_PREFIX} PUT / — Redis cache clear failed:`, e.message)
    })
    res.json(rows[0])
  } catch (err) {
    console.error(`${LOG_PREFIX} PUT /${req.params.id} — ERROR:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/bulk-add-to-products */
router.post('/bulk-add-to-products', async (req, res) => {
  const userId = req.workspaceId
  const { ids } = req.body
  console.log(`${LOG_PREFIX} POST /bulk-add-to-products — userId: ${userId}, ids:`, ids)
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
        `SELECT id FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
        [userId, item.sku || 'N/A', item.name]
      )

      if (existing.rows.length > 0) {
        // Restock existing product and set status to active
        await query(
          `UPDATE products SET stock = stock + $1, price = $2, status = 'active', updated_at = NOW() WHERE id = $3`,
          [item.stock, item.price, existing.rows[0].id]
        )
      } else {
        // Insert new product
        await query(
          `INSERT INTO products (name, sku, category, price, stock, unit, status, description, user_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(), NOW())`,
          [item.name, item.sku, item.category, item.price, item.stock, item.unit || 'pcs', item.description, userId]
        )
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
    console.error(`${LOG_PREFIX} POST /bulk-add-to-products — ERROR:`, err.message)
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
      `SELECT id FROM products WHERE user_id = $1 AND (sku = $2 OR name = $3) LIMIT 1`,
      [userId, item.sku || 'N/A', item.name]
    )

    if (existing.rows.length > 0) {
      // Restock existing product and set status to active
      await query(
        `UPDATE products SET stock = stock + $1, price = $2, status = 'active', updated_at = NOW() WHERE id = $3`,
        [item.stock, item.price, existing.rows[0].id]
      )
    } else {
      // Insert new product
      await query(
        `INSERT INTO products (name, sku, category, price, stock, unit, status, description, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(), NOW())`,
        [item.name, item.sku, item.category, item.price, item.stock, item.unit || 'pcs', item.description, userId]
      )
    }

    const { rows } = await query(
      "UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, userId]
    )

    await redis.del(`import_stock:${userId}`).catch((e) => {
      console.warn(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — Redis cache clear failed:`, e.message)
    })

    console.log(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — SUCCESS`)
    res.json(rows[0])
  } catch (err) {
    console.error(`${LOG_PREFIX} POST /${req.params.id}/add-to-products — ERROR:`, err.message)
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
      console.warn(`${LOG_PREFIX} DELETE /${req.params.id} — Redis cache clear failed:`, e.message)
    })
    console.log(`${LOG_PREFIX} DELETE /${req.params.id} — SUCCESS`)
    res.json({ message: 'Import stock deleted' })
  } catch (err) {
    console.error(`${LOG_PREFIX} DELETE /${req.params.id} — ERROR:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
