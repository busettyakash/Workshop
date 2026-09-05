import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)



import { parsePaginationParams, encodeCursor } from '../utils/pagination.js'

/* GET /api/customers */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { page, limit, offset, cursor } = parsePaginationParams(req.query, 20)
  const { search } = req.query

  const params = [userId]
  const conditions = ['user_id = $1']
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`)
  }

  try {
    if (cursor) {
      if (cursor.created_at && cursor.id) {
        params.push(cursor.created_at, cursor.id)
        conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      params.push(limit + 1)
      const { rows } = await query(
        `SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
        params
      )
      const hasNextPage = rows.length > limit
      if (hasNextPage) rows.pop()
      const nextCursor = (hasNextPage && rows.length > 0)
        ? encodeCursor({ created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id })
        : null

      return res.json({ data: rows, limit, hasNextPage, nextCursor })
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const count = await query(`SELECT COUNT(*) FROM customers ${where}`, params)
    const total = Number.parseInt(count.rows[0].count, 10) || 0
    const totalPages = Math.ceil(total / limit) || 1

    params.push(limit, offset)
    const { rows } = await query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const hasNextPage = page < totalPages
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
    const nextCursor = (hasNextPage && lastRow)
      ? encodeCursor({ created_at: lastRow.created_at, id: lastRow.id })
      : null

    res.json({
      data: rows,
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      nextCursor
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/customers/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query('SELECT * FROM customers WHERE id=$1 AND user_id = $2', [req.params.id, userId])
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/customers */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, address, gst_number } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    const { rows } = await query(
      `INSERT INTO customers (name, email, phone, address, gst_number, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [name, email, phone, address, gst_number, userId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/customers/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { name, email, phone, address, gst_number } = req.body
  try {
    const { rows } = await query(
      `UPDATE customers SET name=$1,email=$2,phone=$3,address=$4,gst_number=$5,updated_at=NOW()
       WHERE id=$6 AND user_id = $7 RETURNING *`,
      [name, email, phone, address, gst_number, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/customers/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query('DELETE FROM customers WHERE id=$1 AND user_id = $2', [req.params.id, userId])
    res.json({ message: 'Customer deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
