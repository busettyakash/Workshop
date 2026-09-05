import { Client, Receiver } from '@upstash/qstash'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Initialize QStash API client and cryptographic signature receiver.
 */
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN || 'dummy-token-for-dev'
})

export const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || ''
})

/**
 * Express middleware to verify incoming QStash webhook cryptographic signatures.
 */
export async function verifyQStashSignature(req, res, next) {
  const signature = req.headers['upstash-signature']

  if (!signature) {
    if (process.env.NODE_ENV !== 'production') {
      req.qstashVerified = true
      return next()
    }
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Upstash-Signature header'
    })
  }

  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (!currentKey && !nextKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[QSTASH AUTH] Warning: QStash signing keys are missing in environment variables. Allowing in development mode.')
      req.qstashVerified = true
      return next()
    }
    console.error('[QSTASH AUTH] Signing keys not configured in production environment')
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'QStash signing keys are not configured'
    })
  }

  try {
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))

    const isValid = await receiver.verify({
      signature,
      body: rawBody,
    })

    if (!isValid) {
      console.error('[QSTASH AUTH] Signature verification returned false')
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid QStash cryptographic signature'
      })
    }

    req.qstashVerified = true
    next()
  } catch (err) {
    console.error('[QSTASH AUTH] Signature verification threw error:', err.message)
    return res.status(401).json({
      error: 'Unauthorized',
      message: `QStash signature verification failed: ${err.message}`
    })
  }
}

let localStepRunner = null

export function setLocalStepRunner(fn) {
  localStepRunner = fn
}

function resolveTargetUrl(optionsUrl) {
  if (optionsUrl) return optionsUrl
  if (process.env.QSTASH_WEBHOOK_URL) return process.env.QSTASH_WEBHOOK_URL

  let base = process.env.BACKEND_URL
  if (!base) {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    if (vercelHost) {
      base = vercelHost.startsWith('http') ? vercelHost : `https://${vercelHost}`
    }
  }
  if (!base) {
    base = 'http://localhost:5000'
  }
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${cleanBase}/api/workflows/qstash-callback`
}

function isLocalEndpoint(url) {
  return url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('::1') ||
    url.startsWith('http://localhost')
}

function runLocalStep(payload, delaySeconds) {
  if (!localStepRunner || typeof localStepRunner !== 'function') return

  if (process.env.VERCEL) {
    localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
  } else {
    setTimeout(() => {
      localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
    }, Math.max(200, delaySeconds * 1000))
  }
}

export async function publishWorkflowStep(payload, options = {}) {
  const targetUrl = resolveTargetUrl(options.url)
  const delaySeconds = options.delay !== undefined ? options.delay : 1
  const retriesCount = options.retries !== undefined ? options.retries : 3
  const retryDelay = options.retryDelay || '5s'

  if (isLocalEndpoint(targetUrl) || !process.env.QSTASH_TOKEN) {
    console.log('[WORKFLOW RUNNER] Executing local step runner for run #%s step %s in %ds (Local target)...', payload.runId, payload.step, delaySeconds)
    runLocalStep(payload, delaySeconds)
    return { local: true, scheduledLocalFallback: true, reason: 'LOCAL_TARGET' }
  }

  try {
    console.log('[QSTASH] Publishing message to %s for run #%s step %s (delay: %ds, retries: %d)', targetUrl, payload.runId, payload.step, delaySeconds, retriesCount)

    const result = await qstash.publishJSON({
      url: targetUrl,
      body: payload,
      delay: delaySeconds,
      retries: retriesCount,
      retryDelay,
      headers: {
        'x-workflow-run-id': String(payload.runId),
        'x-workflow-step': String(payload.step)
      }
    })

    console.log('[QSTASH] Successfully published step %s for run #%s. Message ID: %s', payload.step, payload.runId, result.messageId)
    return result
  } catch (err) {
    console.warn('[QSTASH LOCAL FALLBACK] Target publish failed for run #%s step %s: %s. Advancing via local runner...', payload.runId, payload.step, err.message)
    runLocalStep(payload, delaySeconds)
    return {
      local: true,
      scheduledLocalFallback: true,
      reason: 'CLOUD_PUBLISH_FALLBACK',
      message: err.message
    }
  }
}
