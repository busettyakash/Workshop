/**
 * Central exporter for email templates.
 * Dedicated template files are located in backend/src/templates/emails/
 */
export { getOtpTemplate } from '../templates/emails/otpTemplate.js'
export { getPasswordResetOtpTemplate } from '../templates/emails/resetOtpTemplate.js'
export { getInvoiceEmailTemplate } from '../templates/emails/invoiceTemplate.js'
export { getQuoteEmailTemplate } from '../templates/emails/quoteTemplate.js'
export { getQuoteDeclinedTemplate } from '../templates/emails/quoteDeclinedTemplate.js'

export function getOrderConfirmationTemplate({ customerName = 'Customer', orderNumber = '', orderDate = '', totalAmount = 0 } = {}) {
  const total = parseFloat(totalAmount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0;padding:24px 0;background:#ffffff;color:#1e293b;">

      <!-- Workshop Name -->
      <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px;letter-spacing:-0.02em;">
        Workshop
      </div>

      <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#0f172a;">Dear ${customerName},</p>
      <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;">Thank you for accepting our quotation.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">Your order has been successfully created.</p>

      <!-- Details Card -->
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:20px;background:#f8fafc;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;width:140px">Order Number:</td>
            <td style="padding:6px 0;color:#2563eb;font-weight:700;">${orderNumber || 'ORD-0001'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">Order Date:</td>
            <td style="padding:6px 0;color:#0f172a;font-weight:700;">${orderDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">Total Amount:</td>
            <td style="padding:6px 0;color:#0f172a;font-weight:800;font-size:15px;">&#8377;${total}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 6px;font-size:14px;color:#334155;">Your tax invoice is attached to this email as a PDF document.</p>
      <p style="margin:0 0 28px;font-size:14px;font-weight:700;color:#0f172a;">Thank you for your business.</p>

      <!-- Footer -->
      <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
        <div style="font-size:13px;color:#64748b;">Warm Regards,</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">Customer Care</div>
        <div style="font-size:13px;font-style:italic;color:#64748b;">Workshop Platform</div>
      </div>

    </div>
  `
}

