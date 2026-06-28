import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* Ensure table exists with user_id */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS people (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      email        TEXT,
      phone        TEXT,
      persona      TEXT DEFAULT 'Lead',
      status       TEXT DEFAULT 'active',
      notes        TEXT,
      user_id      TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id TEXT`).catch(() => {})
}
ensureTable().catch(console.error)

/* GET /api/people */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { search } = req.query
  const params = [userId]
  const conditions = ['user_id = $1']
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`)
  }
  const where = `WHERE ${conditions.join(' AND ')}`
  try {
    const { rows } = await query(
      `SELECT * FROM people ${where} ORDER BY created_at DESC`,
      params
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/people */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, persona, status, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    const { rows } = await query(
      `INSERT INTO people (name, email, phone, persona, status, notes, user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [name, email || '', phone || '', persona || 'Lead', status || 'active', notes || '', userId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/people/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query('SELECT * FROM people WHERE id = $1 AND user_id = $2', [req.params.id, userId])
    if (!rows.length) return res.status(404).json({ error: 'Person not found' })
    res.json({ data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/people/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, persona, status, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    const { rows } = await query(
      `UPDATE people SET name=$1, email=$2, phone=$3, persona=$4, status=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND user_id = $8 RETURNING *`,
      [name, email || '', phone || '', persona || 'Lead', status || 'active', notes || '', req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Person not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/people/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query('DELETE FROM people WHERE id=$1 AND user_id = $2', [req.params.id, userId])
    res.json({ message: 'Person deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
