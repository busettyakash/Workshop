import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* Ensure table exists */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS deals (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      value       NUMERIC(12,2) DEFAULT 0,
      stage       TEXT DEFAULT 'Discovery',
      owner       TEXT,
      close_date  DATE,
      notes       TEXT,
      status      TEXT DEFAULT 'active',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS deal_logs (
      id          SERIAL PRIMARY KEY,
      deal_id     INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      deal_title  TEXT,
      event       TEXT NOT NULL,
      from_value  TEXT,
      to_value    TEXT,
      done_by     TEXT DEFAULT 'System',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}
ensureTable().catch(console.error)

/* GET /api/deals */
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM deals ORDER BY created_at DESC`
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/deals */
router.post('/', async (req, res) => {
  const { title, value, stage, owner, close_date, notes } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })
  try {
    const { rows } = await query(
      `INSERT INTO deals (title, value, stage, owner, close_date, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
      [title, value || 0, stage || 'Discovery', owner || '', close_date || null, notes || '']
    )
    // Log creation
    await query(
      `INSERT INTO deal_logs (deal_id, deal_title, event, done_by) VALUES ($1,$2,$3,$4)`,
      [rows[0].id, title, 'Deal created', owner || 'System']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/deals/:id */
router.put('/:id', async (req, res) => {
  const { title, value, stage, owner, close_date, notes, status } = req.body
  try {
    const prev = await query('SELECT * FROM deals WHERE id=$1', [req.params.id])
    const old = prev.rows[0]
    const { rows } = await query(
      `UPDATE deals SET title=$1,value=$2,stage=$3,owner=$4,close_date=$5,notes=$6,status=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, value, stage, owner, close_date || null, notes, status || 'active', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' })
    // Log stage change
    if (old && old.stage !== stage) {
      await query(
        `INSERT INTO deal_logs (deal_id, deal_title, event, from_value, to_value, done_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.id, title, 'Stage changed', old.stage, stage, owner || 'System']
      )
    }
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/deals/:id */
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM deals WHERE id=$1', [req.params.id])
    res.json({ message: 'Deal deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/deals/logs */
router.get('/logs', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM deal_logs ORDER BY created_at DESC LIMIT 100`
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
