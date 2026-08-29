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
  // eslint-disable-next-line sonarjs/no-hardcoded-ip -- Google public DNS used only in dev to fix local DNS resolution
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
  const port = Number.parseInt(process.env.IMAP_PORT) || 993

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
    // 1. Gather all Workshop-related emails (customers, contacts, people, quotes, bills, sent emails)
    const workshopEmails = new Set()
    if (user) workshopEmails.add(user.toLowerCase().trim())

    const custRes = await query(`SELECT LOWER(email) as email FROM customers WHERE user_id = $1 AND email IS NOT NULL AND email != ''`, [ownerUserId]).catch(() => ({ rows: [] }))
    custRes.rows.forEach(r => workshopEmails.add(r.email.trim()))

    const peopleRes = await query(`SELECT LOWER(email) as email FROM people WHERE user_id = $1 AND email IS NOT NULL AND email != ''`, [ownerUserId]).catch(() => ({ rows: [] }))
    peopleRes.rows.forEach(r => workshopEmails.add(r.email.trim()))

    const quotesRes = await query(`SELECT LOWER(customer_email) as email, quote_number FROM quotes WHERE user_id = $1`, [ownerUserId]).catch(() => ({ rows: [] }))
    const quoteNumbers = new Set()
    quotesRes.rows.forEach(r => {
      if (r.email) workshopEmails.add(r.email.trim())
      if (r.quote_number) quoteNumbers.add(r.quote_number.toLowerCase().trim())
    })

    const billsRes = await query(`SELECT bill_number FROM bills WHERE user_id = $1`, [ownerUserId]).catch(() => ({ rows: [] }))
    const billNumbers = new Set()
    billsRes.rows.forEach(r => {
      if (r.bill_number) billNumbers.add(r.bill_number.toLowerCase().trim())
    })

    const existingEmailsRes = await query(`SELECT DISTINCT LOWER(from_email) as email FROM emails WHERE user_id = $1`, [ownerUserId]).catch(() => ({ rows: [] }))
    existingEmailsRes.rows.forEach(r => {
      if (r.email) workshopEmails.add(r.email.trim())
    })

    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      const limit = opts.limit || 50
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
          const bodyText    = parsed.text || parsed.html || ''
          const subjectClean = subject.toLowerCase().trim()
          const bodyClean    = String(bodyText).toLowerCase()

          // Filter: Is this email Workshop-related?
          const isKnownContact = workshopEmails.has(fromAddress)

          let hasRefNumber = false
          for (const qNum of quoteNumbers) {
            if (qNum && (subjectClean.includes(qNum) || bodyClean.includes(qNum))) {
              hasRefNumber = true
              break
            }
          }
          if (!hasRefNumber) {
            for (const bNum of billNumbers) {
              if (bNum && (subjectClean.includes(bNum) || bodyClean.includes(bNum))) {
                hasRefNumber = true
                break
              }
            }
          }

          // Check subject for explicit Workshop terms or thread replies
          const isWorkshopSubject = subjectClean.includes('workshop') || 
                                   subjectClean.includes('quotation') || 
                                   subjectClean.includes('quote') || 
                                   subjectClean.includes('inv-') || 
                                   subjectClean.includes('qt-')

          const isWorkshopRelated = isKnownContact || hasRefNumber || isWorkshopSubject

          // Strictly filter out non-Workshop emails (promotions, random newsletters, personal spam)
          if (!isWorkshopRelated) {
            continue
          }

          const fromName = parsed.from?.value?.[0]?.name || fromAddress
          const preview  = String(bodyText).slice(0, 150)
          const date     = parsed.date || new Date()

          // Skip emails we already saved
          const existing = await query(
            `SELECT id FROM emails
             WHERE user_id = $1
               AND direction = 'inbox'
               AND from_email = $2
               AND subject = $3
               AND ABS(EXTRACT(EPOCH FROM (created_at - $4::timestamptz))) < 300`,
            [ownerUserId, fromAddress, subject, date.toISOString()]
          )
          if (existing.rows.length > 0) continue

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

  console.log('[IMAP] Synced %d new Workshop emails', synced)
  return { synced }
}
