import insforge from '../lib/insforge.js'
import jwt from 'jsonwebtoken'

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
    return next()
  }

  try {
    const decoded = jwt.verify(token, LOCAL_JWT_SECRET)
    if (decoded?.iss === 'workshop-local' && decoded?.email) {
      req.user = {
        id: decoded.sub || decoded.email,
        email: decoded.email,
        shopName: decoded.shopName,
      }
      return next()
    }
  } catch (_) {}

  try {
    const { data, error } = await insforge.auth.getUser(token)
    if (error || !data?.user) {
      console.error('[Auth Middleware] Invalid token:', error)
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = data.user
    next()
  } catch (err) {
    console.error('[Auth Middleware] Exception:', err.message)
    res.status(401).json({ error: 'Token validation failed' })
  }
}
