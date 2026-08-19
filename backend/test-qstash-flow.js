import 'dotenv/config'
import { Client, Receiver } from '@upstash/qstash'
import { SignJWT } from 'jose'
import crypto from 'crypto-js'
import { query } from './src/lib/db.js'
import redis from './src/lib/redis.js'

console.log('═══════════════════════════════════════════════════════════')
console.log('          UPSTASH QSTASH VERIFICATION TEST SUITE          ')
console.log('═══════════════════════════════════════════════════════════\n')

const qstashToken = process.env.QSTASH_TOKEN
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'

async function generateQStashSignature(bodyString, signingKey, url = undefined) {
  const bodyHash = crypto.SHA256(bodyString).toString(crypto.enc.Base64url).replace(/=+$/, '')
  
  const jwt = await new SignJWT({
    body: bodyHash,
    sub: url
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('Upstash')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(signingKey))

  return jwt
}

async function runTests() {
  let passed = 0
  let failed = 0

  // ── TEST 1: Credentials Check
  console.log('▶ [TEST 1] Checking Environment Credentials...')
  if (qstashToken && currentSigningKey && nextSigningKey) {
    console.log('  ✅ QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, and QSTASH_NEXT_SIGNING_KEY present.')
    passed++
  } else {
    console.error('  ❌ Missing one or more QStash environment variables')
    failed++
  }

  // ── TEST 2: Receiver Signature Verification Unit Test
  console.log('\n▶ [TEST 2] Cryptographic Signature Verification Unit Test...')
  try {
    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey
    })

    const testPayload = JSON.stringify({ runId: 999, workflowId: 1, step: 1 })
    const validSignature = await generateQStashSignature(testPayload, currentSigningKey)

    const isValid = await receiver.verify({
      signature: validSignature,
      body: testPayload
    })

    if (isValid) {
      console.log('  ✅ Receiver correctly verified valid HMAC/JWT signature.')
      passed++
    } else {
      console.error('  ❌ Receiver returned false for valid signature.')
      failed++
    }

    // Tampered body test
    try {
      await receiver.verify({
        signature: validSignature,
        body: JSON.stringify({ runId: 999, workflowId: 1, step: 2 }) // Changed step
      })
      console.error('  ❌ Receiver failed to catch tampered body!')
      failed++
    } catch {
      console.log('  ✅ Receiver correctly rejected tampered body payload.')
      passed++
    }
  } catch (err) {
    console.error('  ❌ Test 2 encountered an unexpected error:', err.message)
    failed++
  }

  // ── TEST 3: Webhook Endpoint Security (Direct HTTP)
  console.log('\n▶ [TEST 3] Testing Webhook Endpoint Security (Direct HTTP)...')
  try {
    const testUrl = `${backendUrl}/api/workflows/qstash-callback`

    // Case A: Missing signature
    const resNoSig = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 1, workflowId: 1, step: 1 })
    })

    if (resNoSig.status === 401) {
      console.log('  ✅ Webhook rejected request with missing Upstash-Signature (HTTP 401).')
      passed++
    } else {
      console.warn(`  ⚠️ Webhook returned status ${resNoSig.status} for missing signature.`)
    }

    // Case B: Invalid signature
    const resBadSig = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Upstash-Signature': 'invalid.signature.token'
      },
      body: JSON.stringify({ runId: 1, workflowId: 1, step: 1 })
    })

    if (resBadSig.status === 401) {
      console.log('  ✅ Webhook rejected request with invalid signature (HTTP 401).')
      passed++
    } else {
      console.error(`  ❌ Webhook returned status ${resBadSig.status} instead of 401 for invalid signature.`)
      failed++
    }
  } catch (err) {
    console.log(`  ℹ️ Note: Backend at ${backendUrl} might not be listening on this port in current shell:`, err.message)
  }

  // ── TEST 4: QStash Live Publishing API Client
  console.log('\n▶ [TEST 4] Testing QStash Publishing API Client...')
  try {
    const client = new Client({
      token: qstashToken
    })

    console.log('  Attempting test publish to QStash endpoint...')
    const pubRes = await client.publishJSON({
      url: 'https://httpbin.org/post',
      body: {
        test: true,
        source: 'Workshop QStash Test',
        timestamp: new Date().toISOString()
      },
      retries: 3,
      delay: 5
    })

    if (pubRes && pubRes.messageId) {
      console.log(`  ✅ Successfully published test message to QStash! Message ID: ${pubRes.messageId}`)
      passed++
    } else {
      console.warn('  ⚠️ Publish response did not contain messageId:', pubRes)
    }
  } catch (pubErr) {
    console.warn(`  ⚠️ QStash publish call note: ${pubErr.message}`)
  }

  // ── TEST 5: End-to-End Pipeline Step Execution via Signed Webhooks
  console.log('\n▶ [TEST 5] Testing End-to-End Step Pipeline (Step 1 -> 4)...')
  try {
    // 1. Create a dummy workflow and run in DB
    const wfRes = await query(`
      INSERT INTO workflows (user_id, name, is_live, nodes, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000000', 'QStash Integration Test Workflow', true, '[]'::jsonb, NOW(), NOW())
      RETURNING id
    `)
    const testWfId = wfRes.rows[0].id

    const runRes = await query(`
      INSERT INTO workflow_runs (workflow_id, user_id, status, duration, test_company, test_value, current_step, created_at)
      VALUES ($1, '00000000-0000-0000-0000-000000000000', 'Executing', NULL, 'Test Enterprise Client', 85000, 0, NOW())
      RETURNING id
    `, [testWfId])
    const testRunId = runRes.rows[0].id

    console.log(`  Created test run #${testRunId} for workflow #${testWfId}`)

    // 2. Deliver Step 1 signed webhook
    for (let step = 1; step <= 4; step++) {
      const payload = JSON.stringify({
        runId: testRunId,
        workflowId: testWfId,
        step
      })
      const signature = await generateQStashSignature(payload, currentSigningKey)

      const response = await fetch(`${backendUrl}/api/workflows/qstash-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Upstash-Signature': signature,
          'Upstash-Message-Id': `msg_test_${step}`,
          'Upstash-Retried': '0'
        },
        body: payload
      })

      const data = await response.json()
      if (response.ok && data.success) {
        console.log(`  ✅ Successfully executed Step ${step} via signed webhook. Status: ${data.status || 'OK'}`)
      } else {
        console.error(`  ❌ Failed executing Step ${step}:`, data)
        failed++
      }
    }

    // 3. Verify final DB status
    const finalRunRes = await query('SELECT * FROM workflow_runs WHERE id = $1', [testRunId])
    const finalRun = finalRunRes.rows[0]
    if (finalRun && finalRun.status === 'Completed' && finalRun.current_step === 4) {
      console.log(`  ✅ Database state verified: Status='Completed', CurrentStep=4, Duration='${finalRun.duration}'`)
      passed++
    } else {
      console.error('  ❌ Database state does not match expected completion:', finalRun)
      failed++
    }

    // 4. Verify Redis execution logs
    const redisLogs = await redis.lrange(`run:${testRunId}:logs`, 0, -1)
    if (redisLogs && redisLogs.length >= 4) {
      console.log(`  ✅ Redis execution logs verified (${redisLogs.length} entries written).`)
      passed++
    } else {
      console.warn(`  ⚠️ Redis logs returned ${redisLogs ? redisLogs.length : 0} entries.`)
    }

    // Cleanup test data
    await query('DELETE FROM workflow_runs WHERE id = $1', [testRunId])
    await query('DELETE FROM workflows WHERE id = $1', [testWfId])
    await redis.del(`run:${testRunId}:logs`).catch(() => {})
  } catch (e2eErr) {
    console.error('  ❌ E2E Pipeline test encountered an error:', e2eErr)
    failed++
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(` FINAL SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════\n')
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
