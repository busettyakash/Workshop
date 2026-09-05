import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // High throughput limit for team operations
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // High throughput limit for multiple user/team logins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to auth endpoints, please try again later.' }
})

// Limiter for email/notification-sending routes
export const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // High limit for team emails
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many email requests. Please try again later.' }
})
