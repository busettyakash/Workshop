import { Router } from 'express'
import { query } from '../lib/db.js'
import insforge from '../lib/insforge.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/* Ensure table exists with user_id and company_shop_id */
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
      user_id     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS user_id TEXT`).catch(() => {})
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb`).catch(() => {})
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS discount NUMERIC(5,2) DEFAULT 0`).catch(() => {})
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id INTEGER`).catch(() => {})
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_shop_id TEXT`).catch(() => {})
  await query(`
    CREATE TABLE IF NOT EXISTS deal_logs (
      id          SERIAL PRIMARY KEY,
      deal_id     INTEGER REFERENCES deals(id) ON DELETE CASCADE,
      deal_title  TEXT,
      event       TEXT NOT NULL,
      from_value  TEXT,
      to_value    TEXT,
      done_by     TEXT DEFAULT 'System',
      user_id     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS user_id TEXT`).catch(() => {})
}
ensureTable().catch(console.error)

/* GET /api/deals */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT d.*, d.company_shop_id AS company_id, s.shop_name AS company_name 
       FROM deals d
       LEFT JOIN shop_profiles s ON d.company_shop_id = s.user_id::text
       WHERE d.user_id = $1 OR d.company_shop_id = $1
       ORDER BY d.created_at DESC`,
      [userId]
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/deals */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { title, value, stage, owner, close_date, notes, products, discount, company_id } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })
  try {
    const { rows } = await query(
      `INSERT INTO deals (title, value, stage, owner, close_date, notes, products, discount, company_shop_id, user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [title, value || 0, stage || 'Discovery', owner || '', close_date || null, notes || '', JSON.stringify(products || []), discount || 0, company_id ? String(company_id) : null, userId]
    )
    
    const savedDeal = rows[0]
    if (savedDeal) {
      savedDeal.company_id = savedDeal.company_shop_id
    }

    // Log creation
    await query(
      `INSERT INTO deal_logs (deal_id, deal_title, event, done_by, user_id) VALUES ($1,$2,$3,$4,$5)`,
      [savedDeal.id, title, 'Deal created', owner || 'System', userId]
    )

    // Create Notification
    try {
      const dealId = savedDeal.id
      const notifTitle = `New Deal Created`
      const notifBody = `Deal "${title}" has been created with stage "${stage || 'Discovery'}".`
      const notifLink = `/deals/edit/${dealId}`
      
      // Notify the creator
      await query(
        `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
         VALUES ($1, $2, $3, 'info', false, $4, NOW())`,
        [userId, notifTitle, notifBody, notifLink]
      )

      // Notify the company/customer
      if (company_id && String(company_id) !== String(userId)) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
           VALUES ($1, $2, $3, 'info', false, $4, NOW())`,
          [String(company_id), notifTitle, notifBody, `/deals/review/${dealId}`]
        )
      }

      // Create Chat Session for Negotiation for User B
      if (company_id && String(company_id) !== String(userId)) {
        try {
          const chatTitle = `Negotiation: ${title}`
          const convId = `deal-${dealId}`
          const initialMessages = [
            { role: 'system', content: `This is a negotiation thread for the deal "${title}".` },
            { role: 'assistant', content: `Hello! I have created this chat thread for us to negotiate the terms of the deal "${title}". Please review the deal details and let me know if you have any questions or counter-offers!` }
          ]
          await query(
            `INSERT INTO chat_sessions (user_id, conversation_id, title, messages, last_message, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, $5, NOW())`,
            [String(company_id), convId, chatTitle, JSON.stringify(initialMessages), 'Hello! I have created this chat thread...']
          )
        } catch (chatErr) {
          console.error('Failed to create chat session for deal:', chatErr.message)
        }
      }
      
      // Optionally push via InsForge realtime
      try {
        await insforge.realtime.publish(`notifications:${userId}`, {
          event: 'new_notification',
          payload: { title: notifTitle, body: notifBody, link: notifLink }
        })
        if (company_id && String(company_id) !== String(userId)) {
          await insforge.realtime.publish(`notifications:${company_id}`, {
            event: 'new_notification',
            payload: { title: notifTitle, body: notifBody, link: notifLink }
          })
        }
      } catch (_) {}
    } catch (nErr) {
      console.error('Failed to create notification on deal creation:', nErr.message)
    }

    res.status(201).json(savedDeal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/deals/logs */
router.get('/logs', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT * FROM deal_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/deals/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      `SELECT d.*, d.company_shop_id AS company_id, s.shop_name AS company_name 
       FROM deals d
       LEFT JOIN shop_profiles s ON d.company_shop_id = s.user_id::text
       WHERE d.id = $1 AND (d.user_id = $2 OR d.company_shop_id = $2)`, 
      [req.params.id, userId]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Deal not found' })
    }
    res.json({ data: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/deals/:id */
router.put('/:id', async (req, res) => {
  const userId = req.workspaceId
  const { title, value, stage, owner, close_date, notes, status, products, discount, company_id } = req.body
  try {
    const prev = await query('SELECT * FROM deals WHERE id=$1 AND user_id = $2', [req.params.id, userId])
    const old = prev.rows[0]
    if (!old) return res.status(404).json({ error: 'Deal not found' })
    const { rows } = await query(
      `UPDATE deals SET title=$1,value=$2,stage=$3,owner=$4,close_date=$5,notes=$6,status=$7,products=$8,discount=$9,company_shop_id=$10,updated_at=NOW()
       WHERE id=$11 AND user_id = $12 RETURNING *`,
      [title, value, stage, owner, close_date || null, notes, status || 'active', JSON.stringify(products || []), discount || 0, company_id ? String(company_id) : null, req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' })
    
    const updatedDeal = rows[0]
    if (updatedDeal) {
      updatedDeal.company_id = updatedDeal.company_shop_id
    }

    // Log stage change
    if (old && old.stage !== stage) {
      await query(
        `INSERT INTO deal_logs (deal_id, deal_title, event, from_value, to_value, done_by, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.params.id, title, 'Stage changed', old.stage, stage, owner || 'System', userId]
      )

      // Create Notification for stage change
      try {
        const notifTitle = `Deal Stage Updated`
        const notifBody = `Deal "${title}" stage changed from "${old.stage}" to "${stage}".`
        const notifLink = `/deals/edit/${req.params.id}`
        
        // Notify the creator
        await query(
          `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
           VALUES ($1, $2, $3, 'info', false, $4, NOW())`,
          [userId, notifTitle, notifBody, notifLink]
        )

        // Notify the company/customer
        if (company_id && String(company_id) !== String(userId)) {
          await query(
            `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
             VALUES ($1, $2, $3, 'info', false, $4, NOW())`,
            [String(company_id), notifTitle, notifBody, `/deals/review/${req.params.id}`]
          )
        }
        
        // Optionally push via InsForge realtime
        try {
          await insforge.realtime.publish(`notifications:${userId}`, {
            event: 'new_notification',
            payload: { title: notifTitle, body: notifBody, link: notifLink }
          })
          if (company_id && String(company_id) !== String(userId)) {
            await insforge.realtime.publish(`notifications:${company_id}`, {
              event: 'new_notification',
              payload: { title: notifTitle, body: notifBody, link: notifLink }
            })
          }
        } catch (_) {}
      } catch (nErr) {
        console.error('Failed to create notification on deal update:', nErr.message)
      }
    }
    res.json(updatedDeal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/deals/:id/approve */
router.post('/:id/approve', async (req, res) => {
  const userId = req.workspaceId
  try {
    const prev = await query('SELECT * FROM deals WHERE id=$1 AND company_shop_id = $2', [req.params.id, userId])
    const old = prev.rows[0]
    if (!old) return res.status(404).json({ error: 'Deal not found or unauthorized' })

    const stage = 'Closed Won'

    // Update deal
    const { rows } = await query(
      `UPDATE deals SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [stage, req.params.id]
    )
    
    // Decrement stock for products
    let parsedProducts = []
    if (old.products) {
      if (typeof old.products === 'string') {
        try { parsedProducts = JSON.parse(old.products) } catch (e) {}
      } else if (Array.isArray(old.products)) {
        parsedProducts = old.products
      }
    }

    for (const p of parsedProducts) {
      await query(`UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2`, [p.quantity, p.id])
      await query(`UPDATE products SET status = 'inactive' WHERE id = $1 AND stock <= 0`, [p.id])
    }

    // Trigger workflow
    try {
      const wfRes = await query('SELECT id FROM workflows WHERE user_id = $1 LIMIT 1', [old.user_id])
      if (wfRes.rows.length > 0) {
        const wfId = wfRes.rows[0].id
        await query(
          `INSERT INTO workflow_runs (workflow_id, user_id, status, test_company, test_value, current_step, created_at)
           VALUES ($1, $2, 'Executing', $3, $4, 0, NOW())`,
          [wfId, old.user_id, old.title, old.value]
        )
      }
    } catch (err) {
      console.error('Failed to trigger workflow:', err.message)
    }

    // Notify User A
    try {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
         VALUES ($1, $2, $3, 'success', false, $4, NOW())`,
        [old.user_id, 'Deal Approved', `Deal "${old.title}" was approved by the customer.`, `/deals/edit/${old.id}`]
      )
    } catch (e) {}

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/deals/:id/reject */
router.post('/:id/reject', async (req, res) => {
  const userId = req.workspaceId
  try {
    const prev = await query('SELECT * FROM deals WHERE id=$1 AND company_shop_id = $2', [req.params.id, userId])
    const old = prev.rows[0]
    if (!old) return res.status(404).json({ error: 'Deal not found or unauthorized' })

    const stage = 'Closed Lost'

    // Update deal
    const { rows } = await query(
      `UPDATE deals SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [stage, req.params.id]
    )

    // Notify User A
    try {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
         VALUES ($1, $2, $3, 'error', false, $4, NOW())`,
        [old.user_id, 'Deal Rejected', `Deal "${old.title}" was rejected by the customer.`, `/deals/edit/${old.id}`]
      )
    } catch (e) {}

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/deals/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    await query('DELETE FROM deals WHERE id=$1 AND user_id = $2', [req.params.id, userId])
    res.json({ message: 'Deal deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/deals/:id/chat */
router.get('/:id/chat', async (req, res) => {
  try {
    const convId = `deal-${req.params.id}`
    const { rows } = await query(
      `SELECT id FROM chat_sessions WHERE conversation_id = $1`,
      [convId]
    )
    if (rows.length > 0) {
      res.json({ sessionId: rows[0].id })
    } else {
      res.status(404).json({ error: 'Chat not found' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
