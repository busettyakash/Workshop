import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* Ensure bill_templates table */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS bill_templates (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        VARCHAR(255) NOT NULL,
      html        TEXT NOT NULL,
      is_default  BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
}
ensureTable()

/* GET /api/bill-templates */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT id, name, is_default, created_at FROM bill_templates WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    res.json({ data: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/bill-templates/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT * FROM bill_templates WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Template not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/bill-templates/default/active */
router.get('/default/active', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT * FROM bill_templates WHERE user_id = $1 AND is_default = true LIMIT 1`,
      [userId]
    )
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/bill-templates */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, html, is_default } = req.body
  if (!name || !html) return res.status(400).json({ error: 'name and html are required' })

  try {
    // If setting as default, unset others
    if (is_default) {
      await query(`UPDATE bill_templates SET is_default = false WHERE user_id = $1`, [userId])
    }
    const { rows } = await query(
      `INSERT INTO bill_templates (user_id, name, html, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [userId, name, html, is_default || false]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/bill-templates/:id/set-default */
router.patch('/:id/set-default', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query(`UPDATE bill_templates SET is_default = false WHERE user_id = $1`, [userId])
    const { rows } = await query(
      `UPDATE bill_templates SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Template not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/bill-templates/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query(`DELETE FROM bill_templates WHERE id = $1 AND user_id = $2`, [req.params.id, userId])
    res.json({ message: 'Template deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
