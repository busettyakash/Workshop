import insforge from '../lib/insforge.js'
import jwt from 'jsonwebtoken'
import { query, dbLocalStorage } from '../lib/db.js'
import redis from '../lib/redis.js'
import { getCached, setCached } from '../lib/fastCache.js'

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const LOCAL_JWT_SECRET =
  process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production'

const MOCK_DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'mock@example.com',
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Attempt to resolve a user object from a local (workshop-local) JWT.
 * Returns null if the token is not a local JWT or verification fails.
 */
function resolveLocalJwt(token) {
  try {
    const decoded = jwt.verify(token, LOCAL_JWT_SECRET)
    if (decoded?.iss === 'workshop-local' && decoded?.email) {
      return {
        id: decoded.sub || decoded.email,
        email: decoded.email,
        shopName: decoded.shopName,
      }
    }
  } catch {
    // Not a local JWT — fall through to InsForge verification
  }
  return null
}

/**
 * Verify token against InsForge auth service.
 * Returns { user } on success or throws on failure.
 */
async function resolveInsForgeToken(token) {
  const { data, error } = await insforge.auth.getUser(token)
  if (error || !data?.user) {
    console.error('[Auth Middleware] Invalid token:', error)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }
  return data.user
}

/**
 * Map an InsForge user ID to the local shop_profiles user_id (cached 1 h).
 * Mutates user.id in place if a local ID is found.
 */
async function mapLocalUserId(user) {
  try {
    const cacheKey = `user_id_map:${user.email.toLowerCase()}`
    let localUserId = await getCached(redis, cacheKey)

    if (!localUserId) {
      const profileRes = await query(
        'SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1)',
        [user.email]
      )
      if (profileRes.rows.length > 0 && profileRes.rows[0].user_id) {
        localUserId = profileRes.rows[0].user_id
        setCached(redis, cacheKey, localUserId, 3600)
      }
    }

    if (localUserId) user.id = localUserId
  } catch (err) {
    console.error('[Auth Middleware] Failed to map local user ID:', err.message)
  }
}

/**
 * Check whether the user account has been revoked or deleted.
 * Uses Redis blacklist first, then a cached 3-table existence check.
 * Returns an error response string if the user should be blocked, or null if OK.
 */
async function checkUserRevocation(email) {
  const emailLower = email.toLowerCase()

  // 1. Fast path: Redis revocation blacklist
  const isRevoked = await redis.get(`revoked_user:${emailLower}`).catch(() => null)
  if (isRevoked) {
    return 'Your account has been deleted or removed from the workspace.'
  }

  // 2. Cached DB existence check (5-min TTL)
  try {
    const existsCacheKey = `user_exists:${emailLower}`
    let userExistsFlag = await getCached(redis, existsCacheKey)

    if (userExistsFlag === null) {
      const userCheck = await query(
        `SELECT 1 FROM shop_profiles       WHERE LOWER(email)        = LOWER($1)
         UNION
         SELECT 1 FROM workspace_members   WHERE LOWER(member_email) = LOWER($1)
         LIMIT 1`,
        [emailLower]
      )
      userExistsFlag = userCheck.rows.length > 0 ? 'true' : 'false'
      setCached(redis, existsCacheKey, userExistsFlag, 300)
    }

    if (userExistsFlag === 'false') {
      return 'User account not found or has been deleted.'
    }
  } catch (err) {
    console.error('[Auth Middleware] User existence check failed:', err.message)
  }

  return null // user is valid
}

/**
 * Resolve workspace membership for cross-workspace access.
 * Attaches workspaceId, memberRole and memberPermissions to req.
 * Returns true if access is granted, false if forbidden.
 */
async function resolveWorkspaceMembership(req, res, requestedWorkspaceId, user) {
  const cacheKey = `ws_membership:${requestedWorkspaceId}:${user.email.toLowerCase()}`

  try {
    const cached = await getCached(redis, cacheKey)
    if (cached) {
      if (cached.granted) {
        req.workspaceId       = cached.resolvedOwnerId
        req.memberRole        = cached.role || 'Member'
        req.memberPermissions = cached.permissions || {}
        return { granted: true, resolvedOwnerId: cached.resolvedOwnerId }
      }
      return { granted: false }
    }

    const { rows } = await query(
      `SELECT m.workspace_owner_id, p.user_id AS owner_user_id, m.permissions, m.role
       FROM workspace_members m
       LEFT JOIN shop_profiles p
         ON p.user_id::text = m.workspace_owner_id
         OR LOWER(p.email) = LOWER(m.workspace_owner_id)
       WHERE (m.workspace_owner_id = $1 OR p.user_id::text = $1 OR LOWER(p.email) = LOWER($1))
         AND LOWER(m.member_email) = LOWER($2)
       LIMIT 1`,
      [requestedWorkspaceId, user.email]
    )

    if (rows.length > 0) {
      const resolvedOwnerId =
        rows[0].owner_user_id || rows[0].workspace_owner_id || requestedWorkspaceId
      req.workspaceId       = resolvedOwnerId
      req.memberRole        = rows[0].role || 'Member'
      req.memberPermissions = rows[0].permissions || {}
      setCached(redis, cacheKey, {
        granted: true,
        resolvedOwnerId,
        role: rows[0].role || 'Member',
        permissions: rows[0].permissions || {}
      }, 30)
      return { granted: true, resolvedOwnerId }
    }

    setCached(redis, cacheKey, { granted: false }, 15)
    return { granted: false }
  } catch (err) {
    console.error('[Auth Middleware] Workspace check exception:', err.message)
    throw err
  }
}

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────

/* Verify token and enforce workspace isolation on every protected request */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = auth.slice(7)

  // ── Mock dev bypass ──
  if (token === 'mock-dev-token') {
    req.user        = MOCK_DEV_USER
    req.workspaceId = MOCK_DEV_USER.id
    return dbLocalStorage.run(MOCK_DEV_USER.id, () => next())
  }

  // ── Token resolution: local JWT → InsForge fallback ──
  let user = resolveLocalJwt(token)
  if (!user) {
    try {
      user = await resolveInsForgeToken(token)
    } catch (err) {
      const status = err.statusCode || 500
      const msg    = status === 401 ? 'Unauthorized' : 'Token validation failed'
      console.error('[Auth Middleware] Exception:', err.message)
      return res.status(status).json({ error: msg })
    }
  }

  // ── Map to local user ID ──
  await mapLocalUserId(user)
  req.user = user

  // ── Revocation & deletion check ──
  if (user?.email) {
    const revokeReason = await checkUserRevocation(user.email)
    if (revokeReason) {
      return res.status(401).json({ error: revokeReason })
    }
  }

  // ── Workspace isolation ──
  const requestedWorkspaceId = req.headers['x-workspace-id']
  const isWorkspacesRoute    =
    req.path === '/workspaces' ||
    (req.originalUrl && req.originalUrl.includes('/auth/workspaces'))

  // Own workspace or listing workspaces — no further check needed
  if (
    isWorkspacesRoute ||
    !requestedWorkspaceId ||
    requestedWorkspaceId === 'undefined' ||
    requestedWorkspaceId === 'null' ||
    requestedWorkspaceId === user.id
  ) {
    req.workspaceId = user.id
    return dbLocalStorage.run(user.id, () => next())
  }

  // Cross-workspace membership check
  try {
    const { granted, resolvedOwnerId } = await resolveWorkspaceMembership(
      req, res, requestedWorkspaceId, user
    )
    if (granted) {
      return dbLocalStorage.run(resolvedOwnerId, () => next())
    }
    return res.status(403).json({ error: 'Forbidden: You do not have access to this workspace' })
  } catch {
    return res.status(500).json({ error: 'Internal server error checking workspace membership' })
  }
}
