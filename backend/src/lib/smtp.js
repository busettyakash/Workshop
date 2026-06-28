/**
 * Email sender — nodemailer SMTP
 * Works for both local (Gmail) and production (same Gmail SMTP).
 * Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 */
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
})

transporter.verify((error) => {
  if (error) {
    console.error('[SMTP] Connection failed:', error.message)
  } else {
    console.log('[SMTP] Ready — using', process.env.SMTP_USER)
  }
})

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Workshop" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log('[SMTP] Email sent:', info.messageId)
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
