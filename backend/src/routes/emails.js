import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail } from '../lib/smtp.js'
import { syncGmailInbox } from '../lib/imap.js'
import redis from '../lib/redis.js'
import { apiLimiter } from '../middleware/rateLimit.js'

const router = Router()
router.use(apiLimiter)
router.use(requireAuth)

const escapeHtml = (unsafe) => {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
  await query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS to_email TEXT`).catch(() => {})
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

/* Helper to purge non-Workshop emails from inbox */
const cleanupInbox = async (userId) => {
  try {
    const workshopEmails = new Set()

    const custRes = await query(`SELECT LOWER(email) as email FROM customers WHERE user_id = $1 AND email IS NOT NULL AND email != ''`, [userId]).catch(() => ({ rows: [] }))
    custRes.rows.forEach(r => workshopEmails.add(r.email.trim()))

    const peopleRes = await query(`SELECT LOWER(email) as email FROM people WHERE user_id = $1 AND email IS NOT NULL AND email != ''`, [userId]).catch(() => ({ rows: [] }))
    peopleRes.rows.forEach(r => workshopEmails.add(r.email.trim()))

    const quotesRes = await query(`SELECT LOWER(customer_email) as email, quote_number FROM quotes WHERE user_id = $1`, [userId]).catch(() => ({ rows: [] }))
    const quoteNumbers = new Set()
    quotesRes.rows.forEach(r => {
      if (r.email) workshopEmails.add(r.email.trim())
      if (r.quote_number) quoteNumbers.add(r.quote_number.toLowerCase().trim())
    })

    const billsRes = await query(`SELECT bill_number FROM bills WHERE user_id = $1`, [userId]).catch(() => ({ rows: [] }))
    const billNumbers = new Set()
    billsRes.rows.forEach(r => {
      if (r.bill_number) billNumbers.add(r.bill_number.toLowerCase().trim())
    })

    const inboxRes = await query(`SELECT id, LOWER(from_email) as from_email, LOWER(subject) as subject, LOWER(body) as body FROM emails WHERE user_id = $1 AND direction = 'inbox'`, [userId])

    const idsToDelete = []
    for (const email of inboxRes.rows) {
      const fromAddr = (email.from_email || '').trim()
      const subj = (email.subject || '').trim()
      const body = (email.body || '').trim()

      const isKnownContact = workshopEmails.has(fromAddr)

      let hasRefNumber = false
      for (const qNum of quoteNumbers) {
        if (qNum && (subj.includes(qNum) || body.includes(qNum))) {
          hasRefNumber = true
          break
        }
      }
      if (!hasRefNumber) {
        for (const bNum of billNumbers) {
          if (bNum && (subj.includes(bNum) || body.includes(bNum))) {
            hasRefNumber = true
            break
          }
        }
      }

      const isWorkshopSubject = subj.includes('workshop') ||
                               subj.includes('quotation') ||
                               subj.includes('quote') ||
                               subj.includes('inv-') ||
                               subj.includes('qt-')

      const isWorkshopRelated = isKnownContact || hasRefNumber || isWorkshopSubject

      if (!isWorkshopRelated) {
        idsToDelete.push(email.id)
      }
    }

    if (idsToDelete.length > 0) {
      await query(`DELETE FROM emails WHERE id = ANY($1::int[]) AND user_id = $2`, [idsToDelete, userId])
      await clearEmailsCache(userId)
    }

    return idsToDelete.length
  } catch (err) {
    console.error('[Inbox Cleanup Error]', err.message)
    return 0
  }
}

/* GET /api/emails */
router.get('/', async (req, res) => {
  const userId = req.workspaceId
  const { search, direction = 'inbox' } = req.query

  // Perform inbox cleanup on fetch
  if (direction === 'inbox') {
    await cleanupInbox(userId)
  }

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

/* POST /api/emails/cleanup — manually trigger inbox cleanup */
router.post('/cleanup', async (req, res) => {
  const userId = req.workspaceId
  try {
    const cleanedCount = await cleanupInbox(userId)
    res.json({ message: `Cleaned up ${cleanedCount} non-Workshop email(s)`, cleaned: cleanedCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/emails/sync — manually trigger IMAP inbox sync */
router.post('/sync', async (req, res) => {
  const userId = req.workspaceId
  try {
    const result = await syncGmailInbox(userId, { limit: 50 }).catch(err => ({ synced: 0, error: err.message }))
    await clearEmailsCache(userId).catch(() => {})
    res.json({ message: 'Inbox sync completed', synced: result.synced || 0, error: result.error || null })
  } catch (_err) {
    res.json({ message: 'Inbox sync completed', synced: 0, error: null })
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
          html: escapeHtml(body).replace(/\n/g, '<br/>')
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
