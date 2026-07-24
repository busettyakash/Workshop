/**
 * Gmail IMAP Inbox Sync
 * Connects to Gmail via IMAP (port 993/SSL) using the App Password in .env
 * and pulls unseen messages into the `emails` table for the given workspace owner.
 *
 * The same DNS monkeypatch used in smtp.js is applied here so imap.gmail.com
 * resolves correctly even when the local router DNS is broken.
 */
import dns from 'dns'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { query } from './db.js'

// ── DNS patch (same as smtp.js) ── Only active in development mode to avoid affecting production
if (process.env.NODE_ENV === 'development') {
  try { dns.setServers(['8.8.8.8', '8.8.4.4']) } catch {}
  const _origLookup = dns.lookup
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {} }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return _origLookup(hostname, options, callback)
    }
    dns.resolve4(hostname, (err, addrs) => {
      if (err || !addrs?.length) return _origLookup(hostname, options, callback)
      if (options && options.all) {
        callback(null, addrs.map(a => ({ address: a, family: 4 })))
      } else {
        callback(null, addrs[0], 4)
      }
    })
  }
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch unseen emails from Gmail IMAP and insert them into the emails table.
 * @param {string} ownerUserId  - The workspace owner's user_id (for the user_id column)
 * @param {object} opts         - Optional overrides { limit }
 */
export async function syncGmailInbox(ownerUserId, opts = {}) {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const host = process.env.IMAP_HOST || 'imap.gmail.com'
  const port = parseInt(process.env.IMAP_PORT) || 993

  if (!user || !pass) {
    console.warn('[IMAP] SMTP_USER / SMTP_PASS not set — skipping sync')
    return { synced: 0, error: 'Missing credentials' }
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,          // port 993 is always SSL
    auth: { user, pass },
    logger: false,         // suppress verbose logs in production
    tls: { rejectUnauthorized: false },
  })

  let synced = 0
  try {
    // 1. Get all unique recipient emails and subjects we have sent emails to
    const sentEmailsRes = await query(
      `SELECT DISTINCT from_email, LOWER(subject) as subject FROM emails WHERE user_id = $1 AND direction = 'sent'`,
      [ownerUserId]
    ).catch(() => ({ rows: [] }))

    // Map recipient email -> Set of clean lowercase subjects we sent to them
    const sentMap = new Map()
    for (const r of sentEmailsRes.rows) {
      const email = String(r.from_email || '').toLowerCase().trim()
      const subject = String(r.subject || '').toLowerCase().trim().replace(/^(re|fwd|fw):\s*/i, '').trim()
      if (!sentMap.has(email)) {
        sentMap.set(email, new Set())
      }
      sentMap.get(email).add(subject)
    }

    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      const limit = opts.limit || 50
      // Fetch the most recent `limit` messages so we don't pull the whole mailbox
      const status = await client.status('INBOX', { messages: true })
      const total = status.messages || 0
      const startSeq = Math.max(1, total - limit + 1)

      for await (const msg of client.fetch(`${startSeq}:*`, {
        envelope: true,
        source: true,
        flags: true,
      })) {
        try {
          const parsed = await simpleParser(msg.source)

          const fromAddress = (parsed.from?.value?.[0]?.address || '').toLowerCase().trim()
          const subject     = parsed.subject || '(No subject)'
          const incomingSubjectClean = subject.toLowerCase().trim().replace(/^(re|fwd|fw):\s*/i, '').trim()

          // Filter 1: Must be from someone we sent an email to
          const sentSubjects = sentMap.get(fromAddress)
          if (!sentSubjects) {
            continue
          }

          // Filter 2: The subject thread (ignoring prefixes like Re:) must match
          if (!sentSubjects.has(incomingSubjectClean)) {
            continue
          }

          // Filter 3: Must be an actual reply (subject starts with "Re:")
          if (!subject.toLowerCase().trim().startsWith('re:')) {
            continue
          }

          const fromName    = parsed.from?.value?.[0]?.name || fromAddress
          const bodyText    = parsed.text || parsed.html || ''
          const preview     = String(bodyText).slice(0, 150)
          const date        = parsed.date || new Date()

          // Skip emails we already saved (by matching from + subject + approximate timestamp)
          const existing = await query(
            `SELECT id FROM emails
             WHERE user_id = $1
               AND direction = 'inbox'
               AND from_email = $2
               AND subject = $3
               AND ABS(EXTRACT(EPOCH FROM (created_at - $4::timestamptz))) < 300`,
            [ownerUserId, fromAddress, subject, date.toISOString()]
          )
          if (existing.rows.length > 0) continue  // already in DB

          await query(
            `INSERT INTO emails
               (from_name, from_email, subject, body, preview, direction, is_read, user_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'inbox', false, $6, $7, NOW())`,
            [fromName, fromAddress, subject, bodyText, preview, ownerUserId, date.toISOString()]
          )
          synced++
        } catch (msgErr) {
          console.error('[IMAP] Error parsing message:', msgErr.message)
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    console.error('[IMAP] Sync error:', err.message)
    return { synced, error: err.message }
  }

  console.log(`[IMAP] Synced ${synced} new emails for user ${ownerUserId}`)
  return { synced }
}
