import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number.parseInt(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_PORT) === '465',
  pool: !isServerless,
  maxConnections: isServerless ? 1 : 5,
  maxMessages: 100,
  rateLimit: 14,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 20000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false
  }
})

let transporter = createTransporter()

if (!isServerless) {
  transporter.verify((error) => {
    if (error) {
      console.error('[SMTP] Connection verify warning:', error.message)
    } else {
      console.log('[SMTP] Ready ✅ — using', process.env.SMTP_USER)
    }
  })
}

export const sendEmail = async ({ to, subject, html, attachments = [] }, retriesLeft = 2) => {
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
    console.error(`[SMTP Warning] Send attempt error (${err.message}). Retries remaining: ${retriesLeft}`)
    const isConnErr =
      err.code === 'ECONNRESET' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EPIPE' ||
      err.message?.includes('ECONNRESET') ||
      err.message?.includes('socket') ||
      err.message?.includes('connection')

    if (isConnErr && retriesLeft > 0) {
      console.log('[SMTP RECONNECT] Re-establishing fresh SMTP transport connection...')
      try {
        transporter.close()
      } catch {
        // ignore close errors
      }
      transporter = createTransporter()
      await new Promise(r => setTimeout(r, 600))
      return sendEmail({ to, subject, html, attachments }, retriesLeft - 1)
    }

    return { data: null, error: err }
  }
}

export default {
  emails: {
    send: sendEmail,
  },
}
