/**
 * Central exporter for email templates.
 * Dedicated template files are located in backend/src/templates/emails/
 */
export { getOtpTemplate } from '../templates/emails/otpTemplate.js'
export { getPasswordResetOtpTemplate } from '../templates/emails/resetOtpTemplate.js'
export { getInvoiceEmailTemplate } from '../templates/emails/invoiceTemplate.js'
export { getQuoteEmailTemplate } from '../templates/emails/quoteTemplate.js'
