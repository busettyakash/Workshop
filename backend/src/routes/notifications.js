import { Router } from 'express'
import { query } from '../lib/db.js'
import insforge from '../lib/insforge.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* Ensure table has link column */
const ensureTable = async () => {
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT`).catch(() => {})
}
ensureTable().catch(console.error)

/* GET /api/notifications */
router.get('/', async (req, res) => {
  const { unread } = req.query
  try {
    const where = unread === 'true' ? `WHERE user_id=$1 AND read=false` : `WHERE user_id=$1`
    const { rows } = await query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
      [req.workspaceId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/notifications — create (admin/system use) */
router.post('/', async (req, res) => {
  const { user_id, title, body, type = 'info' } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, title, body, type, read, created_at)
       VALUES ($1,$2,$3,$4,false,NOW()) RETURNING *`,
      [user_id || req.workspaceId, title, body, type]
    )
    // Optionally push via InsForge realtime
    try {
      await insforge.realtime.publish(`notifications:${user_id || req.workspaceId}`, {
        event: 'new_notification',
        payload: rows[0],
      })
    } catch (_) {}

    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/notifications/:id/read */
router.patch('/:id/read', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.workspaceId]
    )
    res.json({ message: 'Marked as read' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/notifications/read-all */
router.patch('/read-all', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET read=true WHERE user_id=$1`,
      [req.workspaceId]
    )
    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
