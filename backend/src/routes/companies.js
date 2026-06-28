import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* GET /api/companies - list all shop profiles as companies */
router.get('/', async (req, res) => {
  const { search } = req.query
  const params = []
  let conditions = []
  
  params.push(req.workspaceId)
  conditions.push(`user_id::text != $${params.length}`)
  
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(shop_name ILIKE $${params.length} OR email ILIKE $${params.length})`)
  }
  
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  
  try {
    const { rows } = await query(
      `SELECT user_id AS id, shop_name AS name, email, phone, gstin 
       FROM shop_profiles 
       ${where}
       ORDER BY shop_name ASC`,
      params
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/companies/:id - get specific shop profile details */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT user_id AS id, shop_name AS name, email, phone, gstin 
       FROM shop_profiles 
       WHERE user_id::text = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Company not found' })
    res.json({ data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST, PUT, DELETE are disabled for shop_profiles via companies router */
router.post('/', (req, res) => {
  res.status(405).json({ error: 'Manual company creation is disabled. Workshop companies are retrieved automatically from registered profiles.' })
})

router.put('/:id', (req, res) => {
  res.status(405).json({ error: 'Manual company updates are disabled. Workshop companies are updated via user profile/settings.' })
})

router.delete('/:id', (req, res) => {
  res.status(405).json({ error: 'Manual company deletion is disabled.' })
})

export default router
