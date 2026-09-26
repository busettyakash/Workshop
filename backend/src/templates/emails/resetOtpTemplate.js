function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export const getPasswordResetOtpTemplate = (otp, email = 'User', userName = '') => {
  const rawDisplayName = userName || (email.includes('@') ? email.split('@')[0] : email)
  const safeDisplayName = escapeHtml(rawDisplayName)
  const safeEmail       = escapeHtml(email)
  const safeOtp         = escapeHtml(otp)

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password — Workshop</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 40px 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; text-align: left;">
            <tr>
              <td style="padding-bottom: 28px;">
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle" style="padding-right: 8px;">
                      <svg width="26" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="5" width="4.5" height="15" rx="2.25" transform="rotate(-15 3 5)" fill="#3d68f5"/>
                        <rect x="10.5" y="7" width="4.5" height="12" rx="2.25" transform="rotate(-15 10.5 7)" fill="#3d68f5"/>
                        <rect x="18" y="9" width="4.5" height="9" rx="2.25" transform="rotate(-15 18 9)" fill="#3d68f5"/>
                      </svg>
                    </td>
                    <td valign="middle" style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; font-family: Inter, sans-serif;">
                      Workshop
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size: 15px; line-height: 1.6; color: #334155;">
                <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Dear ${safeDisplayName},</p>
                <p style="margin: 0 0 16px 0;">
                  Your request to reset forgotten password on <strong>Workshop Platform</strong> has been generated successfully.
                </p>
                <p style="margin: 0 0 16px 0;">
                  Your User ID is <strong style="color: #dc2626;">${safeEmail}</strong>.
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 24px; margin: 20px 0; text-align: center;">
                  <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #3d68f5;">${safeOtp}</span>
                </div>
                <p style="margin: 0 0 16px 0;">
                  Please use the 6-digit verification code above to complete your password reset.
                </p>
                <p style="margin: 0 0 16px 0;">
                  You will use this User ID for all your transactions on Workshop. The User ID cannot be changed, and we recommend that you store this email for your future reference.
                </p>
                <div style="background-color: #f0fdf4; border-left: 3px solid #16a34a; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #15803d; line-height: 1.6;">
                  <strong>Note:</strong> Once your password is reset, you can log in to access your GST billing, stock imports, deals, and CRM records.
                </div>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b;">
                  If you ever forget your password in the future, you can use the 'Forgot password?' link available on the sign-in page of the site.
                </p>
                <p style="margin: 24px 0 0 0; font-size: 14px; color: #334155; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                  Warm Regards,<br>
                  <strong style="color: #0f172a;">Customer Care</strong><br>
                  <em>Workshop Platform</em>
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
