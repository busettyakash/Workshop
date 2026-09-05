import { Router }     from 'express'
import insforge       from '../lib/insforge.js'
import { query }      from '../lib/db.js'
import redis          from '../lib/redis.js'
import { deleteCached } from '../lib/fastCache.js'
import resend         from '../lib/resend.js'
import { sendEmail }  from '../lib/smtp.js'
import {
  getOtpTemplate,
  getPasswordResetOtpTemplate,
  getInviteEmailTemplate,
} from '../utils/emailTemplates.js'
import jwt            from 'jsonwebtoken'
import { createHash, randomInt } from 'node:crypto'
import { requireAuth }  from '../middleware/auth.js'
import { apiLimiter, authLimiter }   from '../middleware/rateLimit.js'

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const OTP_TTL_SECONDS       = 300
const OTP_COOLDOWN_SECONDS  = 60
const OTP_SEND_LOCK_SECONDS = 30
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

// ─────────────────────────────────────────────
//  In-memory fallback (used when Redis is down)
// ─────────────────────────────────────────────

const memoryStore    = new Map()   // OTP / cooldown values
const pendingOtpSends = new Set()  // send-lock fallback

// ─────────────────────────────────────────────
//  Router
// ─────────────────────────────────────────────

const router = Router()

// ─────────────────────────────────────────────
//  Schema bootstrap (runs once at startup)
// ─────────────────────────────────────────────

async function ensureWorkspaceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id SERIAL PRIMARY KEY,
      workspace_owner_id TEXT NOT NULL,
      member_email TEXT NOT NULL,
      role TEXT DEFAULT 'Member',
      permissions JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (workspace_owner_id, member_email)
    );
    ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
  `).catch(err => console.error('[DB] Error ensuring workspace_members table:', err.message))

  await query(`
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS password TEXT;
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS gstin VARCHAR(50);
    ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS address TEXT;
  `).catch(err => console.error('[DB] Error ensuring columns on shop_profiles:', err.message))
}

let ensureWorkspaceTablePromise
router.use(authLimiter)
router.use(async (_req, _res, next) => {
  try {
    ensureWorkspaceTablePromise ||= ensureWorkspaceTable().catch(err => {
      ensureWorkspaceTablePromise = null
      throw err
    })
    await ensureWorkspaceTablePromise
    next()
  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase()
}

function normalizeOtp(otp = '') {
  return String(otp).replace(/\D/g, '').slice(0, 6)
}

function generateOtp() {
  return randomInt(100000, 1000000).toString()
}

/** Derive a deterministic UUID-like local user ID from an email address */
function getLocalUserId(email = '') {
  const hash = createHash('sha256').update(normalizeEmail(email)).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

/** Sign a local workshop JWT for the given user payload */
function signLocalJwt(payload) {
  return jwt.sign({ ...payload, iss: 'workshop-local' }, JWT_SECRET, { expiresIn: '7d' })
}

// ─────────────────────────────────────────────
//  OTP storage helpers
// ─────────────────────────────────────────────

const getOtpKey      = email => `otp:${email}`
const getCooldownKey = email => `otp_cooldown:${email}`
const getSendLockKey = email => `otp_send_lock:${email}`

function getMemoryValue(key) {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expires <= Date.now()) {
    memoryStore.delete(key)
    return null
  }
  return entry.value
}

function setMemoryValue(key, value, ttlSeconds) {
  memoryStore.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
}

async function hasOtpCooldown(email) {
  const redisCooldown = await redis.get(getCooldownKey(email)).catch(() => null)
  return Boolean(redisCooldown || getMemoryValue(getCooldownKey(email)))
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
  await redis.del(getSendLockKey(email)).catch(() => {})
}

async function storeOtp(email, otp) {
  const key = getOtpKey(email)
  try {
    await redis.set(key, otp, { ex: OTP_TTL_SECONDS })
    setMemoryValue(key, otp, OTP_TTL_SECONDS)
  } catch (err) {
    console.error('[OTP] Redis failed, using memory fallback:', err.message)
    setMemoryValue(key, otp, OTP_TTL_SECONDS)
  }
}

async function setOtpCooldown(email) {
  try {
    await redis.set(getCooldownKey(email), '1', { ex: OTP_COOLDOWN_SECONDS })
  } catch {
    setMemoryValue(getCooldownKey(email), '1', OTP_COOLDOWN_SECONDS)
  }
}

async function clearOtp(email) {
  await redis.del(getOtpKey(email)).catch(() => {})
  memoryStore.delete(getOtpKey(email))
}

/** Read an OTP from Redis with a memory-store fallback */
async function readStoredOtp(email) {
  const fromRedis = await redis.get(getOtpKey(email)).catch(() => null)
  return fromRedis ?? getMemoryValue(getOtpKey(email))
}

// ─────────────────────────────────────────────
//  Email sending
// ─────────────────────────────────────────────

/** Resolve display name for OTP email from DB, falling back to email prefix */
async function resolveUserName(email) {
  try {
    const { rows } = await query(
      'SELECT shop_name FROM shop_profiles WHERE email = $1',
      [email]
    )
    if (rows[0]?.shop_name) return rows[0].shop_name
  } catch {
    // Ignore
  }
  if (email.includes('@')) {
    const prefix = email.split('@')[0]
    return prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  return ''
}

/** Attempt to deliver an email via SMTP. Returns { success, data? } or null on failure. */
async function trySendSmtp({ to, subject, html }) {
  try {
    const res = await sendEmail({ to, subject, html })
    if (res && !res.error) return { success: true, data: res.data }
    return null
  } catch {
    return null
  }
}

/** Attempt to deliver an email via Resend. Returns { success, data? } or null on failure. */
async function trySendResend({ to, subject, html, logPrefix }) {
  const from = process.env.RESEND_FROM_EMAIL || 'Workshop <onboarding@resend.dev>'
  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      console.error('[%s Resend Warning] Could not deliver:', logPrefix, error.message || error)
      return null
    }
    console.log('[%s Resend Success] Email sent - ID:', logPrefix, data?.id)
    return { success: true, data }
  } catch (err) {
    console.error('[%s Resend Exception] Could not send:', logPrefix, err.message)
    return null
  }
}

function logOtpDevFallback(_email, otp) {
  console.log('==================================================')
  console.log(`🔑 [OTP DEV/SANDBOX FALLBACK] Verification code: ${otp}`)
  console.log('==================================================')
}

/**
 * Send an OTP email via SMTP → Resend → dev console fallback chain.
 * Returns { success: true, devFallback?: true, data? }.
 */
async function sendOtpEmail(email, otp, logPrefix = 'OTP') {
  const userName = await resolveUserName(email)
  const isReset  = String(logPrefix).toUpperCase().includes('RESET')

  const subject = isReset
    ? `${otp} is your Workshop password reset code`
    : `${otp} is your Workshop verification code`
  const html = isReset
    ? getPasswordResetOtpTemplate(otp, email, userName)
    : getOtpTemplate(otp, email, userName)

  // 1. SMTP (primary if configured)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const smtpRes = await trySendSmtp({ to: email, subject, html })
    if (smtpRes) {
      console.log('[%s SMTP Success] OTP email delivered via SMTP', logPrefix)
      return smtpRes
    }
    console.warn('[%s SMTP Warning] Could not deliver via SMTP, attempting Resend', logPrefix)
  }

  // 2. Resend API
  const resendRes = await trySendResend({ to: email, subject, html, logPrefix })
  if (resendRes) return resendRes

  // 3. Secondary SMTP attempt (when SMTP was not configured above)
  if (!process.env.SMTP_HOST) {
    const smtpRes = await trySendSmtp({ to: email, subject, html })
    if (smtpRes) {
      console.log('[%s SMTP Success] OTP email delivered via SMTP', logPrefix)
      return smtpRes
    }
  }

  // 4. Dev / sandbox console fallback
  logOtpDevFallback(email, otp)
  return { success: true, devFallback: true }
}

/**
 * Generate, store, and dispatch an OTP for the given email.
 * Enforces cooldown and send-lock to prevent abuse.
 * Returns { status, body }.
 */
async function issueOtp(email, logPrefix = 'OTP') {
  if (await hasOtpCooldown(email)) {
    return {
      status: 429,
      body: { message: `Please wait ${OTP_COOLDOWN_SECONDS} seconds before requesting a new OTP.` },
    }
  }

  const lockAcquired = await acquireOtpSendLock(email)
  if (!lockAcquired) {
    return {
      status: 429,
      body: { message: 'An OTP is already being sent. Please wait a moment before trying again.' },
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

    console.log('[%s] OTP email accepted', logPrefix)
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

// ─────────────────────────────────────────────
//  Permission presets
// ─────────────────────────────────────────────

const MODULE_KEYS = [
  'dashboard', 'notes', 'emails', 'reports', 'workflows',
  'products', 'people', 'price_history', 'quotes', 'orders',
  'import_stock', 'profit_margin', 'billing', 'paid', 'unpaid', 'chats',
]

const FULL_ADMIN_PERMISSIONS = Object.fromEntries(
  MODULE_KEYS.map(k => [k, { read: true, edit: true, delete: true }])
)

const DEFAULT_MEMBER_PERMISSIONS = Object.fromEntries(
  MODULE_KEYS.map(k => [
    k,
    k === 'profit_margin'
      ? { read: false, edit: false, delete: false }
      : { read: true, edit: false, delete: false }
  ])
)

function resolvePermissions(role, permissions) {
  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    return permissions
  }
  return role === 'Admin' ? FULL_ADMIN_PERMISSIONS : DEFAULT_MEMBER_PERMISSIONS
}

// ─────────────────────────────────────────────
//  Login helpers
// ─────────────────────────────────────────────

async function resolveOwnWorkspace(email, userId, safeShopName) {
  const ownCheck = await query(
    'SELECT user_id, shop_name FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
    [email]
  ).catch(() => ({ rows: [] }))

  if (!ownCheck.rows.length) return null

  const row = ownCheck.rows[0]
  const activeWorkspaceName = (row.shop_name && String(row.shop_name).trim() !== 'null' && String(row.shop_name).trim() !== '')
    ? row.shop_name
    : safeShopName

  return {
    activeRole: 'Owner',
    activePermissions: null,
    activeWorkspaceId: row.user_id || userId,
    activeWorkspaceName
  }
}

async function resolveInvitedWorkspace(email) {
  const { rows } = await query(
    `SELECT m.workspace_owner_id, m.role, m.permissions, p.shop_name, p.email AS owner_email
     FROM workspace_members m
     LEFT JOIN shop_profiles p
       ON (p.user_id::text = m.workspace_owner_id OR LOWER(p.email) = LOWER(m.workspace_owner_id))
     WHERE LOWER(m.member_email) = LOWER($1)
     ORDER BY m.created_at ASC
     LIMIT 1`,
    [email]
  ).catch(() => ({ rows: [] }))

  if (!rows.length) return null

  const row = rows[0]
  let mPerms = row.permissions
  if (typeof mPerms === 'string') {
    try { mPerms = JSON.parse(mPerms) } catch { mPerms = {} }
  }

  const rawShop = row.shop_name
  const activeWorkspaceName = (rawShop && String(rawShop).trim() !== 'null' && String(rawShop).trim() !== '')
    ? rawShop
    : `${row.owner_email || 'Owner'}'s Shop`

  return {
    activeRole: row.role || 'Member',
    activePermissions: (mPerms && Object.keys(mPerms).length > 0) ? mPerms : DEFAULT_MEMBER_PERMISSIONS,
    activeWorkspaceId: row.workspace_owner_id,
    activeWorkspaceName
  }
}

/**
 * Resolve the active workspace role/permissions for a user at login time.
 * Returns workspace metadata from user's own workspace if owned, or first invited workspace.
 */
async function resolveLoginWorkspace(email, userId, shopName) {
  const safeShopName = (shopName && String(shopName).trim() !== 'null' && String(shopName).trim() !== '')
    ? shopName
    : `${email.split('@')[0]}'s Workshop`

  try {
    const ownWorkspace = await resolveOwnWorkspace(email, userId, safeShopName)
    if (ownWorkspace) return ownWorkspace

    const invitedWorkspace = await resolveInvitedWorkspace(email)
    if (invitedWorkspace) return invitedWorkspace
  } catch (err) {
    console.error('[Login] Error resolving initial workspace role:', err.message)
  }

  return {
    activeRole: 'Owner',
    activePermissions: null,
    activeWorkspaceId: userId,
    activeWorkspaceName: safeShopName
  }
}

// ─────────────────────────────────────────────
//  Invite email helpers
// ─────────────────────────────────────────────

/** Deliver invite email directly via SMTP (Nodemailer) */
async function dispatchInviteEmail({ to, subject, html }) {
  try {
    const smtpRes = await sendEmail({ to, subject, html })
    if (smtpRes && !smtpRes.error) {
      console.log('[Invite Email] Delivered via SMTP')
      return { success: true, method: 'smtp' }
    }
    console.error('[Invite Email] SMTP delivery error:', smtpRes?.error?.message)
    return { success: false, error: smtpRes?.error?.message }
  } catch (err) {
    console.error('[Invite Email] SMTP exception:', err.message)
    return { success: false, error: err.message }
  }
}

/** Create an in-app notification and push a real-time event to user B on invite */
async function notifyInvitedUser({ inviteeEmail, senderName, role }) {
  try {
    const { rows } = await query(
      'SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [inviteeEmail]
    )
    if (rows.length === 0) {
      console.log('[Invite] Invitee user not yet registered — skipping in-app notification')
      return
    }

    const userBId    = rows[0].user_id
    const notifTitle = 'Workspace Invitation'
    const notifBody  = `${senderName} has invited you to collaborate in their workspace as ${role}. Switch workspaces from the sidebar to get started.`

    await query(
      `INSERT INTO notifications (user_id, title, body, type, read, created_at)
       VALUES ($1, $2, $3, 'info', false, NOW())`,
      [userBId, notifTitle, notifBody]
    )

    try {
      await insforge.realtime.publish(`notifications:${userBId}`, {
        event: 'new_notification',
        payload: { title: notifTitle, body: notifBody },
      })
    } catch {
      // Ignore realtime publish errors — user may be offline
    }

    console.log('[Invite] In-app notification created for invited user')
  } catch (err) {
    console.error('[Invite] Failed to create in-app notification:', err.message)
  }
}

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

/* POST /api/auth/check-email — Check if email is already registered (used by login UI) */
router.post('/check-email', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    const { rows } = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email. Please sign up first.' })
    }
    res.json({ exists: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/send-otp — Signup flow: email must NOT exist, then send OTP */
router.post('/send-otp', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    const { rows } = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' })
    }

    console.log('[OTP] Request initiated')
    const result = await issueOtp(email, 'OTP')
    res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
  }
})

/* POST /api/auth/send-reset-otp — Forgot-password flow: email must exist, then send OTP */
router.post('/send-reset-otp', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ message: 'Email is required' })

  try {
    const { rows } = await query(
      'SELECT email FROM shop_profiles WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }))

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email.' })
    }

    const result = await issueOtp(email, 'RESET OTP')
    res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[RESET OTP] Unexpected error:', err.message)
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
  }
})

/* POST /api/auth/reset-password — Verify OTP and persist a new password */
router.post('/reset-password', authLimiter, async (req, res) => {
  const email       = normalizeEmail(req.body?.email)
  const otp         = normalizeOtp(req.body?.otp)
  const { newPassword } = req.body

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' })
  }

  try {
    const storedOtp = await readStoredOtp(email)
    if (String(storedOtp) !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' })
    }

    await clearOtp(email)
    await query('UPDATE shop_profiles SET password = $1 WHERE email = $2', [newPassword, email])

    console.log('[RESET PASSWORD] Password updated successfully')
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' })
  } catch (err) {
    console.error('[RESET PASSWORD] Error:', err.message)
    res.status(500).json({ message: 'Failed to reset password. Please try again.' })
  }
})

/* POST /api/auth/verify-otp — Verify a signup OTP without consuming it (consumed on register) */
router.post('/verify-otp', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const otp   = normalizeOtp(req.body?.otp)
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' })

  try {
    const storedOtp = await readStoredOtp(email)
    console.log('[OTP VERIFY] Processing OTP verification attempt')

    if (String(storedOtp) === otp) {
      await clearOtp(email)
      res.json({ message: 'OTP verified successfully' })
    } else {
      res.status(400).json({ message: 'Invalid or expired OTP' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/register — Create a new account (owner or invited member) */
async function checkIsInviteUser(body, email) {
  let isInvite = Boolean(body?.isInvite || body?.inviteFrom || body?.invite_from)
  if (!isInvite && email) {
    try {
      const { rows } = await query(
        'SELECT id FROM workspace_members WHERE LOWER(member_email) = LOWER($1) LIMIT 1',
        [email]
      )
      if (rows.length > 0) isInvite = true
    } catch { /* ignore */ }
  }
  return isInvite
}

function normalizeRegistrationFields(body, email) {
  const actualFirstName = (body?.firstName || body?.first_name || (email ? email.split('@')[0] : '') || 'User').trim()
  const actualLastName  = (body?.lastName  || body?.last_name  || 'Account').trim()
  const actualPhone     = (body?.phone || body?.mobileNumber || '').trim()
  const actualGstin     = (body?.gstin || '').trim()
  const actualShopName  = (body?.shopName || body?.companyName || body?.workspaceHandle || `${actualFirstName}'s Workshop`).trim()

  return {
    actualFirstName,
    actualLastName,
    actualPhone,
    actualGstin,
    actualShopName
  }
}

function validateRegistrationFields(email, password, fields, isInvite) {
  if (!email || !password) {
    return 'Email and password are required'
  }
  if (!isInvite) {
    if (!fields.actualFirstName || !fields.actualLastName || !fields.actualPhone || !fields.actualGstin) {
      return 'First name, Last name, Email, password, phone, and GSTIN are required'
    }
    if (fields.actualGstin.length !== 15) {
      return 'GSTIN must be exactly 15 characters'
    }
  }
  return null
}

async function resolveDefaultPendingWorkspace(email) {
  try {
    const { rows } = await query(
      `SELECT m.workspace_owner_id, p.shop_name, p.email AS owner_email
       FROM workspace_members m
       JOIN shop_profiles p
         ON p.user_id::text = m.workspace_owner_id OR p.email = m.workspace_owner_id
       WHERE LOWER(m.member_email) = LOWER($1)
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [email]
    )
    if (rows.length > 0) {
      return {
        defaultWorkspaceId: rows[0].workspace_owner_id,
        defaultWorkspaceName: rows[0].shop_name || `${rows[0].owner_email}'s Workshop`
      }
    }
  } catch (err) {
    console.error('[Register] Error checking pending invites:', err.message)
  }
  return { defaultWorkspaceId: null, defaultWorkspaceName: null }
}

router.post('/register', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const {
    password, workspaceHandle, billingCountry, referralSource, usageType, inviteEmail, gstin
  } = req.body

  const isInvite = await checkIsInviteUser(req.body, email)
  const fields = normalizeRegistrationFields(req.body, email)
  const validationError = validateRegistrationFields(email, password, fields, isInvite)
  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  const { actualFirstName, actualLastName, actualPhone, actualGstin, actualShopName } = fields

  try {
    let insforgeData = null
    try {
      const { data, error } = await insforge.auth.signUp({ email, password })
      if (error) {
        const msg = error.nextActions || error.error || error.message || 'Registration failed'
        if (msg === 'AUTH_EMAIL_EXISTS' || msg.toLowerCase().includes('already registered')) {
          console.log('[Register] User exists in InsForge Cloud but not locally. Proceeding to create local profile.')
        } else {
          console.warn('[InsForge Auth Notice]', msg)
        }
      }
      insforgeData = data
    } catch (authErr) {
      console.warn('[InsForge Auth Network Notice] Cloud signup skipped/offline, using local DB:', authErr.message)
    }

    const userId = insforgeData?.user?.id || getLocalUserId(email)

    // Persist local profile
    await query(
      `INSERT INTO shop_profiles
         (email, user_id, shop_name, first_name, last_name, phone, gstin,
          workspace_handle, billing_country, referral_source, usage_type, password, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (email) DO UPDATE SET
         user_id           = COALESCE(shop_profiles.user_id, EXCLUDED.user_id),
         shop_name         = EXCLUDED.shop_name,
         first_name        = COALESCE(EXCLUDED.first_name, shop_profiles.first_name),
         last_name         = COALESCE(EXCLUDED.last_name,  shop_profiles.last_name),
         phone             = EXCLUDED.phone,
         gstin             = COALESCE(EXCLUDED.gstin, shop_profiles.gstin),
         workspace_handle  = COALESCE(shop_profiles.workspace_handle, EXCLUDED.workspace_handle),
         billing_country   = COALESCE(shop_profiles.billing_country,  EXCLUDED.billing_country),
         referral_source   = COALESCE(shop_profiles.referral_source,  EXCLUDED.referral_source),
         usage_type        = COALESCE(shop_profiles.usage_type,        EXCLUDED.usage_type)`,
      [
        email, userId, actualShopName, actualFirstName, actualLastName,
        actualPhone || null, actualGstin || null, workspaceHandle || null,
        billingCountry || null, referralSource || null, usageType || null, password || null,
      ]
    ).catch(err => console.error('DB Insert Error', err))

    // Clear stale user ID mapping and revocation flags
    await redis.del(`user_id_map:${email.toLowerCase()}`).catch(() => {})
    await redis.del(`revoked_user:${email.toLowerCase()}`).catch(() => {})
    deleteCached(redis, `user_exists:${email.toLowerCase()}`)

    // Issue JWT
    const token = signLocalJwt({ sub: userId, email, shopName: actualShopName, firstName: actualFirstName, lastName: actualLastName })

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

    const { defaultWorkspaceId, defaultWorkspaceName } = await resolveDefaultPendingWorkspace(email)

    const response = {
      message: 'Registration successful',
      token,
      user: {
        id: userId, email, shopName: actualShopName,
        firstName: actualFirstName, lastName: actualLastName,
        first_name: actualFirstName, last_name: actualLastName,
        phone: actualPhone, gstin,
      },
    }
    if (defaultWorkspaceId) {
      response.defaultWorkspaceId   = defaultWorkspaceId
      response.defaultWorkspaceName = defaultWorkspaceName
    }

    // Resolve workspace role & permissions so the frontend can store them on first join
    // (same logic as the login endpoint — avoids needing a page refresh for permissions)
    const wsInfo = await resolveLoginWorkspace(email, userId, actualShopName)
    response.activeRole          = wsInfo.activeRole
    response.activePermissions   = wsInfo.activePermissions
    response.activeWorkspaceId   = wsInfo.activeWorkspaceId
    response.activeWorkspaceName = wsInfo.activeWorkspaceName

    res.status(201).json(response)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/login — Authenticate and return a session token */
router.post('/login', authLimiter, async (req, res) => {
  const email    = normalizeEmail(req.body?.email)
  const { password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })

  try {
    const profile = await query(
      'SELECT user_id, shop_name, first_name, last_name, phone, gstin, password FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
      [email]
    ).catch(() => ({ rows: [] }))

    if (profile.rows.length === 0) {
      return res.status(401).json({ message: 'No account found with this email. Please sign up first.' })
    }

    const prof           = profile.rows[0]
    const shopName       = prof.shop_name   || email.split('@')[0]
    const firstName      = prof.first_name  || ''
    const lastName       = prof.last_name   || ''
    const phoneVal       = prof.phone       || ''
    const gstinVal       = prof.gstin       || ''
    const localUserId    = prof.user_id     || getLocalUserId(email)
    const storedPassword = prof.password

    let token  = null
    let userId = localUserId

    // ── Fast path: local password check (avoids remote InsForge round-trip) ──
    if (storedPassword && password === storedPassword) {
      token = signLocalJwt({ sub: localUserId, email, shopName, firstName, lastName })
    } else {
      // ── Fallback: verify via InsForge auth service ──
      try {
        const { data, error } = await insforge.auth.signInWithPassword({ email, password })
        if (error) {
          return res.status(401).json({ message: 'Invalid email or password.' })
        }
        userId = localUserId || data?.user?.id || getLocalUserId(email)
        token  = signLocalJwt({ sub: userId, email, shopName, firstName, lastName })

        // Cache the verified password locally so all future logins skip the remote network trip
        if (password) {
          query(
            'UPDATE shop_profiles SET password = $1 WHERE LOWER(email) = LOWER($2)',
            [password, email]
          ).catch(err => console.warn('[Auth Password Cache Notice]', err.message))
        }
      } catch (authErr) {
        console.warn('[InsForge Auth SignIn Notice]', authErr.message)
        return res.status(401).json({ message: 'Invalid email or password.' })
      }
    }

    // Ensure we always have a token
    if (!token) {
      token = signLocalJwt({ sub: userId, email, shopName, firstName, lastName })
    }

    // Always clear revocation blacklist and existence cache on successful login
    await redis.del(`revoked_user:${email.toLowerCase()}`).catch(() => {})
    deleteCached(redis, `user_exists:${email.toLowerCase()}`)

    const { activeRole, activePermissions, activeWorkspaceId, activeWorkspaceName } =
      await resolveLoginWorkspace(email, userId, shopName)

    res.json({
      token,
      activeRole,
      activePermissions,
      activeWorkspaceId,
      activeWorkspaceName,
      user: {
        id: userId, email, shopName, firstName, lastName,
        first_name: firstName, last_name: lastName,
        phone: phoneVal, gstin: gstinVal,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/logout */
router.post('/logout', authLimiter, async (req, res) => {
  try {
    await insforge.auth.signOut()
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/me — Return current user profile from token */
router.get('/me', authLimiter, async (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.slice(7)

  const PROFILE_COLS = 'SELECT user_id, shop_name, first_name, last_name, phone, gstin FROM shop_profiles WHERE LOWER(email) = LOWER($1)'

  // Try local JWT first (fastest)
  try {
    const decoded    = jwt.verify(token, JWT_SECRET)
    const { rows }   = await query(PROFILE_COLS, [decoded.email || '']).catch(() => ({ rows: [] }))
    const p          = rows[0] || {}
    return res.json({
      user: {
        id:        p.user_id       || decoded.sub,
        email:     decoded.email,
        shopName:  p.shop_name     || decoded.shopName  || 'My Shop',
        firstName: p.first_name    || decoded.firstName || '',
        lastName:  p.last_name     || decoded.lastName  || '',
        first_name: p.first_name   || decoded.firstName || '',
        last_name:  p.last_name    || decoded.lastName  || '',
        phone:     p.phone         || '',
        gstin:     p.gstin         || '',
      },
    })
  } catch { /* not a local JWT — fall through */ }

  // Fallback to InsForge token verification
  try {
    const { data, error } = await insforge.auth.getUser(token)
    if (error) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await query(PROFILE_COLS, [data.user.email]).catch(() => ({ rows: [] }))
    const p        = rows[0] || {}
    res.json({
      user: {
        ...data.user,
        id:        p.user_id    || data.user.id,
        shopName:  p.shop_name  || 'My Shop',
        firstName: p.first_name || '',
        lastName:  p.last_name  || '',
        first_name: p.first_name || '',
        last_name:  p.last_name  || '',
        phone:     p.phone      || '',
        gstin:     p.gstin      || '',
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/invite — Invite a teammate to the current user's workspace */
router.post('/invite', apiLimiter, requireAuth, async (req, res) => {
  const email       = normalizeEmail(req.body?.email)
  const role        = req.body?.role || 'Member'
  const permissions = req.body?.permissions || null

  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (email === normalizeEmail(req.user.email)) {
    return res.status(400).json({ error: 'You cannot invite yourself' })
  }

  const finalPermissions = resolvePermissions(role, permissions)

  try {
    await query(
      `INSERT INTO workspace_members (workspace_owner_id, member_email, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_owner_id, member_email)
       DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions`,
      [req.workspaceId, email, role, JSON.stringify(finalPermissions)]
    )

    // Invalidate membership cache and clear any revocation flags
    await redis.del(`workspace_member:${req.workspaceId}:${email}`).catch(() => {})
    await redis.del(`revoked_user:${email.toLowerCase()}`).catch(() => {})
    deleteCached(redis, `user_exists:${email.toLowerCase()}`)

    // In-app notification
    await notifyInvitedUser({
      inviteeEmail: email,
      senderName:   req.user.shopName || req.user.email,
      role,
    })

    // Resolve frontend URL dynamically from request origin so Preview links point to the actual preview deployment
    const reqOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null)
    let frontendUrl = reqOrigin
    if (!frontendUrl || (frontendUrl.includes('localhost') && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost'))) {
      frontendUrl = process.env.FRONTEND_URL
    }
    if (!frontendUrl && process.env.VERCEL_URL) {
      frontendUrl = `https://${process.env.VERCEL_URL}`
    }
    if (!frontendUrl) {
      frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    }

    const signupLink   = `${frontendUrl}/signup?invite_email=${encodeURIComponent(email)}&email=${encodeURIComponent(email)}&invite_from=${encodeURIComponent(req.user.email)}&workspace=${encodeURIComponent(req.user.shopName || 'Workshop')}`
    const subject      = `Invitation to collaborate on ${req.user.shopName || 'Workshop'}`
    const html         = getInviteEmailTemplate({
      inviteeEmail:  email,
      inviterEmail:  req.user.email,
      workspaceName: req.user.shopName || 'Workshop',
      role,
      signupLink,
    })

    // Await delivery so serverless (Vercel Lambda) does NOT freeze before the email is sent
    const emailResult = await dispatchInviteEmail({ to: email, subject, html }).catch(err => {
      console.error('[Invite Email] Error during invitation email dispatch:', err.message)
      return { success: false, error: err.message }
    })

    res.json({
      message: `Successfully invited ${email}`,
      emailSent: emailResult?.success !== false,
      signupLink
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/workspaces — Fetch all workspaces accessible by the current user */
router.get('/workspaces', apiLimiter, requireAuth, async (req, res) => {
  const email = normalizeEmail(req.user.email)
  try {
    const workspaces = []

    // 1. Own workspace (always prioritized first)
    const ownWs = await query(
      'SELECT user_id, shop_name, email FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    if (ownWs.rows.length > 0) {
      const own = ownWs.rows[0]
      const ownUserId = own.user_id || req.workspaceId
      const safeOwnShop = (own.shop_name && String(own.shop_name).trim() !== 'null' && String(own.shop_name).trim() !== '')
        ? own.shop_name
        : (req.user?.shopName || 'My Shop')

      workspaces.push({
        id:         ownUserId,
        shopName:   safeOwnShop,
        ownerEmail: own.email || email,
        isOwner:    true,
        role:       'Owner',
      })
    } else {
      workspaces.push({
        id:         req.workspaceId,
        shopName:   req.user?.shopName || 'My Shop',
        ownerEmail: email,
        isOwner:    true,
        role:       'Owner',
      })
    }

    // 2. Invited workspaces
    const { rows: invitedRows } = await query(
      `SELECT p.user_id, p.shop_name, p.email AS owner_email, m.role, m.permissions
       FROM workspace_members m
       JOIN shop_profiles p ON p.user_id::text = m.workspace_owner_id OR p.email = m.workspace_owner_id
       WHERE LOWER(m.member_email) = LOWER($1)
       ORDER BY m.created_at ASC`,
      [email]
    )

    for (const row of invitedRows) {
      const rawShop = row.shop_name
      const safeShop = (rawShop && String(rawShop).trim() !== 'null' && String(rawShop).trim() !== '')
        ? rawShop
        : `${row.owner_email || 'Owner'}'s Shop`

      workspaces.push({
        id:          row.user_id || row.owner_email,
        shopName:    safeShop,
        ownerEmail:  row.owner_email,
        isOwner:     false,
        role:        row.role || 'Member',
        permissions: row.permissions || {},
      })
    }

    res.json(workspaces)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/auth/members — Fetch all members of the current workspace */
router.get('/members', apiLimiter, requireAuth, async (req, res) => {
  try {
    // Fetch workspace owner details
    const ownerRes = await query(
      `SELECT user_id, email, shop_name, created_at
       FROM shop_profiles
       WHERE user_id::text = $1 OR LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)`,
      [req.workspaceId, req.user?.email || '']
    )

    let membersList = []
    let ownerEmail  = req.user?.email

    if (ownerRes.rows.length > 0) {
      const owner = ownerRes.rows[0]
      ownerEmail  = owner.email
      membersList.push({
        id:           `owner-${owner.user_id || owner.email}`,
        member_email: owner.email,
        role:         'Admin',
        isOwner:      true,
        permissions:  FULL_ADMIN_PERMISSIONS,
        created_at:   owner.created_at || new Date().toISOString(),
      })
    } else if (req.user?.email) {
      membersList.push({
        id:           `owner-${req.workspaceId}`,
        member_email: req.user.email,
        role:         'Admin',
        isOwner:      true,
        permissions:  FULL_ADMIN_PERMISSIONS,
        created_at:   new Date().toISOString(),
      })
    }

    // Fetch invited members
    const { rows } = await query(
      `SELECT id, member_email, role, permissions, created_at
       FROM workspace_members
       WHERE workspace_owner_id = $1
          OR workspace_owner_id = $2
          OR LOWER(workspace_owner_id) = LOWER($3)
          OR workspace_owner_id IN (SELECT user_id::text FROM shop_profiles WHERE LOWER(email) = LOWER($3))
       ORDER BY id ASC`,
      [req.workspaceId, String(req.user?.id || ''), String(ownerEmail || '')]
    )

    const ownerEmails = new Set(membersList.map(m => m.member_email?.toLowerCase()))
    const invitedMembers = rows
      .filter(r => !ownerEmails.has(r.member_email?.toLowerCase()))
      .map(r => {
        let perms = r.permissions
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms) } catch { perms = {} }
        }
        return { ...r, permissions: perms || {} }
      })

    membersList = membersList.concat(invitedMembers)
    res.json(membersList)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/auth/members/:id/permissions — Update a member's role and permissions */
router.put('/members/:id/permissions', apiLimiter, requireAuth, async (req, res) => {
  const memberId = String(req.params.id || '').trim()
  const { role, permissions } = req.body

  if (!memberId) return res.status(400).json({ error: 'Member ID is required' })

  const workspaceFilter = `(
    workspace_owner_id = $4
    OR workspace_owner_id = $5
    OR LOWER(workspace_owner_id) = LOWER($6)
    OR workspace_owner_id IN (SELECT user_id::text FROM shop_profiles WHERE LOWER(email) = LOWER($6))
  )`

  try {
    const { rows } = await query(
      `UPDATE workspace_members
       SET role        = COALESCE($1, role),
           permissions = COALESCE($2::jsonb, permissions)
       WHERE (id::text = $3 OR LOWER(member_email) = LOWER($3))
         AND ${workspaceFilter}
       RETURNING id, member_email, role, permissions, created_at`,
      [
        role || null,
        permissions ? JSON.stringify(permissions) : null,
        memberId,
        req.workspaceId,
        String(req.user?.id || ''),
        String(req.user?.email || '')
      ]
    )

    if (rows.length === 0) {
      // Fallback: try updating by memberId or email directly
      const { rows: fallbackRows } = await query(
        `UPDATE workspace_members
         SET role        = COALESCE($1, role),
             permissions = COALESCE($2::jsonb, permissions)
         WHERE id::text = $3 OR LOWER(member_email) = LOWER($3)
         RETURNING id, member_email, role, permissions, created_at`,
        [role || null, permissions ? JSON.stringify(permissions) : null, memberId]
      )

      const finalMember = fallbackRows[0]
      if (finalMember?.member_email) {
        deleteCached(redis, `ws_membership:${req.workspaceId}:${finalMember.member_email.toLowerCase()}`)
      }
      return res.json({ message: 'Permissions updated successfully', member: finalMember })
    }

    const finalMember = rows[0]
    if (finalMember?.member_email) {
      deleteCached(redis, `ws_membership:${req.workspaceId}:${finalMember.member_email.toLowerCase()}`)
    }
    res.json({ message: 'Permissions updated successfully', member: finalMember })
  } catch (err) {
    console.error('[MEMBER PERMISSIONS ERROR]', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/auth/members/:id — Permanently remove a member from workspace and auth tables */
router.delete('/members/:id', apiLimiter, requireAuth, async (req, res) => {
  const memberId = String(req.params.id || '').trim()
  if (!memberId) return res.status(400).json({ error: 'Member ID or email is required' })

  const workspaceFilter = `(
    workspace_owner_id = $2
    OR workspace_owner_id = $3
    OR LOWER(workspace_owner_id) = LOWER($4)
    OR workspace_owner_id IN (SELECT user_id::text FROM shop_profiles WHERE LOWER(email) = LOWER($4))
  )`

  try {
    // 1. Fetch member details before deletion
    const { rows: memberRows } = await query(
      `SELECT id, member_email FROM workspace_members
       WHERE (id::text = $1 OR LOWER(member_email) = LOWER($1))
         AND ${workspaceFilter}`,
      [memberId, req.workspaceId, String(req.user?.id || ''), String(req.user?.email || '')]
    )

    let targetEmail = null
    if (memberRows.length > 0 && memberRows[0].member_email) {
      targetEmail = memberRows[0].member_email.toLowerCase()
    } else if (memberId.includes('@')) {
      targetEmail = memberId.toLowerCase()
    }

    // Safety: cannot delete yourself
    if (targetEmail && targetEmail === normalizeEmail(req.user.email)) {
      return res.status(400).json({ error: 'You cannot delete yourself from the workspace' })
    }

    // 2. Delete workspace_members row
    const { rowCount } = await query(
      `DELETE FROM workspace_members
       WHERE (id::text = $1 OR LOWER(member_email) = LOWER($1))
         AND ${workspaceFilter}`,
      [memberId, req.workspaceId, String(req.user?.id || ''), String(req.user?.email || '')]
    )

    if (rowCount === 0) {
      // Fallback: delete by id or email without workspace filter
      await query(
        'DELETE FROM workspace_members WHERE (id::text = $1 OR LOWER(member_email) = LOWER($1))',
        [memberId]
      )
    }

    // 3. Purge from auth tables and shop_profiles
    if (targetEmail) {
      try {
        await query(
          'DELETE FROM auth.user_providers WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1))',
          [targetEmail]
        )
        await query('DELETE FROM auth.email_otps WHERE LOWER(email) = LOWER($1)', [targetEmail])
        await query(
          'DELETE FROM notifications WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1))',
          [targetEmail]
        )
        await query('DELETE FROM shop_profiles WHERE LOWER(email) = LOWER($1)', [targetEmail])
        const { rowCount: authCount } = await query(
          'DELETE FROM auth.users WHERE LOWER(email) = LOWER($1)',
          [targetEmail]
        )
        console.log(`[AUTH CLEANUP] Deleted user from auth.users (${authCount} rows)`)
      } catch (err) {
        console.error('[AUTH CLEANUP ERROR]', err.message)
      }

      // 4. Invalidate Redis cache and blacklist the revoked user
      await redis.set(`revoked_user:${targetEmail}`, 'true', { ex: 604800 }).catch(() => {})
      await redis.del(`workspace_member:${req.workspaceId}:${targetEmail}`).catch(() => {})
      if (req.user?.id)    await redis.del(`workspace_member:${req.user.id}:${targetEmail}`).catch(() => {})
      if (req.user?.email) await redis.del(`workspace_member:${req.user.email.toLowerCase()}:${targetEmail}`).catch(() => {})
      await redis.del(`user_id_map:${targetEmail}`).catch(() => {})
    }

    console.log('[DATABASE] Member permanently deleted from workspace and Authentication')
    res.json({ message: 'Member permanently deleted from workspace and Authentication' })
  } catch (err) {
    console.error('[MEMBER DELETE DATABASE ERROR]', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/auth/update-password — Change password from Settings (authenticated) */
router.post('/update-password', apiLimiter, requireAuth, async (req, res) => {
  const email = req.user?.email
  const { currentPassword, newPassword } = req.body

  if (!email)                              return res.status(401).json({ message: 'Unauthorized' })
  if (!currentPassword || !newPassword)    return res.status(400).json({ message: 'Current password and new password are required' })
  if (newPassword.length < 6)             return res.status(400).json({ message: 'New password must be at least 6 characters long' })

  try {
    const { rows } = await query(
      'SELECT password FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    const storedPass = rows[0]?.password
    let isPasswordValid = true

    if (storedPass && storedPass !== currentPassword) {
      // Double-check via InsForge if local password doesn't match
      try {
        const { error } = await insforge.auth.signInWithPassword({ email, password: currentPassword })
        if (error) isPasswordValid = false
      } catch {
        isPasswordValid = false
      }
    }

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    await query(
      'UPDATE shop_profiles SET password = $1 WHERE LOWER(email) = LOWER($2)',
      [newPassword, email]
    )

    // Sync to InsForge auth if available
    await insforge.auth.updateUser({ password: newPassword }).catch(() => {})

    console.log('[UPDATE PASSWORD] Password updated successfully')
    res.json({ message: 'Password updated successfully!' })
  } catch (err) {
    console.error('[UPDATE PASSWORD] Error updating password:', err.message)
    res.status(500).json({ message: 'Failed to update password. Please try again.' })
  }
})

/* GET /api/auth/diagnostic — Health check for backend services */
router.get('/diagnostic', async (req, res) => {
  const status = {
    env: {
      NODE_ENV:                    process.env.NODE_ENV,
      DATABASE_URL_SET:            !!process.env.DATABASE_URL,
      INSFORGE_API_BASE_URL_SET:   !!process.env.INSFORGE_API_BASE_URL,
      INSFORGE_API_KEY_SET:        !!process.env.INSFORGE_API_KEY,
      UPSTASH_REDIS_REST_URL_SET:  !!process.env.UPSTASH_REDIS_REST_URL,
      QSTASH_TOKEN_SET:            !!process.env.QSTASH_TOKEN,
      SMTP_HOST_SET:               !!process.env.SMTP_HOST,
      SMTP_USER_SET:               !!process.env.SMTP_USER,
      SMTP_PASS_SET:               !!process.env.SMTP_PASS,
    },
    database: null,
    redis:    null,
    smtp:     null,
  }

  // 1. Database
  try {
    const { rows } = await query('SELECT NOW()')
    status.database = { success: true, time: rows[0].now }
  } catch (err) {
    status.database = { success: false, error: err.message }
  }

  // 2. Redis
  try {
    await redis.set('test_diagnostic_key', 'ok', { ex: 5 })
    const val    = await redis.get('test_diagnostic_key')
    status.redis = { success: val === 'ok' }
  } catch (err) {
    status.redis = { success: false, error: err.message }
  }

  // 3. SMTP
  try {
    await import('../lib/smtp.js')
    status.smtp = { success: true, details: 'Transporter loaded' }
  } catch (err) {
    status.smtp = { success: false, error: err.message }
  }

  res.json(status)
})

/* GET /api/auth/profile — Fetch full profile and workspace role for the logged-in user */
router.get('/profile', apiLimiter, requireAuth, async (req, res) => {
  try {
    const email = req.user?.email
    if (!email) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await query(
      'SELECT user_id, shop_name, email, first_name, last_name, phone, gstin, address FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    let role        = 'Owner'
    let permissions = null
    if (req.workspaceId) {
      const { rows: memRows } = await query(
        'SELECT role, permissions FROM workspace_members WHERE workspace_owner_id = $1 AND LOWER(member_email) = LOWER($2)',
        [req.workspaceId, email]
      )
      if (memRows.length > 0) {
        role        = memRows[0].role        || 'Member'
        permissions = memRows[0].permissions || {}
      }
    }

    if (rows.length === 0) {
      return res.json({
        email,
        firstName:  req.user?.firstName || req.user?.name?.split(' ')[0]              || '',
        lastName:   req.user?.lastName  || req.user?.name?.split(' ').slice(1).join(' ') || '',
        shopName:   req.user?.shopName  || '',
        phone: '', gstin: '', address: '',
        role, permissions,
      })
    }

    const row = rows[0]
    res.json({
      userId:     row.user_id,
      email:      row.email,
      firstName:  row.first_name || req.user?.firstName || req.user?.name?.split(' ')[0]              || '',
      lastName:   row.last_name  || req.user?.lastName  || req.user?.name?.split(' ').slice(1).join(' ') || '',
      shopName:   row.shop_name  || req.user?.shopName  || '',
      phone:      row.phone      || '',
      gstin:      row.gstin      || '',
      address:    row.address    || '',
      role, permissions,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/auth/profile — Update name / email fields */
router.put('/profile', apiLimiter, requireAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' })

    const { firstName, lastName, email } = req.body
    await query(
      `UPDATE shop_profiles
       SET first_name = $1, last_name = $2, email = COALESCE($3, email)
       WHERE LOWER(email) = LOWER($4)`,
      [firstName, lastName, email, userEmail]
    )

    res.json({ message: 'Profile details saved successfully!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/auth/workspace — Update workspace / shop details */
router.put('/workspace', apiLimiter, requireAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized' })

    const { shopName, phone, gstin, address } = req.body
    await query(
      `UPDATE shop_profiles
       SET shop_name = $1, phone = $2, gstin = $3, address = $4
       WHERE LOWER(email) = LOWER($5)`,
      [shopName, phone, gstin, address, userEmail]
    )

    res.json({ message: 'Workspace details saved successfully!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
