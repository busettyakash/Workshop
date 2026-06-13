import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

/* GET /api/import-stock */
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM import_stock ORDER BY created_at DESC"
    )
    res.json({ data: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/import-stock/:id */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM import_stock WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Import stock not found' })
    res.json({ data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock */
router.post('/', async (req, res) => {
  const { name, sku, category, price, stock, status, unit, description } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' })
  try {
    const { rows } = await query(
      `INSERT INTO import_stock (name, sku, category, price, stock, status, unit, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [name, sku, category, price, stock || 0, status || 'pending', unit || 'pcs', description]
    )
    await redis.del('import_stock:all').catch(() => {})
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/import-stock/:id */
router.put('/:id', async (req, res) => {
  const { name, sku, category, price, stock, status, unit, description } = req.body
  try {
    const { rows } = await query(
      `UPDATE import_stock SET name=$1, sku=$2, category=$3, price=$4, stock=$5, status=$6, unit=$7, description=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, sku, category, price, stock, status || 'pending', unit || 'pcs', description, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Import stock not found' })
    await redis.del('import_stock:all').catch(() => {})
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/bulk-add-to-products */
router.post('/bulk-add-to-products', async (req, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' })
  }
  try {
    // 1. Get the import_stock items that are not already added
    const { rows: importRows } = await query("SELECT * FROM import_stock WHERE id = ANY($1::int[]) AND status != 'added'", [ids])
    if (!importRows.length) {
      return res.status(400).json({ error: 'No valid pending import stock found for the provided IDs' })
    }

    // 2. Insert each into products
    for (const item of importRows) {
      await query(
        `INSERT INTO products (name, sku, category, price, stock, unit, status, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW(), NOW())`,
        [item.name, item.sku, item.category, item.price, item.stock, item.unit || 'pcs', item.description]
      )
    }

    // 3. Update status in import_stock for these items to 'added'
    const { rows } = await query("UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = ANY($1::int[]) RETURNING *", [ids])

    // 4. Invalidate cache
    await redis.del('import_stock:all').catch(() => {})

    res.json({ message: `${importRows.length} products added successfully`, data: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/import-stock/:id/add-to-products */
router.post('/:id/add-to-products', async (req, res) => {
  try {
    // 1. Get the import_stock item
    const { rows: importRows } = await query('SELECT * FROM import_stock WHERE id = $1', [req.params.id])
    if (!importRows.length) return res.status(404).json({ error: 'Pending import stock not found' })
    const item = importRows[0]
    
    if (item.status === 'added') {
      return res.status(400).json({ error: 'Product is already added' })
    }

    // 2. Insert into products
    await query(
      `INSERT INTO products (name, sku, category, price, stock, unit, status, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW(), NOW())`,
      [item.name, item.sku, item.category, item.price, item.stock, item.unit || 'pcs', item.description]
    )

    // 3. Update import_stock status to 'added'
    const { rows } = await query("UPDATE import_stock SET status = 'added', updated_at = NOW() WHERE id = $1 RETURNING *", [req.params.id])

    // 4. Invalidate caches
    await redis.del('import_stock:all').catch(() => {})

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/import-stock/:id */
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM import_stock WHERE id = $1', [req.params.id])
    await redis.del('import_stock:all').catch(() => {})
    res.json({ message: 'Import stock deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
