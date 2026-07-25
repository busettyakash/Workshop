
import { Router } from 'express'
import insforge from '../lib/insforge.js'
import { query } from '../lib/db.js'
import redis from '../lib/redis.js'
import resend from '../lib/resend.js'
import { sendEmail } from '../lib/smtp.js'
import { getOtpTemplate, getPasswordResetOtpTemplate } from '../utils/emailTemplates.js'
import jwt from 'jsonwebtoken'
import { createHash, randomInt } from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimit.js'

// Fallback in-memory store if Redis fails
const memoryStore = new Map()
const pendingOtpSends = new Set()

const OTP_TTL_SECONDS = 300
const OTP_COOLDOWN_SECONDS = 60
const OTP_SEND_LOCK_SECONDS = 30

const router = Router()

/* Ensure workspace_members table exists */
const ensureWorkspaceTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id SERIAL PRIMARY KEY,
      workspace_owner_id TEXT NOT NULL,
      member_email TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (workspace_owner_id, member_email)
    )
  `).catch(err => console.error('[DB] Error ensuring workspace_members table:', err.message))

  await query(`
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS password TEXT;
  `).catch(err => console.error('[DB] Error ensuring password column on shop_profiles:', err.message))
}
ensureWorkspaceTable()


function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase()
}

function normalizeOtp(otp = '') {
  return String(otp).replace(/\D/g, '').slice(0, 6)
}

function generateOtp() {
  return randomInt(100000, 1000000).toString()
}

function getOtpKey(email) {
  return `otp:${email}`
}

function getCooldownKey(email) {
  return `otp_cooldown:${email}`
}

function getSendLockKey(email) {
  return `otp_send_lock:${email}`
}

function getMemoryValue(key) {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expires <= Date.now()) {
    memoryStore.delete(key)
    return null
  }
  return entry.value
}

async function hasOtpCooldown(email) {
  const cooldownKey = getCooldownKey(email)
  const redisCooldown = await redis.get(cooldownKey).catch(() => null)
  return Boolean(redisCooldown || getMemoryValue(cooldownKey))
}

async function acquireOtpSendLock(email) {
  const lockKey = getSendLockKey(email)
  try {
    const acquired = await redis.set(lockKey, '1', { nx: true, ex: OTP_SEND_LOCK_SECONDS })
    return acquired !== null && acquired !== false
  } catch {
    if (pendingOtpSends.has(email)) return false
    pendingOtpSends.add(email)
    return true
  }
}

async function releaseOtpSendLock(email) {
  pendingOtpSends.delete(email)
  await redis.del(getSendLockKey(email)).catch(() => { })
}

async function storeOtp(email, otp) {
  const otpKey = getOtpKey(email)
  try {
    await redis.set(otpKey, otp, { ex: OTP_TTL_SECONDS })
    memoryStore.set(otpKey, { value: otp, expires: Date.now() + OTP_TTL_SECONDS * 1000 })
  } catch (rErr) {
    console.error('[OTP] Redis failed, using memory fallback:', rErr.message)
    memoryStore.set(otpKey, { value: otp, expires: Date.now() + OTP_TTL_SECONDS * 1000 })
  }
}

async function setOtpCooldown(email) {
  const cooldownKey = getCooldownKey(email)
  try {
    await redis.set(cooldownKey, '1', { ex: OTP_COOLDOWN_SECONDS })
  } catch {
    memoryStore.set(cooldownKey, { value: '1', expires: Date.now() + OTP_COOLDOWN_SECONDS * 1000 })
  }
}

async function clearOtp(email) {
  await redis.del(getOtpKey(email)).catch(() => { })
  memoryStore.delete(getOtpKey(email))
}

async function sendOtpEmail(email, otp, logPrefix = 'OTP') {
  let userName = ''
  try {
    const profileRes = await query('SELECT shop_name FROM shop_profiles WHERE email = $1', [email])
    if (profileRes.rows[0]?.shop_name) {
      userName = profileRes.rows[0].shop_name
    }
  } catch {
    // Ignore profile lookup error, fallback to email prefix
  }

  if (!userName && email.includes('@')) {
    const prefix = email.split('@')[0]
    userName = prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const isReset = String(logPrefix).toUpperCase().includes('RESET')
  const subject = isReset
    ? `${otp} is your Workshop password reset code`
    : `${otp} is your Workshop verification code`
  const html = isReset
    ? getPasswordResetOtpTemplate(otp, email, userName)
    : getOtpTemplate(otp, email, userName)

  // 1. Prioritize SMTP if configured on Vercel / environment
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const smtpRes = await sendEmail({ to: email, subject, html })
      if (smtpRes && !smtpRes.error) {
        console.log('[%s SMTP Success] OTP email delivered to %s via SMTP', logPrefix, email)
        return { success: true, data: smtpRes.data }
      }
      console.warn('[%s SMTP Warning] Could not deliver via SMTP, attempting Resend:', logPrefix, smtpRes?.error?.message)
    } catch (smtpErr) {
      console.warn('[%s SMTP Exception] Error during SMTP send:', logPrefix, smtpErr.message)
    }
  }

  // 2. Resend API
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Workshop <onboarding@resend.dev>'

  try {
    const { data: mailData, error: mailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html
    })

    if (mailError) {
      console.error('[%s Resend Warning] Could not deliver email to %s:', logPrefix, email, mailError.message || mailError)

      // 3. Nodemailer / SMTP secondary attempt if not already tried
      if (!process.env.SMTP_HOST) {
        const smtpRes = await sendEmail({ to: email, subject, html }).catch(() => null)
        if (smtpRes && !smtpRes.error) {
          console.log('[%s SMTP Success] OTP email delivered to %s via SMTP', logPrefix, email)
          return { success: true, data: smtpRes.data }
        }
      }

      // 4. Dev / Sandbox mode fallback when Resend domain is unverified for this recipient
      console.log('==================================================')
      console.log(`🔑 [OTP DEV/SANDBOX FALLBACK] Verification code for ${email}: ${otp}`)
      console.log('==================================================')
      return { success: true, devFallback: true }
    }

    console.log('[%s Resend Success] Email sent to %s (%s) - ID:', logPrefix, email, userName, mailData?.id)
    return { success: true, data: mailData }
  } catch (err) {
    console.error('[%s Resend Exception] Could not send email to %s:', logPrefix, email, err.message)

    console.log('==================================================')
    console.log(`🔑 [OTP DEV/SANDBOX FALLBACK] Verification code for ${email}: ${otp}`)
    console.log('==================================================')
    return { success: true, devFallback: true }
  }
}

async function issueOtp(email, logPrefix = 'OTP') {
  if (await hasOtpCooldown(email)) {
    return {
      status: 429,
      body: { message: `Please wait ${OTP_COOLDOWN_SECONDS} seconds before requesting a new OTP.` }
    }
  }

  const lockAcquired = await acquireOtpSendLock(email)
  if (!lockAcquired) {
    return {
      status: 429,
      body: { message: 'An OTP is already being sent. Please wait a moment before trying again.' }
    }
  }

  const otp = generateOtp()
  try {
    await storeOtp(email, otp)

    const emailResult = await sendOtpEmail(email, otp, logPrefix)
    if (!emailResult.success) {
      await clearOtp(email)
      return { status: 502, body: { message: 'Failed to send OTP email. Please try again.' } }
    }

    console.log('[%s] OTP email accepted for %s', logPrefix, email)
    await setOtpCooldown(email)

    const body = { message: 'OTP sent to your email' }
    if (emailResult.devFallback) {
      body.devNotice = 'Testing mode active: OTP code logged in server console.'
    }
    return { status: 200, body }
  } catch (err) {
    console.error('[%s] Failed to store OTP:', logPrefix, err.message)
    return { status: 500, body: { message: 'Failed to generate OTP. Please try again.' } }
  } finally {
    await releaseOtpSendLock(email)
  }
}

function getLocalUserId(email = '') {
  const hash = createHash('md5').update(normalizeEmail(email)).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

/* GET /api/auth/check-email - Check if email is registered (used by login) */
router.post('/check-email', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    const result = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email. Please sign up first.' })
    }
    res.json({ exists: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
/* POST /api/auth/send-otp - For SIGNUP: check email DOES NOT exist THEN send OTP */
router.post('/send-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    // Check if email already exists
    const result = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (result.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' })
    }

    console.log('[OTP] Request for email: %s', email)
    const otpResult = await issueOtp(email, 'OTP')
    res.status(otpResult.status).json(otpResult.body)
  } catch (err) {
    console.error('[OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
  }
})

/* POST /api/auth/send-login-otp - For LOGIN: check email exists THEN send OTP */
router.post('/send-login-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    // Check if email is registered
    const result = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email. Please sign up first.' })
    }

    const otpResult = await issueOtp(email, 'LOGIN OTP')
    res.status(otpResult.status).json(otpResult.body)
  } catch (err) {
    console.error('[LOGIN OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
  }
})

/* POST /api/auth/send-reset-otp - For FORGOT PASSWORD: check email exists THEN send OTP */
router.post('/send-reset-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    const result = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email.' })
    }

    const otpResult = await issueOtp(email, 'RESET OTP')
    res.status(otpResult.status).json(otpResult.body)
  } catch (err) {
    console.error('[RESET OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
  }
})

/* POST /api/auth/reset-password - Verify OTP and update password */
router.post('/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const otp = normalizeOtp(req.body?.otp)
  const { newPassword } = req.body

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' })
  }

  try {
    let storedOtp = await redis.get(`otp:${email}`).catch(() => null)
    if (!storedOtp) {
      storedOtp = getMemoryValue(getOtpKey(email))
    }

    if (String(storedOtp) !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' })
    }

    // Clear OTP after successful check
    await clearOtp(email)

    // Update password in DB
    await query(
      'UPDATE shop_profiles SET password = $1 WHERE email = $2',
      [newPassword, email]
    )

    console.log('[RESET PASSWORD] Password updated successfully for %s', email)
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' })
  } catch (err) {
    console.error('[RESET PASSWORD] Error:', err.message)
    res.status(500).json({ message: 'Failed to reset password. Please try again.' })
  }
})


/* POST /api/auth/verify-otp */
router.post('/verify-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const otp = normalizeOtp(req.body?.otp)
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' })

  try {
    let storedOtp = await redis.get(`otp:${email}`).catch(() => null)

    // Check memory fallback if redis returned nothing
    if (!storedOtp) {
      storedOtp = getMemoryValue(getOtpKey(email))
    }

    console.log('[OTP VERIFY] Attempt for %s: input=%s, stored=%s', email, otp, storedOtp)

    if (String(storedOtp) === otp) {
      // Success - now delete
      await redis.del(`otp:${email}`).catch(() => { })
      memoryStore.delete(`otp:${email}`)
      res.json({ message: 'OTP verified successfully' })
    } else {
      res.status(400).json({ message: 'Invalid or expired OTP' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const { password, shopName, phone, mobileNumber, gstin, workspaceHandle, billingCountry, referralSource, usageType, inviteEmail } = req.body
  const actualPhone = phone || mobileNumber
  if (!email || !password || !shopName || !actualPhone || !gstin) {
    return res.status(400).json({ message: 'Email, password, shopName, phone, and GSTIN are required' })
  }
  if (gstin.trim().length !== 15) {
    return res.status(400).json({ message: 'GSTIN must be exactly 15 characters' })
  }
  try {
    const { data, error } = await insforge.auth.signUp({ email, password })
    if (error) {
      const msg = error.nextActions || error.error || error.message || 'Registration failed'

      // If the email exists in InsForge cloud, but not in our local DB (because it was cleared),
      // gracefully proceed to create the local profile to fix the deadlock.
      if (msg === 'AUTH_EMAIL_EXISTS' || msg.toLowerCase().includes('already registered')) {
        console.log(`[Register] User exists in InsForge Cloud but not locally. Proceeding to create local profile.`)
      } else {
        console.error('[Auth Error]', error)
        return res.status(400).json({ message: msg })
      }
    }

    const userId = data?.user?.id || getLocalUserId(email)

    // Store extra profile in DB with GSTIN and Workspace details
    await query(
      `INSERT INTO shop_profiles (email, user_id, shop_name, phone, gstin, workspace_handle, billing_country, referral_source, usage_type, password, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (email) DO UPDATE SET 
         user_id = COALESCE(shop_profiles.user_id, EXCLUDED.user_id),
         shop_name = EXCLUDED.shop_name, 
         phone = EXCLUDED.phone,
         gstin = COALESCE(EXCLUDED.gstin, shop_profiles.gstin),
         workspace_handle = COALESCE(shop_profiles.workspace_handle, EXCLUDED.workspace_handle),
         billing_country = COALESCE(shop_profiles.billing_country, EXCLUDED.billing_country),
         referral_source = COALESCE(shop_profiles.referral_source, EXCLUDED.referral_source),
         usage_type = COALESCE(shop_profiles.usage_type, EXCLUDED.usage_type)`,
      [
        email,
        userId,
        shopName,
        actualPhone || null,
        gstin || null,
        workspaceHandle || null,
        billingCountry || null,
        referralSource || null,
        usageType || null,
        password || null
      ]
    ).catch((err) => { console.error('DB Insert Error', err) })

    // Clear stale user ID mapping in Redis cache
    await redis.del(`user_id_map:${email.toLowerCase()}`).catch(() => { })

    // Generate local JWT token if InsForge signUp doesn't return one directly
    let token = data?.accessToken || data?.session?.access_token
    if (!token) {
      token = jwt.sign(
        { sub: userId, email, shopName, iss: 'workshop-local' },
        process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production',
        { expiresIn: '7d' }
      )
    }

    // Add initial teammate invite if provided
    if (inviteEmail) {
      const invited = normalizeEmail(inviteEmail)
      if (invited && invited !== email) {
        await query(
          `INSERT INTO workspace_members (workspace_owner_id, member_email, role)
           VALUES ($1, $2, 'Member')
           ON CONFLICT (workspace_owner_id, member_email) DO NOTHING`,
          [userId, invited]
        ).catch(err => console.error('Error adding initial invite:', err.message))
      }
    }

    // Check if this user was previously invited to another workspace
    // If so, return that workspace as the default so the frontend auto-switches
    let defaultWorkspaceId = null
    let defaultWorkspaceName = null
    try {
      const inviteResult = await query(
        `SELECT m.workspace_owner_id, p.shop_name, p.email AS owner_email
         FROM workspace_members m
         JOIN shop_profiles p ON p.user_id::text = m.workspace_owner_id OR p.email = m.workspace_owner_id
         WHERE LOWER(m.member_email) = LOWER($1)
         ORDER BY m.created_at ASC
         LIMIT 1`,
        [email]
      )
      if (inviteResult.rows.length > 0) {
        defaultWorkspaceId = inviteResult.rows[0].workspace_owner_id
        defaultWorkspaceName = inviteResult.rows[0].shop_name || `${inviteResult.rows[0].owner_email}'s Workshop`
        console.log(`[Register] User ${email} has pending invite → defaulting to workspace ${defaultWorkspaceId} (${defaultWorkspaceName})`)
      }
    } catch (invErr) {
      console.error('[Register] Error checking pending invites:', invErr.message)
    }
    const response = {
      message: 'Registration successful',
      user: { id: userId, email, shopName },
      token,
    }

    if (defaultWorkspaceId) {
      response.defaultWorkspaceId = defaultWorkspaceId
      response.defaultWorkspaceName = defaultWorkspaceName
    }

    res.status(201).json(response)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const { password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })

  try {
    await redis.del(`user_id_map:${email}`).catch(() => { })

    const profile = await query(
      'SELECT user_id, shop_name, password FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (profile.rows.length === 0) {
      return res.status(401).json({ message: 'No account found with this email. Please sign up first.' })
    }

    const shopName = profile.rows[0]?.shop_name || email.split('@')[0]
    const localUserId = profile.rows[0]?.user_id || getLocalUserId(email)
    const storedPassword = profile.rows[0]?.password

    const { data, error } = await insforge.auth.signInWithPassword({ email, password })
    let token = data?.session?.access_token || data?.accessToken
    let userId = localUserId || data?.user?.id || getLocalUserId(email)

    if (error) {
      if (storedPassword && password === storedPassword) {
        token = jwt.sign(
          { sub: localUserId, email, shopName, iss: 'workshop-local' },
          process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production',
          { expiresIn: '7d' }
        )
      } else {
        return res.status(401).json({ message: 'Invalid email or password.' })
      }
    }

    if (!token) {
      token = jwt.sign(
        { sub: userId, email, shopName, iss: 'workshop-local' },
        process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production',
        { expiresIn: '7d' }
      )
    }

    res.json({ token, user: { id: userId, email, shopName } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/logout */
router.post('/logout', async (req, res) => {
  try {
    await insforge.auth.signOut()
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/me */
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.slice(7)

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production'
    )

    if (decoded?.iss === 'workshop-local') {
      return res.json({
        user: {
          id: decoded.sub,
          email: decoded.email,
          shopName: decoded.shopName,
        },
      })
    }
  } catch { }

  try {
    const { data, error } = await insforge.auth.getUser(token)
    if (error) return res.status(401).json({ error: 'Unauthorized' })

    const profileRes = await query('SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1)', [data.user.email]).catch(() => ({ rows: [] }))
    if (profileRes.rows.length > 0) {
      data.user.id = profileRes.rows[0].user_id
    }

    res.json({ user: data.user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/invite - Invite a teammate to current user's workspace */
router.post('/invite', apiLimiter, requireAuth, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const role = req.body?.role || 'Member'
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (email === normalizeEmail(req.user.email)) {
    return res.status(400).json({ error: 'You cannot invite yourself' })
  }
  try {
    await query(
      `INSERT INTO workspace_members (workspace_owner_id, member_email, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_owner_id, member_email) 
       DO UPDATE SET role = EXCLUDED.role`,
      [req.workspaceId, email, role]
    )

    // Clear membership cache key
    const cacheKey = `workspace_member:${req.workspaceId}:${email}`
    await redis.del(cacheKey).catch(() => { })

    // ── Create in-app notification for user B ──────────────────────────────
    try {
      const profileRes = await query(
        `SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      )
      if (profileRes.rows.length > 0) {
        const userBId = profileRes.rows[0].user_id
        const senderName = req.user.shopName || req.user.email
        const notifTitle = `Workspace Invitation`
        const notifBody = `${senderName} has invited you to collaborate in their workspace as ${role}. Switch workspaces from the sidebar to get started.`

        await query(
          `INSERT INTO notifications (user_id, title, body, type, read, created_at)
           VALUES ($1, $2, $3, 'info', false, NOW())`,
          [userBId, notifTitle, notifBody]
        )

        // Push real-time notification to user B if they are online
        try {
          await insforge.realtime.publish(`notifications:${userBId}`, {
            event: 'new_notification',
            payload: { title: notifTitle, body: notifBody }
          })
        } catch {
          // Ignore realtime publish errors if client offline
        }

        console.log(`[Invite] In-app notification created for user B (${email})`)
      } else {
        console.log(`[Invite] User B (${email}) not yet registered — no in-app notification created`)
      }
    } catch (notifErr) {
      console.error('[Invite] Failed to create in-app notification:', notifErr.message)
    }
    // ──────────────────────────────────────────────────────────────────────

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const signupLink = `${frontendUrl}/signup?invite_from=${encodeURIComponent(req.user.email)}&workspace=${encodeURIComponent(req.user.shopName || 'Workshop')}`

      // Send invite email in the background to prevent blocking the response
      resend.emails.send({
        from: 'Workshop <onboarding@resend.dev>',
        to: email,
        subject: `Invitation to collaborate on ${req.user.shopName || 'Workshop'}`,
        html: `<p>Hello,</p>
               <p><strong>${req.user.email}</strong> has invited you to collaborate in their workspace: <strong>${req.user.shopName || 'Workshop'}</strong>.</p>
               <p>If you already have a Workshop account, log in and switch to their workspace via the workspace dropdown in the sidebar.</p>
               <p>If you're new, <a href="${signupLink}">click here to sign up</a> and you'll be automatically added to their workspace.</p>`
      }).then(({ error: mailErr }) => {
        if (mailErr) {
          console.error('[Invite Email] Resend background error:', mailErr.message || mailErr)
        } else {
          console.log(`[Invite Email] Background email sent to ${email}`)
        }
      }).catch(err => {
        console.error('[Invite Email] Background email error:', err.message)
      })
    } catch (mailErr) {
      console.error('[Invite Email] Resend error:', mailErr.message)
    }

    res.json({ message: `Successfully invited ${email}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/workspaces - Fetch workspaces accessible by current user */
router.get('/workspaces', apiLimiter, requireAuth, async (req, res) => {
  const email = normalizeEmail(req.user.email)
  try {
    const ownWs = await query(
      `SELECT user_id, shop_name, email FROM shop_profiles WHERE email = $1`,
      [email]
    )

    let workspaces = []
    if (ownWs.rows.length > 0) {
      const own = ownWs.rows[0]
      const ownerId = own.user_id || req.workspaceId
      workspaces.push({
        id: ownerId,
        shopName: own.shop_name || 'My Shop',
        ownerEmail: own.email,
        isOwner: true
      })
    } else {
      workspaces.push({
        id: req.workspaceId,
        shopName: req.user.shopName || 'My Shop',
        ownerEmail: email,
        isOwner: true
      })
    }

    const invitedWs = await query(
      `SELECT p.user_id, p.shop_name, p.email AS owner_email, m.role
       FROM workspace_members m
       JOIN shop_profiles p ON p.user_id::text = m.workspace_owner_id OR p.email = m.workspace_owner_id
       WHERE m.member_email = $1`,
      [email]
    )

    for (const row of invitedWs.rows) {
      workspaces.push({
        id: row.user_id || row.owner_email,
        shopName: row.shop_name || `${row.owner_email}'s Shop`,
        ownerEmail: row.owner_email,
        isOwner: false,
        role: row.role
      })
    }

    res.json(workspaces)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/members - Fetch members of current user's workspace */
router.get('/members', apiLimiter, requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, member_email, role, created_at FROM workspace_members WHERE workspace_owner_id = $1`,
      [req.workspaceId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/update-password - Change password from Settings (authenticated) */
router.post('/update-password', apiLimiter, requireAuth, async (req, res) => {
  const email = req.user?.email
  const { currentPassword, newPassword } = req.body

  if (!email) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' })
  }

  try {
    // Check current password from shop_profiles
    const profileRes = await query(
      'SELECT password FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    const storedPass = profileRes.rows[0]?.password
    let isPasswordValid = true

    if (storedPass) {
      if (storedPass !== currentPassword) {
        // Double-check with InsForge signInWithPassword
        try {
          const { error } = await insforge.auth.signInWithPassword({ email, password: currentPassword })
          if (error) isPasswordValid = false
        } catch {
          isPasswordValid = false
        }
      }
    }

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    // Update password in local DB
    await query(
      'UPDATE shop_profiles SET password = $1 WHERE LOWER(email) = LOWER($2)',
      [newPassword, email]
    )

    // Update in InsForge auth if configured
    try {
      await insforge.auth.updateUser({ password: newPassword }).catch(() => {})
    } catch (_) {}

    console.log('[UPDATE PASSWORD] Password updated successfully for %s', email)
    res.json({ message: 'Password updated successfully!' })
  } catch (err) {
    console.error('[UPDATE PASSWORD] Error updating password for %s:', email, err.message)
    res.status(500).json({ message: 'Failed to update password. Please try again.' })
  }
})

/* GET /api/auth/diagnostic - Diagnostic tool to check backend status */
router.get('/diagnostic', async (req, res) => {
  const status = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      INSFORGE_API_BASE_URL_SET: !!process.env.INSFORGE_API_BASE_URL,
      INSFORGE_API_KEY_SET: !!process.env.INSFORGE_API_KEY,
      UPSTASH_REDIS_REST_URL_SET: !!process.env.UPSTASH_REDIS_REST_URL,
      QSTASH_TOKEN_SET: !!process.env.QSTASH_TOKEN,
      SMTP_HOST_SET: !!process.env.SMTP_HOST,
      SMTP_USER_SET: !!process.env.SMTP_USER,
      SMTP_PASS_SET: !!process.env.SMTP_PASS,
    },
    database: null,
    redis: null,
    smtp: null,
  }

  // 1. Check Database
  try {
    const dbRes = await query('SELECT NOW()')
    status.database = { success: true, time: dbRes.rows[0].now }
  } catch (err) {
    status.database = { success: false, error: err.message }
  }

  // 2. Check Redis
  try {
    await redis.set('test_diagnostic_key', 'ok', { ex: 5 })
    const val = await redis.get('test_diagnostic_key')
    status.redis = { success: val === 'ok' }
  } catch (err) {
    status.redis = { success: false, error: err.message }
  }

  // 3. Check SMTP
  try {
    // Import transport to test connection verify
    await import('../lib/smtp.js')
    status.smtp = { success: true, details: 'Transporter loaded' }
  } catch (err) {
    status.smtp = { success: false, error: err.message }
  }

  res.json(status)
})

export default router
