export const getOtpTemplate = (otp) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f7ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">

              <!-- Header: Workshop Logo -->
              <tr>
                <td align="center" style="padding: 40px 40px 24px 40px;">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <!-- Blue rounded square -->
                        <div style="background-color: #555657ff; width: 56px; height: 56px; border-radius: 14px; margin: 0 auto;">
                          <table border="0" cellpadding="0" cellspacing="0" width="56" height="56">
                            <tr>
                              <td align="center" valign="middle">
                                <!-- Workshop Logo SVG: three rotated rounded rectangles -->
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="6" width="4.5" height="14" rx="2.25" transform="rotate(-15 3 6)" fill="white"/>
                                  <rect x="10.5" y="8" width="4.5" height="10" rx="2.25" transform="rotate(-15 10.5 8)" fill="white" opacity="0.82"/>
                                  <rect x="18" y="10" width="4.5" height="7" rx="2.25" transform="rotate(-15 18 10)" fill="white" opacity="0.6"/>
                                </svg>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <!-- Workshop wordmark -->
                        <div style="margin-top: 12px; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">Workshop</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 0 40px 40px 40px; text-align: center;">
                  <h1 style="margin: 0 0 12px 0; color: #0f172a; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Confirm your email</h1>
                  <p style="margin: 0 0 32px 0; color: #64748b; font-size: 16px; line-height: 1.6;">
                    To complete your sign-in to <strong style="color: #0f172a;">Workshop</strong>, please enter the 6-digit code below.
                  </p>

                  <!-- OTP Code -->
                  <div style="background-color: #f8faff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                    <span style="font-family: 'SF Mono', 'Roboto Mono', Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 0.25em; color: #3d68f5; margin-left: 0.25em;">${otp}</span>
                  </div>

                  <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
                    This code is valid for 5 minutes.
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
                    If you didn't request this, you can ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 32px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                  <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Workshop Limited</p>
                  <p style="margin: 0; color: #cbd5e1; font-size: 11px; line-height: 1.4;">
                    123 Innovation Drive, Suite 400, Tech Valley, CA 94043
                  </p>
                  <div style="margin-top: 16px;">
                    <a href="#" style="color: #3d68f5; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Privacy Policy</a>
                    <a href="#" style="color: #3d68f5; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Support Center</a>
                  </div>
                </td>
              </tr>
            </table>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;">
              <tr>
                <td style="padding: 24px 0; text-align: center;">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    Sent via Workshop Identity Service.
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
