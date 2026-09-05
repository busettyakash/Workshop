function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export const getInviteEmailTemplate = ({
  inviteeEmail = '',
  inviterEmail = '',
  workspaceName = 'Workshop',
  role = 'Member',
  signupLink = ''
}) => {
  const rawDisplayName = inviteeEmail.includes('@') ? inviteeEmail.split('@')[0] : inviteeEmail
  const safeDisplayName = escapeHtml(rawDisplayName)
  const safeInviteeEmail = escapeHtml(inviteeEmail)
  const safeInviterEmail = escapeHtml(inviterEmail)
  const safeWorkspaceName = escapeHtml(workspaceName)
  const safeRole = escapeHtml(role)

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Invitation — Workshop</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="left" style="padding: 24px 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0; text-align: left;">
            
            <!-- Workshop Logo Header -->
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

            <!-- Body Content -->
            <tr>
              <td style="font-size: 15px; line-height: 1.6; color: #334155;">
                <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Dear ${safeDisplayName},</p>
                
                <p style="margin: 0 0 16px 0;">
                  <strong style="color: #0f172a;">${safeInviterEmail}</strong> has invited you to collaborate in their workspace on <strong>Workshop Platform</strong>.
                </p>

                <!-- Workspace Invitation Card -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin: 22px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 8px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                        Workspace Details
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 18px; font-weight: 800; color: #0f172a; padding-bottom: 6px;">
                        ${safeWorkspaceName}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #64748b;">
                        Assigned Role: <strong style="color: #2563eb; background-color: #eff6ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">${safeRole}</strong>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- CTA Button -->
                <div style="margin: 28px 0; text-align: left;">
                  <a href="${signupLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                    Accept Invitation &rarr;
                  </a>
                </div>

                <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569;">
                  If you already have a Workshop account registered with <strong style="color: #0f172a;">${safeInviteeEmail}</strong>, simply log in and select <strong>${safeWorkspaceName}</strong> from the workspace switcher in the sidebar.
                </p>
                
                <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b;">
                  If you were not expecting this invitation, you can safely ignore this email.
                </p>

                <!-- Footer Signature -->
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
