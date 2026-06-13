import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465', // True for 465, false for 587 or other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Verify connection configuration on start
transporter.verify((error, success) => {
  if (error) {
    console.error('[SMTP] Connection validation failed:', error.message)
  } else {
    console.log('[SMTP] Transporter is ready to send emails')
  }
})

export const sendEmail = async ({ from, to, subject, html }) => {
  try {
    console.log(`[SMTP] Attempting to send email to ${to}...`)
    const info = await transporter.sendMail({
      from: from || `"Workshop" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log('[SMTP] Email sent successfully. Message ID:', info.messageId)
    return { data: { id: info.messageId }, error: null }
  } catch (error) {
    console.error('[SMTP] Failed to send email:', error.message)
    return { data: null, error }
  }
}

export default {
  emails: {
    send: sendEmail,
  },
}
