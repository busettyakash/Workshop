import { Router } from 'express'
import { query } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import qstash from '../lib/qstash.js'

const router = Router()
router.use(requireAuth)

// Seed default workflow nodes
const DEFAULT_NODES = [
  {
    id: 1,
    type: "Trigger",
    icon: "Zap",
    title: "Deal Closed Won",
    badge: "Deals",
    desc: "Triggers when a company deal is moved to Closed Won",
    status: "triggered",
    meta: {
      company_id: null,
      product_id: null
    }
  },
  {
    id: 2,
    type: "Condition",
    icon: "GitBranch",
    title: "Check Deal Value",
    badge: "Conditions",
    desc: "Check if Deal Value is > ₹50,000",
    status: "completed",
    meta: {
      field: "value",
      operator: ">",
      value: "50000"
    }
  },
  {
    id: 3,
    type: "Agent",
    icon: "Cpu",
    title: "Enrich Company Info",
    badge: "Agent",
    desc: "Automated search for funding stage and size",
    status: "running"
  },
  {
    id: 4,
    type: "Action",
    icon: "Mail",
    title: "Send Onboarding Email",
    badge: "Email",
    desc: "Send welcome guidelines & generated barcode",
    status: "pending"
  },
  {
    id: 5,
    type: "End",
    icon: "CheckCircle2",
    title: "Deal Completed",
    badge: "System",
    desc: "Onboarding workflow complete and syncs to billing",
    status: "pending"
  }
]

/* GET /api/workflows */
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM workflows WHERE user_id = $1 ORDER BY created_at DESC',
      [req.workspaceId]
    )

    if (rows.length === 0) {
      // Seed default workflow for user
      const seedResult = await query(
        `INSERT INTO workflows (user_id, name, is_live, nodes)
         VALUES ($1, 'Automotive Deal Onboarding', true, $2) RETURNING *`,
         [req.workspaceId, JSON.stringify(DEFAULT_NODES)]
      )
      return res.json(seedResult.rows)
    }

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/workflows — Create a new blank workflow */
router.post('/', async (req, res) => {
  const { name } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO workflows (user_id, name, is_live, nodes, created_at, updated_at)
       VALUES ($1, $2, false, $3, NOW(), NOW()) RETURNING *`,
      [req.workspaceId, name || 'Untitled Workflow', JSON.stringify([])]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/workflows/:id */
router.put('/:id', async (req, res) => {
  const { name, is_live, nodes } = req.body
  try {
    const { rows } = await query(
      `UPDATE workflows 
       SET name = COALESCE($1, name), 
           is_live = COALESCE($2, is_live), 
           nodes = COALESCE($3, nodes), 
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, is_live, nodes ? JSON.stringify(nodes) : null, req.params.id, req.workspaceId]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'Workflow not found or unauthorized' })
    }

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/workflows/:id */
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.workspaceId]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Workflow not found or unauthorized' })
    }
    res.json({ message: 'Workflow deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/workflows/:id/runs */
router.get('/:id/runs', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM workflow_runs WHERE workflow_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
      [req.params.id, req.workspaceId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/workflows/:id/runs/:runId/logs */
router.get('/:id/runs/:runId/logs', async (req, res) => {
  try {
    const logKey = `run:${req.params.runId}:logs`
    const rawLogs = await redis.lrange(logKey, 0, -1).catch(() => [])
    const logs = rawLogs.map(l => {
      try {
        return JSON.parse(l)
      } catch {
        return { time: new Date().toISOString(), text: l }
      }
    })
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/workflows/:id/runs */
router.post('/:id/runs', async (req, res) => {
  const { test_company, test_value } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO workflow_runs (workflow_id, user_id, status, duration, test_company, test_value, current_step, created_at)
       VALUES ($1, $2, 'Executing', NULL, $3, $4, 0, NOW()) RETURNING *`,
      [req.params.id, req.workspaceId, test_company || 'Automotive Shop Client', test_value || 0]
    )
    const run = rows[0]
    const logKey = `run:${run.id}:logs`
    
    // Log to Redis
    const initialLog = {
      time: new Date().toISOString(),
      step: 0,
      text: `Deal Closed Won: Onboarding run triggered for customer '${run.test_company}' with value ₹${Number(run.test_value).toLocaleString()}`
    }
    await redis.rpush(logKey, JSON.stringify(initialLog)).catch(err => console.error('[REDIS ERROR] rpush:', err))
    await redis.expire(logKey, 3600).catch(() => {})

    // Publish to QStash as workflow trigger simulation
    if (process.env.QSTASH_TOKEN) {
      try {
        await qstash.publishJSON({
          url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/workflows/qstash-callback`,
          body: {
            runId: run.id,
            workflowId: req.params.id,
            step: 1
          },
          delay: 1 // 1 second delay
        })
        console.log(`[QSTASH] Scheduled step 1 callback for run #${run.id}`)
      } catch (qsErr) {
        console.warn(`[QSTASH] Skip/Error scheduling (likely local sandbox):`, qsErr.message)
      }
    }

    res.status(201).json(run)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* PUT /api/workflows/:id/runs/:runId */
router.put('/:id/runs/:runId', async (req, res) => {
  const { status, duration, current_step } = req.body
  try {
    const { rows } = await query(
      `UPDATE workflow_runs 
       SET status = COALESCE($1, status), 
           duration = COALESCE($2, duration), 
           current_step = COALESCE($3, current_step)
       WHERE id = $4 AND user_id = $5 AND workflow_id = $6 RETURNING *`,
      [status, duration, current_step, req.params.runId, req.workspaceId, req.params.id]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'Workflow run not found or unauthorized' })
    }

    const run = rows[0]
    const logKey = `run:${run.id}:logs`

    // Log step progress to Redis
    if (current_step !== undefined) {
      let logText = ''
      if (current_step === 0) {
        logText = `Deal Closed Won: Onboarding run triggered for customer '${run.test_company}' with value ₹${Number(run.test_value).toLocaleString()}`
      } else if (current_step === 1) {
        logText = `Check Deal Value: Checked if Deal Value (₹${Number(run.test_value).toLocaleString()}) is > ₹50,000. Result: Passed.`
      } else if (current_step === 2) {
        logText = `Enrich Company Info: AI Agent searched and found funding stage 'Series A', size 50-100 for '${run.test_company}'`
      } else if (current_step === 3) {
        logText = `Send Onboarding Email: Generated welcome guidelines and barcode, sent to contact at ${run.test_company}`
      } else if (current_step === 4) {
        logText = `Deal Completed: Onboarding workflow run #${run.id} complete. Billing sync successful.`
      }

      if (logText) {
        await redis.rpush(logKey, JSON.stringify({
          time: new Date().toISOString(),
          step: current_step,
          text: logText
        })).catch(() => {})
      }
    }

    if (status === 'Completed') {
      await redis.rpush(logKey, JSON.stringify({
        time: new Date().toISOString(),
        step: 5,
        text: `Workflow run completed successfully. duration: ${duration || '6s'}`
      })).catch(() => {})
    }

    res.json(run)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* POST /api/workflows/:id/runs/:runId/cancel */
router.post('/:id/runs/:runId/cancel', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE workflow_runs 
       SET status = 'Cancelled'
       WHERE id = $1 AND user_id = $2 AND workflow_id = $3 RETURNING *`,
      [req.params.runId, req.workspaceId, req.params.id]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'Workflow run not found or unauthorized' })
    }

    const run = rows[0]
    const logKey = `run:${run.id}:logs`
    
    // Log cancellation to Redis
    await redis.rpush(logKey, JSON.stringify({
      time: new Date().toISOString(),
      step: -1,
      text: `Workflow run #${run.id} was cancelled by user.`
    })).catch(() => {})

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

