import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Initialize uoms table
query(`
  CREATE TABLE IF NOT EXISTS uoms (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'Count',
    is_bulk BOOLEAN DEFAULT false,
    presets TEXT DEFAULT '1',
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`).catch((err) => {
  console.error('[DB] uoms table creation warning:', err.message)
})

const DEFAULT_UOMS = [
  { code: 'pcs', name: 'Pieces', category: 'Count', is_bulk: false, presets: '1' },
  { code: 'box', name: 'Box / Pack', category: 'Package', is_bulk: true, presets: '10, 24, 50, 100' },
  { code: 'kgs', name: 'Kilograms', category: 'Weight', is_bulk: true, presets: '1, 5, 10, 25, 50, 1000' },
  { code: 'mtr', name: 'Meters', category: 'Length', is_bulk: true, presets: '1, 10, 25, 50, 100' },
  { code: 'ltr', name: 'Liters', category: 'Volume', is_bulk: true, presets: '1, 5, 20, 25, 50, 200' },
  { code: 'doz', name: 'Dozen', category: 'Count', is_bulk: true, presets: '12, 60' },
  { code: 'g',   name: 'Grams', category: 'Weight', is_bulk: false, presets: '100, 250, 500' },
  { code: 'ml',  name: 'Milliliters', category: 'Volume', is_bulk: false, presets: '250, 500, 750' },
  { code: 'ft',  name: 'Feet', category: 'Length', is_bulk: true, presets: '10, 20, 50' },
]

async function seedDefaultUoms(userId) {
  try {
    const { rows } = await query('SELECT COUNT(*) FROM uoms WHERE user_id = $1', [userId])
    if (parseInt(rows[0].count) === 0) {
      for (const u of DEFAULT_UOMS) {
        await query(
          `INSERT INTO uoms (user_id, code, name, category, is_bulk, presets, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'Active') ON CONFLICT DO NOTHING`,
          [userId, u.code, u.name, u.category, u.is_bulk, u.presets]
        )
      }
    }
  } catch (err) {
    console.error('[DB Seed UOMs Warning]', err.message)
  }
}

/* GET /api/uoms - List UOMs */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  try {
    await seedDefaultUoms(userId)
    const { rows } = await query('SELECT * FROM uoms WHERE user_id = $1 ORDER BY id ASC', [userId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/uoms - Create UOM */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { code, name, category, is_bulk, presets, status } = req.body
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' })

  try {
    const { rows } = await query(
      `INSERT INTO uoms (user_id, code, name, category, is_bulk, presets, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [userId, code.toLowerCase().trim(), name.trim(), category || 'Count', Boolean(is_bulk), presets || '1', status || 'Active']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/uoms/:id - Update UOM */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { code, name, category, is_bulk, presets, status } = req.body
  try {
    const { rows } = await query(
      `UPDATE uoms SET code=$1, name=$2, category=$3, is_bulk=$4, presets=$5, status=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [code.toLowerCase().trim(), name.trim(), category, Boolean(is_bulk), presets, status, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'UOM not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/uoms/:id - Delete UOM */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query('DELETE FROM uoms WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    res.json({ message: 'UOM deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
