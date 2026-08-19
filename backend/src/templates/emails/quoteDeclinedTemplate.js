function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const getQuoteDeclinedTemplate = ({ quote = {}, shopName = '', supportEmail = '', supportPhone = '' } = {}) => {
  const quoteNumber = quote.quote_number || `QT-${quote.id || '0000'}`
  const customerName = quote.customer_name || 'Valued Customer'
  const company = shopName || quote.shop_name || 'Workshop'
  const totalAmount = parseFloat(quote.total_amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const issueDate = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Recent'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation #${escapeHtml(quoteNumber)} Update</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9; padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px; background-color:#ffffff; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 6px 20px rgba(0,0,0,0.04); overflow:hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 32px 24px; background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); text-align:left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:20px; font-weight:800; color:#ffffff; letter-spacing:-0.02em; margin-bottom:4px;">
                      ${escapeHtml(company)}
                    </div>
                    <div style="font-size:12px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">
                      Quotation Status Notification
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block; padding:5px 12px; background:rgba(239, 68, 68, 0.18); border:1px solid rgba(239, 68, 68, 0.4); border-radius:20px; color:#fca5a5; font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">
                      Declined
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 14px; font-size:15px; font-weight:700; color:#0f172a;">
                Dear ${escapeHtml(customerName)},
              </p>
              <p style="margin:0 0 18px; font-size:14px; color:#334155; line-height:1.65;">
                We have received and recorded your response indicating that you have <strong>declined</strong> Quotation <strong>#${escapeHtml(quoteNumber)}</strong>.
              </p>
              <p style="margin:0 0 24px; font-size:13.5px; color:#64748b; line-height:1.6;">
                No charges or invoices have been issued, and all reserved items have been released back to our inventory.
              </p>

              <!-- Quote Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:24px; padding:16px 20px;">
                <tr>
                  <td style="padding:6px 0; font-size:13px; color:#64748b; font-weight:600; width:140px;">Quotation Ref:</td>
                  <td style="padding:6px 0; font-size:13.5px; color:#0f172a; font-weight:700;">#${escapeHtml(quoteNumber)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:13px; color:#64748b; font-weight:600;">Issue Date:</td>
                  <td style="padding:6px 0; font-size:13px; color:#334155;">${escapeHtml(issueDate)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-size:13px; color:#64748b; font-weight:600;">Quoted Amount:</td>
                  <td style="padding:6px 0; font-size:14px; color:#0f172a; font-weight:800;">₹${totalAmount}</td>
                </tr>
              </table>

              <!-- Revision & Options Section -->
              <div style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:18px 20px; margin-bottom:24px;">
                <div style="font-size:14px; font-weight:700; color:#1e40af; margin-bottom:6px;">
                  💬 Would you like a revised proposal or customized pricing?
                </div>
                <p style="margin:0 0 10px; font-size:13px; color:#1e3a8a; line-height:1.55;">
                  We understand your requirements or budget may have changed. We are always happy to:
                </p>
                <ul style="margin:0 0 12px 18px; padding:0; font-size:12.5px; color:#1e3a8a; line-height:1.6;">
                  <li>Customize service tiers or suggest alternative replacement parts</li>
                  <li>Adjust order quantities or explore flexible milestone delivery</li>
                  <li>Provide special seasonal discounts or custom payment terms</li>
                </ul>
                <p style="margin:0; font-size:13px; color:#1e3a8a; line-height:1.5;">
                  Simply reply directly to this email with your feedback, or reach out to our team at any time.
                </p>
              </div>

              <p style="margin:0 0 20px; font-size:13.5px; color:#475569; line-height:1.6;">
                Thank you for considering <strong>${escapeHtml(company)}</strong>. We look forward to the opportunity of assisting you in the future.
              </p>

              <!-- Signoff -->
              <div style="border-top:1px solid #e2e8f0; padding-top:18px; margin-top:20px;">
                <div style="font-size:13px; color:#64748b;">Warm regards,</div>
                <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:3px;">Customer Support & Sales Team</div>
                <div style="font-size:13px; color:#2563eb; font-weight:600;">${escapeHtml(company)}</div>
                ${supportEmail ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">Email: <a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(supportEmail)}</a></div>` : ''}
                ${supportPhone ? `<div style="font-size:12px; color:#64748b; margin-top:2px;">Phone: ${escapeHtml(supportPhone)}</div>` : ''}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
              <p style="margin:0; font-size:11.5px; color:#94a3b8; line-height:1.5;">
                This is an automated notification regarding Quotation #${escapeHtml(quoteNumber)}.<br/>
                If you have questions, please contact your account manager or reply to this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
