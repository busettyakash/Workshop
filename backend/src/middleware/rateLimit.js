import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // High throughput limit for team operations
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests, please try again later.',
    error: 'Too many requests, please try again later.',
  },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development or loopback
    if (process.env.NODE_ENV === 'development') return true
    if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') return true
    // Do not rate-limit GET requests like session checks (/auth/me)
    if (req.method === 'GET') return true
    return false
  },
  message: {
    message: 'Too many requests to auth endpoints, please try again later.',
    error: 'Too many requests to auth endpoints, please try again later.',
  },
})

// Limiter for email/notification-sending routes
export const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // High limit for team emails
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many email requests. Please try again later.',
    error: 'Too many email requests. Please try again later.',
  },
})
