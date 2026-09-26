import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { getCached, setCached, deleteCachedPattern, clearMemoryCachePrefix } from '../lib/fastCache.js'

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
    );
    ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id TEXT;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS company TEXT;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE people ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);
    ALTER TABLE people ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
    ALTER TABLE people ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(50);
  `).catch(() => {})
}

let ensureTablePromise
router.use((_req, _res, next) => {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureTable().catch((err) => {
      ensureTablePromise = null
      console.warn('[People Table Warning]', err.message)
    })
  }
  next()
})

export async function clearPeopleCache(userId) {
  try {
    clearMemoryCachePrefix(`people:${userId}:`)
    await deleteCachedPattern(redis, `people:${userId}:*`).catch(() => {})
  } catch (_e) {
    // Intentionally ignored: cache invalidation failure should not block operations
  }
}



/* GET /api/people */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search = '', status = '', persona = '', sort = '', _t } = req.query

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

  // Skip cache when _t (cache-bust) param is present — always serve fresh DB data
  const cacheKey = _t ? null : `people:${userId}:${JSON.stringify({ page, limit, offset, cursor, search, status, persona, sort })}`

  try {
    if (cacheKey) {
      const cached = await getCached(redis, cacheKey, 200)
      if (cached) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        return res.json(cached)
      }
    }

    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
      const { rows } = await query(
        `SELECT people.*, 
           COALESCE(
             NULLIF(TRIM(people.created_by_name), 'Admin'),
             (SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') FROM shop_profiles WHERE user_id::text = people.user_id::text LIMIT 1),
             (SELECT shop_name FROM shop_profiles WHERE user_id::text = people.user_id::text LIMIT 1),
             'Admin'
           ) AS created_by_name, 
            CASE WHEN people.created_by_role ILIKE 'member' THEN 'Member' ELSE 'Admin' END AS created_by_role 
         FROM people ${where} ORDER BY ${orderCol} LIMIT $${params.length}`,
        params
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
        : null

      const result = { data: rows, limit, hasNextPage, nextCursor }
      if (cacheKey) setCached(redis, cacheKey, result, 60)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return res.json(result)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const queryParams = [...params, limit, offset]
    const { rows: rawRows } = await query(
      `SELECT people.*, 
         COALESCE(
           NULLIF(TRIM(people.created_by_name), 'Admin'),
           (SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') FROM shop_profiles WHERE user_id::text = people.user_id::text LIMIT 1),
           (SELECT shop_name FROM shop_profiles WHERE user_id::text = people.user_id::text LIMIT 1),
           'Admin'
         ) AS created_by_name, 
          CASE WHEN people.created_by_role ILIKE 'member' THEN 'Member' ELSE 'Admin' END AS created_by_role, 
         COUNT(*) OVER() AS _total_count 
       FROM people ${where} ORDER BY ${orderCol} LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    )

    const total = rawRows.length > 0 ? Number.parseInt(rawRows[0]._total_count, 10) : 0
    const rows = rawRows.map(r => { const { _total_count, ...rest } = r; return rest })
    const totalPages = Math.ceil(total / limit) || 1

    const result = { data: rows, total, page, limit, totalPages }
    if (cacheKey) setCached(redis, cacheKey, result, 60)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/* POST /api/people */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, persona, status, notes, company, company_name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const compVal = company || company_name || ''
  const creatorName = (req.user?.firstName || req.user?.first_name)
    ? `${req.user.firstName || req.user.first_name} ${req.user?.lastName || req.user?.last_name || ''}`.trim()
    : (req.user?.shopName || req.user?.email?.split('@')[0] || 'Admin')
  const creatorEmail = req.user?.email || ''
  const creatorRole = req.memberRole?.toLowerCase() === 'member' ? 'Member' : 'Admin'
  try {
    const { rows } = await query(
      `INSERT INTO people (name, email, phone, persona, status, notes, company, company_name, user_id, created_by_name, created_by_email, created_by_role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`,
      [name, email || '', phone || '', persona || 'Lead', status || 'active', notes || '', compVal, compVal, userId, creatorName, creatorEmail, creatorRole]
    )
    await clearPeopleCache(userId)
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
    await clearPeopleCache(userId)
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
    await clearPeopleCache(userId)
    res.json({ message: 'Person deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
