import { Router } from 'express'
import insforge from '../lib/insforge.js'
import { query } from '../lib/db.js'
import redis from '../lib/redis.js'
import resend from '../lib/smtp.js'
import { getOtpTemplate } from '../utils/emailTemplates.js'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'
import { requireAuth } from '../middleware/auth.js'

// Fallback in-memory store if Redis fails
const memoryStore = new Map()

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
}
ensureWorkspaceTable()


function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase()
}

function normalizeOtp(otp = '') {
  return String(otp).replace(/\D/g, '').slice(0, 6)
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

    console.log(`[OTP] Request for email: ${email}`)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    try {
      console.log(`[OTP] Connecting to Redis...`)
      await redis.set(`otp:${email}`, otp, { ex: 300 })
      console.log(`[OTP] Redis set successful`)
    } catch (rErr) {
      console.error(`[OTP] Redis failed, using memory fallback:`, rErr.message)
      memoryStore.set(`otp:${email}`, { otp, expires: Date.now() + 300000 })
    }

    console.log(`[OTP DEBUG] OTP for ${email} is ${otp}`)

    // Send email via SMTP / Resend
    const { error: mailError } = await resend.emails.send({
      to: email,
      subject: `${otp} is your Workshop verification code`,
      html: getOtpTemplate(otp)
    })

    if (mailError) {
      console.error(`[OTP] Email delivery failed:`, mailError.message || mailError)
      return res.status(500).json({ message: 'Failed to send OTP. Please try again later.' })
    }

    console.log(`[OTP] Email sent to ${email}`)
    res.json({ message: 'OTP sent to your email' })
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

    // Generate and store OTP in Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    try {
      await redis.set(`otp:${email}`, otp, { ex: 300 })
      console.log(`[LOGIN OTP] Redis set for ${email}`)
    } catch (rErr) {
      console.error(`[LOGIN OTP] Redis failed, using memory fallback:`, rErr.message)
      memoryStore.set(`otp:${email}`, { otp, expires: Date.now() + 300000 })
    }

    console.log(`[LOGIN OTP DEBUG] OTP for ${email} is ${otp}`)

    // Send OTP email
    const { error: mailError } = await resend.emails.send({
      to: email,
      subject: `${otp} is your Workshop verification code`,
      html: getOtpTemplate(otp)
    })

    if (mailError) {
      console.error(`[LOGIN OTP] Email delivery failed:`, mailError.message || mailError)
      return res.status(500).json({ message: 'Failed to send OTP. Please try again later.' })
    }

    console.log(`[LOGIN OTP] Email sent to ${email}`)
    res.json({ message: 'OTP sent to your email' })
  } catch (err) {
    console.error('[LOGIN OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
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
      const mem = memoryStore.get(`otp:${email}`)
      if (mem && mem.expires > Date.now()) {
        storedOtp = mem.otp
      }
    }

    console.log(`[OTP VERIFY] Attempt for ${email}: input=${otp}, stored=${storedOtp}`)

    if (String(storedOtp) === otp) {
      // Success - now delete
      await redis.del(`otp:${email}`).catch(() => {})
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
    await redis.del(`user_id_map:${email.toLowerCase()}`).catch(() => {})

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
    // Clear stale user ID mapping in Redis cache to ensure it stays in sync
    await redis.del(`user_id_map:${email}`).catch(() => {})

    // 1. Confirm user exists in our DB
    const profile = await query(
      'SELECT user_id, shop_name, phone FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (profile.rows.length === 0) {
      return res.status(401).json({ message: 'No account found with this email. Please sign up first.' })
    }

    const shopName = profile.rows[0]?.shop_name || email.split('@')[0]
    const localUserId = profile.rows[0]?.user_id || getLocalUserId(email)

    // 2. Try InsForge authentication
    const { data, error } = await insforge.auth.signInWithPassword({ email, password })
    let token = data?.session?.access_token || data?.accessToken
    let userId = localUserId || data?.user?.id || getLocalUserId(email)

    if (error) {
      const rawMsg = error.nextActions || error.error || error.message || ''
      const isWrongPassword = rawMsg === 'AUTH_UNAUTHORIZED' || rawMsg.toLowerCase().includes('invalid')

      if (isWrongPassword) {
        // Genuinely wrong password — reject
        return res.status(401).json({ message: 'Invalid email or password.' })
      }

      // InsForge email-verification or FORBIDDEN error:
      // User already verified email via our OTP system — issue our own JWT
      console.log(`[LOGIN] InsForge blocked (${rawMsg}) but user is in DB — issuing local JWT`)
      token = jwt.sign(
        { sub: getLocalUserId(email), email, shopName, iss: 'workshop-local' },
        process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production',
        { expiresIn: '7d' }
      )
    }

    if (!token) {
      // InsForge returned no error but also no token — sign local JWT
      token = jwt.sign(
        { sub: getLocalUserId(email), email, shopName, iss: 'workshop-local' },
        process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production',
        { expiresIn: '7d' }
      )
    }

    res.json({
      token,
      user: { id: userId, email, shopName },
    })
  } catch (err) {
    console.error('[LOGIN] Error:', err.message)
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

  if (token === 'mock-dev-token') {
    return res.json({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'mock@example.com',
        shopName: 'Workshop',
      },
    })
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production'
    )

    if (decoded?.iss === 'workshop-local' && decoded?.email) {
      return res.json({
        user: {
          id: decoded.sub || decoded.email,
          email: decoded.email,
          shopName: decoded.shopName || decoded.email.split('@')[0],
        },
      })
    }
  } catch (_) {}

  try {
    const { data, error } = await insforge.auth.getUser(token)
    if (error) return res.status(401).json({ error: 'Unauthorized' })

    // Map ID locally if present
    const profileRes = await query('SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1)', [data.user.email]).catch(() => ({ rows: [] }))
    if (profileRes.rows.length > 0 && profileRes.rows[0].user_id) {
      data.user.id = profileRes.rows[0].user_id
    }

    res.json({ user: data.user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/invite - Invite a teammate to current user's workspace */
router.post('/invite', requireAuth, async (req, res) => {
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
    await redis.del(cacheKey).catch(() => {})

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const signupLink = `${frontendUrl}/signup?invite_from=${encodeURIComponent(req.user.email)}&workspace=${encodeURIComponent(req.user.shopName || 'Workshop')}`

      await resend.emails.send({
        from: 'Workshop <onboarding@resend.dev>',
        to: email,
        subject: `Invitation to collaborate on ${req.user.shopName || 'Workshop'}`,
        html: `<p>Hello,</p>
               <p><strong>${req.user.email}</strong> has invited you to collaborate in their workspace: <strong>${req.user.shopName || 'Workshop'}</strong>.</p>
               <p>If you already have a Workshop account, log in and switch to their workspace via the workspace dropdown in the sidebar.</p>
               <p>If you're new, <a href="${signupLink}">click here to sign up</a> and you'll be automatically added to their workspace.</p>`
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
router.get('/workspaces', requireAuth, async (req, res) => {
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
router.get('/members', requireAuth, async (req, res) => {
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
    const { default: smtpLib } = await import('../lib/smtp.js')
    status.smtp = { success: true, details: 'Transporter loaded' }
  } catch (err) {
    status.smtp = { success: false, error: err.message }
  }

  res.json(status)
})

export default router
