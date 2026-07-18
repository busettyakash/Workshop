import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail } from '../lib/smtp.js'
import { syncGmailInbox } from '../lib/imap.js'
import redis from '../lib/redis.js'

const router = Router()
router.use(requireAuth)

const clearEmailsCache = async (userId) => {
  try {
    const keys = await redis.keys(`emails:${userId}:*`).catch(() => [])
    for (const key of keys) {
      await redis.del(key).catch(() => {})
    }
  } catch (err) {
    console.error('[Emails Cache Invalidation Error]', err.message)
  }
}

/* Ensure table exists */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS emails (
      id               SERIAL PRIMARY KEY,
      from_name        TEXT NOT NULL,
      from_email       TEXT NOT NULL,
      subject          TEXT NOT NULL,
      body             TEXT DEFAULT '',
      preview          TEXT DEFAULT '',
      is_read          BOOLEAN DEFAULT false,
      starred          BOOLEAN DEFAULT false,
      direction        TEXT DEFAULT 'inbox',
      attachment_name  TEXT,
      attachment_data  TEXT,
      user_id          TEXT NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS emails_user_id_idx ON emails (user_id)`).catch(() => {})
  // Alter to add attachment columns if they don't exist yet
  await query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachment_name TEXT`).catch(() => {})
  await query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachment_data TEXT`).catch(() => {})
}
ensureTable().catch(console.error)

/* GET /api/emails */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { search, direction = 'inbox' } = req.query
  const params = [userId, direction]
  let where = 'WHERE user_id = $1 AND direction = $2'

  if (search) {
    params.push(`%${search}%`)
    const idx = params.length
    where += ` AND (from_name ILIKE $${idx} OR from_email ILIKE $${idx} OR subject ILIKE $${idx} OR body ILIKE $${idx})`
  }


  const cacheKey = `emails:${userId}:${direction}:${search || ''}`
  try {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) {
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached)
    }
  } catch (cErr) {
    console.error('[Emails Cache Read Error]', cErr.message)
  }

  try {
    const { rows } = await query(
      `SELECT * FROM emails ${where} ORDER BY created_at DESC`,
      params
    )
    const resultPayload = { data: rows, total: rows.length }
    try {
      await redis.set(cacheKey, JSON.stringify(resultPayload), { ex: 300 }).catch(() => {})
    } catch (cErr) {
      console.error('[Emails Cache Write Error]', cErr.message)
    }
    res.json(resultPayload)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/emails/sync — manually trigger IMAP inbox sync */
router.post('/sync', async (req, res) => {
  const userId = req.workspaceId
  try {
    const result = await syncGmailInbox(userId, { limit: 50 })
    if (result.error) {
      return res.status(500).json({ error: result.error })
    }
    await clearEmailsCache(userId)
    res.json({ message: `Synced ${result.synced} new email(s) from Gmail`, synced: result.synced })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/emails/:id */
router.get('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Email not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/emails — save a sent email */
router.post('/', async (req, res) => {
  const userId = req.workspaceId
  const { from_name, from_email, subject, body = '', preview = '', direction = 'inbox', attachment_name = null, attachment_data = null } = req.body
  if (!from_email?.trim() || !subject?.trim()) {
    return res.status(400).json({ error: 'from_email and subject are required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, attachment_name, attachment_data, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [from_name || from_email, from_email, subject, body, preview || body.slice(0, 120), direction, attachment_name, attachment_data, userId]
    )
    
    await clearEmailsCache(userId)

    // If the recipient is a registered workspace user, save a separate inbox
    // copy under that user's workspace so it appears in their Inbox tab.
    const userEmail = req.user?.email || ''
    if (direction === 'sent' && from_email && userEmail) {
      try {
        const recipientEmail = from_email.toLowerCase().trim()
        const senderEmail = userEmail.toLowerCase().trim()
        let recipientUserId = recipientEmail === senderEmail ? userId : null

        if (!recipientUserId) {
          const recipientRes = await query(
            'SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [recipientEmail]
          )
          recipientUserId = recipientRes.rows[0]?.user_id || null
        }

        if (recipientUserId) {
          const senderName = req.user?.shopName || userEmail

          await query(
            `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, attachment_name, attachment_data, user_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'inbox', $6, $7, $8, NOW(), NOW())`,
            [senderName, userEmail, subject, body, preview || body.slice(0, 120), attachment_name, attachment_data, recipientUserId]
          )

          await clearEmailsCache(recipientUserId)
        }
      } catch (dupErr) {
        console.error('[Recipient Inbox Record Error]', dupErr.message)
      }
    }

    // Actually deliver the email using SMTP if it is outgoing
    if (direction === 'sent') {
      try {
        const mailOptions = {
          to: from_email.trim(),
          subject: subject.trim(),
          html: body.replace(/\n/g, '<br/>')
        }
        
        // Add attachment if present
        if (attachment_name && attachment_data) {
          const base64Content = attachment_data.split(';base64,').pop()
          mailOptions.attachments = [{
            filename: attachment_name,
            content: base64Content,
            encoding: 'base64'
          }]
        }

        await sendEmail(mailOptions)
      } catch (smtpErr) {
        console.error('[SMTP Send Failure]', smtpErr.message)
        // We still return 201 because the database record succeeded
      }
    }

    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/emails/:id/read */
router.patch('/:id/read', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      'UPDATE emails SET is_read=true, updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Email not found' })
    await clearEmailsCache(userId)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PATCH /api/emails/:id/star */
router.patch('/:id/star', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rows } = await query(
      'UPDATE emails SET starred = NOT starred, updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',
      [req.params.id, userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Email not found' })
    await clearEmailsCache(userId)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/emails/:id */
router.delete('/:id', async (req, res) => {
  const userId = req.workspaceId
  try {
    const { rowCount } = await query(
      'DELETE FROM emails WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'Email not found' })
    await clearEmailsCache(userId)
    res.json({ success: true, message: 'Email deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
