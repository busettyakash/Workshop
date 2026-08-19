import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimit.js'

const router = Router()
router.use(requireAuth)
router.use(apiLimiter)

let ensureUomsTablePromise

async function ensureUomsTable() {
  if (!ensureUomsTablePromise) {
    ensureUomsTablePromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS uoms (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          code VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          category VARCHAR(50) DEFAULT 'Count',
          is_bulk BOOLEAN DEFAULT false,
          presets TEXT DEFAULT '1',
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
    })().catch((err) => {
      ensureUomsTablePromise = null
      throw err
    })
  }

  return ensureUomsTablePromise
}

/* GET /api/uoms - List UOMs created for the workspace */
router.get('/', async (req, res) => {
  const workspaceId = req.workspaceId || req.user?.id || '00000000-0000-0000-0000-000000000000'
  const userId = req.user?.id || workspaceId
  try {
    await ensureUomsTable()
    const { rows } = await query(
      "SELECT * FROM uoms WHERE user_id::text = $1 OR user_id::text = $2 OR user_id::text = 'default-user' OR user_id IS NULL ORDER BY id ASC",
      [String(workspaceId), String(userId)]
    )
    res.json(rows)
  } catch (err) {
    console.error('[GET /api/uoms Error]', err)
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/uoms/all - Clear all UOMs */
router.delete('/all', async (req, res) => {
  const workspaceId = req.workspaceId || req.user?.id || '00000000-0000-0000-0000-000000000000'
  const userId = req.user?.id || workspaceId
  try {
    await ensureUomsTable()
    await query(
      "DELETE FROM uoms WHERE user_id::text = $1 OR user_id::text = $2 OR user_id::text = 'default-user' OR user_id IS NULL",
      [String(workspaceId), String(userId)]
    )
    res.json({ message: 'All UOMs cleared' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/uoms - Create UOM */
router.post('/', async (req, res) => {
  const userId = req.workspaceId || req.user?.id || '00000000-0000-0000-0000-000000000000'
  const { code, name, category, is_bulk, presets, status } = req.body
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' })

  try {
    await ensureUomsTable()
    const { rows } = await query(
      `INSERT INTO uoms (user_id, code, name, category, is_bulk, presets, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [String(userId), code.toLowerCase().trim(), name.trim(), category || 'Count', Boolean(is_bulk), presets || '1', status || 'Active']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('[POST /api/uoms Error]', err)
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/uoms/:id - Update UOM */
router.put('/:id', async (req, res) => {
  const workspaceId = req.workspaceId || req.user?.id || '00000000-0000-0000-0000-000000000000'
  const userId = req.user?.id || workspaceId
  const { code, name, category, is_bulk, presets, status } = req.body
  try {
    await ensureUomsTable()
    const { rows } = await query(
      `UPDATE uoms SET code=$1, name=$2, category=$3, is_bulk=$4, presets=$5, status=$6, updated_at=NOW()
       WHERE id=$7 AND (user_id::text=$8 OR user_id::text=$9 OR user_id::text='default-user' OR user_id IS NULL) RETURNING *`,
      [code.toLowerCase().trim(), name.trim(), category, Boolean(is_bulk), presets, status, req.params.id, String(workspaceId), String(userId)]
    )
    if (!rows.length) return res.status(404).json({ error: 'UOM not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/uoms/:id - Delete UOM */
router.delete('/:id', async (req, res) => {
  const workspaceId = req.workspaceId || req.user?.id || '00000000-0000-0000-0000-000000000000'
  const userId = req.user?.id || workspaceId
  try {
    await ensureUomsTable()
    await query(
      "DELETE FROM uoms WHERE id = $1 AND (user_id::text = $2 OR user_id::text = $3 OR user_id::text = 'default-user' OR user_id IS NULL)",
      [req.params.id, String(workspaceId), String(userId)]
    )
    res.json({ message: 'UOM deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
