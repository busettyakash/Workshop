import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : {
      emails: {
        async send() {
          return { data: null, error: new Error('RESEND_API_KEY is not configured') }
        },
      },
    }

export default resend
