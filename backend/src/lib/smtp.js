import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()


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
