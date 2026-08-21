import { Client, Receiver } from '@upstash/qstash'

const qstashToken = process.env.QSTASH_TOKEN
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
const qstashUrl = process.env.QSTASH_URL

console.log('[QSTASH] Initializing QStash Client & Receiver...', {
  hasToken: Boolean(qstashToken),
  hasCurrentKey: Boolean(currentSigningKey),
  hasNextKey: Boolean(nextSigningKey),
  url: qstashUrl || 'default'
})

export const qstash = new Client({
  token: qstashToken || 'dummy_token_dev',
  baseUrl: qstashUrl || undefined,
})

export const receiver = new Receiver({
  currentSigningKey: currentSigningKey || '',
  nextSigningKey: nextSigningKey || '',
})

/**
 * Express middleware to verify QStash cryptographic signatures on incoming webhooks.
 */
export async function verifyQStashSignature(req, res, next) {
  const signature = req.headers['upstash-signature'] || req.headers['Upstash-Signature']

  if (!signature) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[QSTASH AUTH] Development notice: Webhook request processed in development mode without Upstash-Signature header.')
      req.qstashVerified = true
      return next()
    }
    console.error('[QSTASH AUTH] Verification Failed: Missing Upstash-Signature header')
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Upstash-Signature header on QStash webhook endpoint'
    })
  }

  if (!currentSigningKey && !nextSigningKey) {
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

/**
 * Register a local step runner to execute workflow steps in local offline development
 * when QStash cloud cannot reach private loopback / localhost ports.
 */
export function setLocalStepRunner(fn) {
  localStepRunner = fn
}

/**
 * Helper to publish a workflow step event to QStash with automatic retries and exponential backoff.
 * 
 * @param {Object} payload - { runId, workflowId, step, test_company, test_value, ... }
 * @param {Object} [options] - { delay, retries, retryDelay, url }
 */
export async function publishWorkflowStep(payload, options = {}) {
  let backendBaseUrl = process.env.BACKEND_URL
  if (!backendBaseUrl) {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    if (vercelHost) {
      backendBaseUrl = vercelHost.startsWith('http') ? vercelHost : `https://${vercelHost}`
    }
  }
  if (!backendBaseUrl) {
    backendBaseUrl = 'http://localhost:5000'
  }

  const cleanBaseUrl = backendBaseUrl.endsWith('/') ? backendBaseUrl.slice(0, -1) : backendBaseUrl
  const targetUrl =
    options.url ||
    process.env.QSTASH_WEBHOOK_URL ||
    `${cleanBaseUrl}/api/workflows/qstash-callback`

  const delaySeconds = options.delay !== undefined ? options.delay : 1
  const retriesCount = options.retries !== undefined ? options.retries : 3
  const retryDelay = options.retryDelay || '5s'

  // Check if target URL is local / unroutable from QStash cloud
  const isLocalTarget =
    targetUrl.includes('localhost') ||
    targetUrl.includes('127.0.0.1') ||
    targetUrl.includes('::1') ||
    targetUrl.startsWith('http://localhost')

  // In local development or with local target URLs, use localStepRunner directly
  if (isLocalTarget || !process.env.QSTASH_TOKEN) {
    console.log('[WORKFLOW RUNNER] Executing local step runner for run #%s step %s in %ds (Local target)...', payload.runId, payload.step, delaySeconds)
    if (localStepRunner && typeof localStepRunner === 'function') {
      if (process.env.VERCEL) {
        localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
      } else {
        setTimeout(() => {
          localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
        }, Math.max(200, delaySeconds * 1000))
      }
    }
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
    if (localStepRunner && typeof localStepRunner === 'function') {
      if (process.env.VERCEL) {
        localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
      } else {
        setTimeout(() => {
          localStepRunner(payload).catch(e => console.error('[LOCAL STEP RUNNER ERROR]', e.message))
        }, Math.max(300, delaySeconds * 1000))
      }
    }

    return {
      local: true,
      scheduledLocalFallback: true,
      reason: 'CLOUD_PUBLISH_FALLBACK',
      message: err.message
    }
  }
}

export default qstash
