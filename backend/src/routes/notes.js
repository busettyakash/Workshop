import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { apiLimiter } from '../middleware/rateLimit.js'

const router = Router()
router.use(apiLimiter)
router.use(requireAuth)

const clearNotesCache = async (userId) => {
  try {
    const keys = await redis.keys(`notes:${userId}:*`).catch(() => [])
    for (const key of keys) {
      await redis.del(key).catch(() => {})
    }
  } catch (err) {
    console.error('[Notes Cache Invalidation Error]', err.message)
  }
}

/* Ensure table exists */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS notes (
      id               SERIAL PRIMARY KEY,
      title            TEXT NOT NULL,
      body             TEXT DEFAULT '',
      attachment_name  TEXT,
      attachment_data  TEXT,
      user_id          TEXT NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id)`).catch(() => {})
  // Alter to add attachment columns if they don't exist yet
  await query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS attachment_name TEXT`).catch(() => {})
  await query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS attachment_data TEXT`).catch(() => {})
}
ensureTable().catch(console.error)

/* GET /api/notes */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { search } = req.query
  const params = [userId]
  let where = 'WHERE user_id = $1'

  if (search) {
    params.push(`%${search}%`)
    where += ` AND (title ILIKE $${params.length} OR body ILIKE $${params.length})`
  }

  const cacheKey = `notes:${userId}:${search || ''}`
  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) {
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached)
    }
  } catch (cErr) {
    console.error('[Notes Cache Read Error]', cErr.message)
  }

  try {
    const { rows } = await query(
      `SELECT * FROM notes ${where} ORDER BY updated_at DESC`,
      params
    )
    const resultPayload = { data: rows, total: rows.length }
    try {
      await redis.set(cacheKey, JSON.stringify(resultPayload), { ex: 300 }).catch(() => {})
    } catch (cErr) {
      console.error('[Notes Cache Write Error]', cErr.message)
    }
    res.json(resultPayload)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/notes/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Note not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/notes */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { title, body = '', attachment_name = null, attachment_data = null } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
  try {
    const { rows } = await query(
      `INSERT INTO notes (title, body, attachment_name, attachment_data, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [title.trim(), body, attachment_name, attachment_data, userId]
    )
    await clearNotesCache(userId)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/notes/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { title, body = '', attachment_name = null, attachment_data = null } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
  try {
    const { rows } = await query(
      `UPDATE notes SET title=$1, body=$2, attachment_name=$3, attachment_data=$4, updated_at=NOW()
       WHERE id=$5 AND user_id=$6 RETURNING *`,
      [title.trim(), body, attachment_name, attachment_data, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Note not found' })
    await clearNotesCache(userId)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/notes/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rowCount } = await query(
      'DELETE FROM notes WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'Note not found' })
    await clearNotesCache(userId)
    res.json({ success: true, message: 'Note deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
