import insforge from '../lib/insforge.js'
import jwt from 'jsonwebtoken'
import { query } from '../lib/db.js'
import redis from '../lib/redis.js'

const LOCAL_JWT_SECRET = process.env.JWT_SECRET || 'workshop_super_secret_jwt_key_change_in_production'

const MOCK_DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'mock@example.com',
}

/* ── Verify token via InsForge auth ── */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  const token = auth.slice(7)
  
  if (token === 'mock-dev-token') {
    req.user = MOCK_DEV_USER
    req.workspaceId = MOCK_DEV_USER.id
    return next()
  }

  let user = null

  try {
    const decoded = jwt.verify(token, LOCAL_JWT_SECRET)
    if (decoded?.iss === 'workshop-local' && decoded?.email) {
      user = {
        id: decoded.sub || decoded.email,
        email: decoded.email,
        shopName: decoded.shopName,
      }
    }
  } catch (_) {}

  if (!user) {
    try {
      const { data, error } = await insforge.auth.getUser(token)
      if (error || !data?.user) {
        console.error('[Auth Middleware] Invalid token:', error)
        return res.status(401).json({ error: 'Unauthorized' })
      }
      user = data.user
    } catch (err) {
      console.error('[Auth Middleware] Exception:', err.message)
      return res.status(401).json({ error: 'Token validation failed' })
    }
  }

  // Map InsForge user ID to local shop_profiles user_id if present
  try {
    const cacheKey = `user_id_map:${user.email.toLowerCase()}`
    let localUserId = await redis.get(cacheKey).catch(() => null)
    
    if (!localUserId) {
      const profileRes = await query('SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1)', [user.email])
      if (profileRes.rows.length > 0 && profileRes.rows[0].user_id) {
        localUserId = profileRes.rows[0].user_id
        await redis.set(cacheKey, localUserId, { ex: 3600 }).catch(() => {}) // Cache for 1 hour
      }
    }
    
    if (localUserId) {
      user.id = localUserId
    }
  } catch (dbErr) {
    console.error('[Auth Middleware] Failed to map local user ID:', dbErr.message)
  }

  req.user = user

  // Workspace isolation check
  const requestedWorkspaceId = req.headers['x-workspace-id']
  const isWorkspacesRoute = req.path === '/workspaces' || (req.originalUrl && req.originalUrl.includes('/auth/workspaces'))
  if (isWorkspacesRoute || !requestedWorkspaceId || requestedWorkspaceId === user.id) {
    req.workspaceId = user.id
    return next()
  }

  try {
    const cacheKey = `workspace_member:${requestedWorkspaceId}:${user.email.toLowerCase()}`
    let isMember = await redis.get(cacheKey).catch(() => null)

    if (isMember === null) {
      const { rows } = await query(
        'SELECT 1 FROM workspace_members WHERE workspace_owner_id = $1 AND LOWER(member_email) = LOWER($2)',
        [requestedWorkspaceId, user.email]
      )
      isMember = rows.length > 0 ? 'true' : 'false'
      await redis.set(cacheKey, isMember, { ex: 1800 }).catch(() => {}) // Cache for 30 minutes
    }

    if (isMember === 'true') {
      req.workspaceId = requestedWorkspaceId
      return next()
    } else {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this workspace' })
    }
  } catch (err) {
    console.error('[Auth Middleware] Workspace check exception:', err.message)
    return res.status(500).json({ error: 'Internal server error checking workspace membership' })
  }
}

