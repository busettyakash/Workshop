/**
 * Email sender — nodemailer SMTP (Gmail)
 * Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 *
 * DNS patch is applied here so smtp.gmail.com resolves correctly even
 * when the local router DNS server is broken/slow.
 */
import dns from 'dns'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

// ── DNS patch: use Google public DNS so smtp.gmail.com always resolves ──
try {
  dns.setServers(['8.8.8.8', '8.8.4.4'])
} catch (_) {}

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
// ────────────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  tls: {
    rejectUnauthorized: false
  }
})

transporter.verify((error) => {
  if (error) {
    console.error('[SMTP] Connection failed:', error.message)
  } else {
    console.log('[SMTP] Ready ✅ — using', process.env.SMTP_USER)
  }
})

export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const missing = [
      !process.env.SMTP_HOST && 'SMTP_HOST',
      !process.env.SMTP_USER && 'SMTP_USER',
      !process.env.SMTP_PASS && 'SMTP_PASS',
    ].filter(Boolean)
    console.error(`[SMTP] Missing env vars: ${missing.join(', ')}`)
    return { data: null, error: new Error(`SMTP config missing: ${missing.join(', ')}`) }
  }

  try {
    const info = await transporter.sendMail({
      from: `"Workshop" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    })
    console.log('[SMTP] Email sent ✅ id:', info.messageId)
    return { data: { id: info.messageId }, error: null }
  } catch (err) {
    console.error('[SMTP] Send failed:', err.message)
    return { data: null, error: err }
  }
}

export default {
  emails: {
    send: sendEmail,
  },
}
