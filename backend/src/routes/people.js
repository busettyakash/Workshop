import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

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
  await query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS company TEXT`).catch(() => {})
  await query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS company_name TEXT`).catch(() => {})
}

let ensureTablePromise
router.use(async (_req, _res, next) => {
  try {
    ensureTablePromise ||= ensureTable().catch((err) => {
      ensureTablePromise = null
      throw err
    })
    await ensureTablePromise
    next()
  } catch (err) {
    next(err)
  }
})

async function clearPeopleCache(userId) {
  try {
    const keys = await redis.keys(`people:${userId}:*`).catch(() => [])
    for (const k of keys) { await redis.del(k).catch(() => {}) }
  } catch (_e) {}
}

/* GET /api/people */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search = '', status = '', persona = '', sort = '' } = req.query

  const params = [userId]
  const conditions = ['user_id = $1']
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length} OR company_name ILIKE $${params.length})`)
  }
  if (status && status !== 'all') {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }
  if (persona && persona !== 'all') {
    params.push(persona)
    conditions.push(`persona = $${params.length}`)
  }

  let orderCol = 'created_at DESC, id DESC'
  if (sort === 'name_asc') orderCol = 'name ASC, id DESC'
  else if (sort === 'name_desc') orderCol = 'name DESC, id DESC'

  try {
    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
      const { rows } = await query(
        `SELECT * FROM people ${where} ORDER BY ${orderCol} LIMIT $${params.length}`,
        params
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
        : null

      const responsePayload = { data: rows, limit, hasNextPage, nextCursor }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return res.json(responsePayload)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const countRes = await query(`SELECT COUNT(*) FROM people ${where}`, params)
    const total = Number.parseInt(countRes.rows[0].count, 10)
    const totalPages = Math.ceil(total / limit) || 1

    params.push(limit, offset)
    const { rows } = await query(
      `SELECT * FROM people ${where} ORDER BY ${orderCol} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const responsePayload = { data: rows, total, page, limit, totalPages }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.json(responsePayload)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/people */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, persona, status, notes, company, company_name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const compVal = company || company_name || ''
  try {
    const { rows } = await query(
      `INSERT INTO people (name, email, phone, persona, status, notes, company, company_name, user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      [name, email || '', phone || '', persona || 'Lead', status || 'active', notes || '', compVal, compVal, userId]
    )
    clearPeopleCache(userId)
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
  const { name, email, phone, persona, status, notes, company, company_name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const compVal = company || company_name || ''
  try {
    const { rows } = await query(
      `UPDATE people SET name=$1, email=$2, phone=$3, persona=$4, status=$5, notes=$6, company=$7, company_name=$8, updated_at=NOW()
       WHERE id=$9 AND user_id = $10 RETURNING *`,
      [name, email || '', phone || '', persona || 'Lead', status || 'active', notes || '', compVal, compVal, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Person not found' })
    clearPeopleCache(userId)
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
    clearPeopleCache(userId)
    res.json({ message: 'Person deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
