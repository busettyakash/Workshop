import express from 'express'
import crypto from 'node:crypto'
import pool from '../lib/db.js'
import { sendEmail } from '../lib/smtp.js'
import { apiLimiter, emailLimiter } from '../middleware/rateLimit.js'
import { getInvoiceEmailTemplate, getQuoteEmailTemplate, getQuoteDeclinedTemplate, getOrderConfirmationTemplate } from '../utils/emailTemplates.js'
import { getProductHsnMap, enrichItemsWithCache } from '../lib/productCache.js'
import { logStockHistory } from './products.js'
import redis from '../lib/redis.js'

import { generateInvoicePdfBuffer } from '../utils/generateInvoicePdf.js'
import { executeWorkflowStep } from './workflows.js'

const router = express.Router()

// One-time schema migration — runs only once per server start
let _initSchemaPromise = null
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id SERIAL PRIMARY KEY,
      bill_id INT,
      product_id INT,
      product_name TEXT,
      quantity NUMERIC(10,2),
      price NUMERIC(10,2),
      line_total NUMERIC(10,2),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {})
  await pool.query(`ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS product_name TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(10,2)`).catch(() => {})
  await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)`).catch(() => {})
  await pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS order_number VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS order_number VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS to_email TEXT`).catch(() => {})
}
router.use((_req, _res, next) => {
  _initSchemaPromise ||= initSchema().catch(e => { _initSchemaPromise = null; throw e })
  _initSchemaPromise.then(() => next()).catch(next)
})


const getUserId = (req) => req.headers['x-workspace-id'] || 'default-user'

const triggerWorkflowForQuote = async (userId, quote, actionName = 'Record created') => {
  try {
    let effectiveUserId = userId || quote?.user_id || '00000000-0000-0000-0000-000000000000'
    const quoteId = quote?.id || quote?.quote_number || 'new'
    // Debounce / Deduplication Lock: Prevent duplicate runner if triggered within 10 seconds for the same quote action
    const dedupKey = `workflow:dedup:quote:${effectiveUserId}:${quoteId}:${actionName}`
    const alreadyTriggered = await redis.get(dedupKey).catch(() => null)
    if (alreadyTriggered) {
      console.log(`[Quote Workflow] ⏸️ Duplicate workflow runner prevented for quote #${quoteId} (Event: ${actionName}). Already dispatched.`)
      return
    }
    // Set 10s cooldown lock to prevent duplicate runners
    await redis.set(dedupKey, '1', { ex: 10 }).catch(() => {})

    // 1. Fetch only active LIVE workflows
    const wfRes = await pool.query(
      `SELECT id, name, is_live FROM workflows 
       WHERE is_live = true 
         AND (user_id::text = $1::text OR user_id::text = '00000000-0000-0000-0000-000000000000' OR $1::text = '00000000-0000-0000-0000-000000000000' OR user_id::text = 'default-user' OR $1::text = 'default-user')
       ORDER BY updated_at DESC LIMIT 1`,
      [effectiveUserId]
    ).catch(e => { console.error('[Quote Workflow Fetch Error]', e.message); return { rows: [] } })

    if (wfRes.rows.length === 0) {
      console.log('[Quote Workflow] ⏸️ Skipping automation: No LIVE workflow found')
      return
    }
    if (!wfRes.rows[0].is_live) {
      console.log('[Quote Workflow] ⏸️ Skipping automation: Workflow is in Draft mode')
      return
    }

    const wf = wfRes.rows[0]
    const wfId = wf.id

    // 2. Check Redis live cache for immediate toggle state
    const cachedLive = await redis.get(`workflow:${wfId}:is_live`).catch(() => null)
    if (cachedLive === '0') {
      console.log(`[Quote Workflow] ⏸️ Workflow #${wfId} is paused in Redis. Skipping execution.`)
      return
    }

    if (wfId && quote) {
      const custName = quote.customer_name || 'Customer'
      const totalVal = parseFloat(quote.total_amount || 0)
      const quoteNum = quote.quote_number || `QT-${quote.id || 'New'}`
      const isDeclined = actionName === 'Declined'
      const companyLabel = isDeclined ? `${custName} (${quoteNum}) · Declined` : `${custName} (${quoteNum})`

      const runRes = await pool.query(
        `INSERT INTO workflow_runs (workflow_id, user_id, status, test_company, test_value, current_step, created_at)
         VALUES ($1, $2, 'Executing', $3, $4, 0, NOW()) RETURNING *`,
        [wfId, effectiveUserId, companyLabel, totalVal]
      ).catch(e => { console.error('[Workflow Run Insert Error]', e.message); return { rows: [] } })

      const run = runRes.rows[0]
      if (run) {
        await redis.set(`run:${run.id}:quote_id`, String(quote.id)).catch(() => {})
        await redis.expire(`run:${run.id}:quote_id`, 86400).catch(() => {})

        const logKey = `run:${run.id}:logs`
        await redis.rpush(logKey, JSON.stringify({
          time: new Date().toISOString(),
          step: 0,
          text: `Trigger: ${actionName} — Customer '${custName}' (#${quoteNum}) for ₹${totalVal.toLocaleString('en-IN')}`
        })).catch(() => {})
        await redis.expire(logKey, 86400).catch(() => {})

        // Invalidate workflows list cache
        await redis.del(`workflows:list:${effectiveUserId}`).catch(() => {})

        // Immediately advance Step 1 in background without network lag
        setTimeout(() => {
          executeWorkflowStep({
            runId: run.id,
            workflowId: wfId,
            step: 1,
            test_company: companyLabel,
            test_value: totalVal,
            branch: isDeclined ? 'declined' : 'accepted'
          }).catch(e => console.error('[Step 1 Instant Execution Error]', e.message))
        }, 100)

        console.log(`[Quote Workflow Triggered] ✅ Run #${run.id} started for LIVE workflow #${wfId} (${actionName}, branch: ${isDeclined ? 'declined' : 'accepted'})`)
      }
    }
  } catch (err) {
    console.error('[Quote Workflow Trigger Error]', err.message)
  }
}

const decreaseProductStockForQuote = async (items, userId, quoteRef) => {
  if (!Array.isArray(items)) return
  for (const item of items) {
    if (!item) continue
    const qty = parseFloat(item.quantity || item.qty || 0)
    const prodId = item.product_id || item.id || item.productId
    const itemName = item.name || item.product_name || item.productName || ''
    const itemCode = item.hsn_code || item.hsn || item.sku || ''
    if (qty <= 0) continue

    let prodRes = await pool.query(
      `SELECT id, name, sku, hsn_code, stock, loose_kg, bag_weight, unit FROM products 
       WHERE (
         ( $1::text <> '' AND id::text = $1::text )
         OR ( $2::text <> '' AND name ILIKE $2 )
         OR ( $3::text <> '' AND (hsn_code = $3 OR sku = $3) )
       )
       AND (user_id::text = $4::text OR user_id = 'default-user' OR $4 = 'default-user') 
       LIMIT 1`,
      [prodId ? String(prodId) : '', itemName.trim(), itemCode.trim(), userId || 'default-user']
    ).catch(e => { console.error('[Quote Stock Lookup Error]', e.message); return null })

    const prod = prodRes?.rows?.[0]
    if (!prod) continue

    const bw = parseFloat(prod.bag_weight || 1)
    const itemUnitStr = String(item.unit || item.unitLabel || '').trim().toLowerCase()
    const prodUnitStr = String(prod.unit || 'pcs').trim().toLowerCase()
    const containerKeywords = ['bag', 'bags', 'drum', 'drums', 'can', 'cans', 'roll', 'rolls', 'box', 'boxes', 'carton', 'cartons', 'dozen', 'doz', 'pack', 'packs', 'bundle', 'bundles']

    let isBaseUnit = true
    if (itemUnitStr) {
      isBaseUnit = !containerKeywords.some(c => itemUnitStr.includes(c))
    } else if (prodUnitStr) {
      isBaseUnit = !containerKeywords.some(c => prodUnitStr.includes(c))
    }

    const rawUnit = item.unit || item.unitLabel || (isBaseUnit ? 'kgs' : prod.unit) || 'pcs'

    const currentStock = parseFloat(prod.stock || 0)
    const currentLoose = parseFloat(prod.loose_kg || 0)

    let totalBaseBefore = (bw > 1) ? ((currentStock * bw) + currentLoose) : currentStock
    let qtyDeductedBase = (isBaseUnit || bw <= 1) ? qty : (qty * bw)
    let totalBaseAfter = Math.max(0, totalBaseBefore - qtyDeductedBase)

    let newStock = 0
    let newLooseKg = 0

    if (bw > 1) {
      newStock = Math.floor(totalBaseAfter / bw)
      newLooseKg = +(totalBaseAfter % bw).toFixed(2)
    } else {
      newStock = totalBaseAfter
    }

    // Update products table
    await pool.query(
      `UPDATE products SET stock = $1, loose_kg = $2, updated_at = NOW() WHERE id = $3`,
      [newStock, newLooseKg, prod.id]
    ).catch(e => console.error('[Quote Products Stock Decrease Error]', e.message))

    // Note: import_stock table is NOT updated here so it preserves the original purchased quantity

    if (userId) {
      const keys1 = await redis.keys(`*${userId}*`).catch(() => [])
      const keys2 = await redis.keys(`*default-user*`).catch(() => [])
      for (const k of [...keys1, ...keys2]) { await redis.del(k).catch(() => {}) }
    }

    let noteDetail = ''
    if (isBaseUnit || bw <= 1) {
      noteDetail = `Deducted ${qty} ${rawUnit} for quote acceptance`
    } else {
      const uomLower = (prod.unit || '').toLowerCase()
      let containerLabel = 'Bag'
      if (uomLower.includes('liter')) containerLabel = 'Drum'
      else if (uomLower.includes('meter')) containerLabel = 'Roll'
      else if (uomLower.includes('box') || uomLower.includes('pc')) containerLabel = 'Box'

      let baseShort = 'kg'
      if (uomLower.includes('liter')) baseShort = 'ltr'
      else if (uomLower.includes('meter')) baseShort = 'mtr'
      else if (uomLower.includes('box') || uomLower.includes('pc')) baseShort = 'pc'

      const totalBase = (qty * bw).toFixed(0)
      noteDetail = `Deducted ${qty} ${containerLabel} (${bw}${baseShort}) (${totalBase} ${baseShort}) for quote acceptance`
    }

    // Log to stock history
    await logStockHistory(
      prod.id,
      userId || 'default-user',
      'deducted',
      -qty,
      currentStock,
      newStock,
      'Quote',
      quoteRef ? String(quoteRef) : null,
      noteDetail,
      newLooseKg
    ).catch(e => console.error('[Quote Stock History Log Error]', e.message))
  }
}

const isEmailStepActiveInWorkflow = async (userId, branch = 'accepted') => {
  try {
    const wfRes = await pool.query(
      `SELECT nodes, is_live, name FROM workflows 
       WHERE (user_id::text = $1::text OR user_id::text = '00000000-0000-0000-0000-000000000000' OR $1::text = '00000000-0000-0000-0000-000000000000' OR user_id::text = 'default-user' OR $1::text = 'default-user')
       ORDER BY updated_at DESC LIMIT 1`,
      [userId || 'default-user']
    ).catch(e => { console.error('[Email Check Fetch Error]', e.message); return { rows: [] } })

    if (!wfRes.rows.length) {
      console.log(`[Email Check] No workflow found for user ${userId} — skipping email`)
      return false
    }
    const wf = wfRes.rows[0]

    // If workflow is not live (draft), skip email
    if (!wf.is_live) {
      console.log(`[Email Check] Workflow "${wf.name}" is in Draft mode — skipping email`)
      return false
    }

    let nodes = wf.nodes
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes) } catch { nodes = null }
    }

    let stepsToCheck = []
    if (nodes && typeof nodes === 'object') {
      if (branch === 'declined') {
        stepsToCheck = Array.isArray(nodes.declinedSteps) ? nodes.declinedSteps : []
      } else {
        if (Array.isArray(nodes.acceptedSteps)) {
          stepsToCheck = nodes.acceptedSteps
        } else if (Array.isArray(nodes)) {
          stepsToCheck = nodes
        }
      }
    }

    const hasEmailStep = stepsToCheck.some(s => {
      if (!s) return false
      const tag = String(s.tag || '').toLowerCase()
      const badge = String(s.badge || '').toLowerCase()
      const title = String(s.title || '').toLowerCase()
      const icon = String(s.icon || '').toLowerCase()
      const iconType = String(s.iconType || '').toLowerCase()
      const id = String(s.id || '').toLowerCase()

      // Exclude billing & inventory steps
      if (tag === 'billing' || tag === 'inventory' || id === 'step-inventory' || id === 'step-bill') {
        return false
      }

      return (
        tag === 'email' ||
        tag === 'multi-contact' ||
        badge === 'email' ||
        icon === 'mail' ||
        iconType === 'send' ||
        iconType === 'mail' ||
        id === 'act-multi-recipient' ||
        id === 'step-email' ||
        title.includes('send invoice email') ||
        title.includes('multiple') ||
        title.includes('rejection') ||
        title.includes('decline')
      )
    })

    console.log(`[Email Check] Workflow "${wf.name}" (${branch}, live: ${wf.is_live}) — hasEmailStep: ${hasEmailStep}`)
    return hasEmailStep
  } catch (e) {
    console.warn('[Email Check Error]', e.message)
    return false
  }
}

const sendQuoteDeclinedEmailToCustomer = async (quote) => {
  if (!quote?.customer_email) return

  // Check if "Send Rejection Follow-up Email" node is enabled in active workflow
  const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id, 'declined')
  if (!isEmailEnabled) {
    console.log(`[Declined Email] ⏸️ Skipping decline email for quote #${quote.quote_number || quote.id}: "Send Rejection Follow-up Email" node was not enabled in Declined workflow branch.`)
    return
  }

  const shopProfileRes = await pool.query('SELECT shop_name, phone, email, address FROM shop_profiles WHERE user_id::text = $1::text LIMIT 1', [quote.user_id || 'default-user']).catch(() => ({ rows: [] }))
  const shop = shopProfileRes.rows[0] || {}
  const shopName = shop.shop_name || quote.shop_name || 'Workshop'

  const emailHtml = getQuoteDeclinedTemplate({
    quote,
    shopName,
    supportEmail: shop.email,
    supportPhone: shop.phone
  })

  const subject = `Update: Quotation #${quote.quote_number || quote.id} Declined — ${shopName}`

  const sendRes = await sendEmail({
    to: quote.customer_email,
    subject,
    html: emailHtml
  }).catch(e => {
    console.error('[Declined Email Send Error]', e.message)
    return { error: e }
  })

  if (sendRes?.error) {
    console.error('[Declined Email Failed]', sendRes.error.message)
  } else {
    console.log(`[Declined Email Sent] ✅ Sent quotation decline follow-up email to ${quote.customer_email}`)
    
    // Save email log into emails table
    await pool.query(
      `INSERT INTO emails (from_name, from_email, to_email, subject, body, preview, direction, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW(), NOW())`,
      [
        shopName,
        process.env.SMTP_USER || 'noreply@workshop.app',
        quote.customer_email,
        subject,
        emailHtml,
        `Follow-up on declined Quotation #${quote.quote_number || quote.id} for ${quote.customer_name || 'Customer'}`,
        quote.user_id || 'default-user'
      ]
    ).catch(e => console.error('[Declined Email Record Save Error]', e.message))
  }
}

const sendInvoiceEmailToCustomer = async (quote, bill, billItems, orderNumber = null) => {
  if (!quote?.customer_email) return

  // Check if "Send Invoice Email" node is enabled in active workflow
  const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id)
  if (!isEmailEnabled) {
    console.log(`[Invoice Email] ⏸️ Skipping automatic invoice email for quote #${quote.quote_number || quote.id}: "Send Invoice Email" node was removed from workflow.`)
    return
  }

  const shopProfileRes = await pool.query('SELECT shop_name, phone, gstin, email, address FROM shop_profiles WHERE user_id::text = $1::text LIMIT 1', [quote.user_id || 'default-user']).catch(() => ({ rows: [] }))
  const shop = shopProfileRes.rows[0] || {}
  const sellerName = shop.shop_name || shop.name || quote.shop_name || bill?.shop_name || 'Workshop'
  const invNum = bill?.bill_number || `INV-${String(bill?.id || 1).padStart(4, '0')}`
  const totalAmount = parseFloat(bill?.amount || bill?.total_amount || quote?.total_amount || 0)
  const totalFormatted = totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const catalogMap = await getProductHsnMap()
  const enrichedBillItems = enrichItemsWithCache(billItems || [], catalogMap)

  // Generate Email HTML using external template file (invoiceTemplate.js)
  const invoiceHtml = getInvoiceEmailTemplate({ quote, bill, billItems: enrichedBillItems, shop })

  const pdfBuffer = await generateInvoicePdfBuffer({ quote, bill, billItems: enrichedBillItems, shop, type: 'invoice' }).catch(e => {
    console.error('[Invoice PDF Generation Error]', e.message)
    return null
  })

  const attachments = pdfBuffer ? [
    {
      filename: `Tax_Invoice_${invNum}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ] : []

  // 1. Send invoice email to Customer
  await sendEmail({
    to: quote.customer_email,
    subject: `TAX INVOICE ${invNum} from ${sellerName}`,
    html: invoiceHtml,
    attachments
  }).catch(e => console.error('[Invoice Email Send Error Customer]', e.message))

  // 2. Send invoice email copy to Sender (Shop / Workspace)
  const senderEmail = shop.email || process.env.SMTP_USER
  if (senderEmail && senderEmail !== quote.customer_email) {
    await sendEmail({
      to: senderEmail,
      subject: `[Sender Copy] TAX INVOICE ${invNum} issued to ${quote.customer_name}`,
      html: invoiceHtml,
      attachments
    }).catch(e => console.error('[Invoice Email Send Error Sender]', e.message))
  }

  // 3. Save Email Log Record
  await pool.query(
    `INSERT INTO emails (from_name, from_email, to_email, subject, body, preview, direction, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW(), NOW())`,
    [
      sellerName,
      quote.customer_email || 'customer@workshop.app',
      quote.customer_email || '',
      `TAX INVOICE ${invNum} from ${sellerName}`,
      invoiceHtml,
      `Tax Invoice #${invNum} for ₹${totalFormatted} sent to ${quote.customer_name}`,
      quote.user_id || 'default-user'
    ]
  ).catch(e => console.error('[Invoice Email Record Save Error]', e.message))
}

const sendOrderConfirmationEmailToCustomer = async (quote, bill, billItems, orderNumber) => {
  if (!quote?.customer_email) {
    console.warn('[Order Confirmation Email] Skipped — no customer_email found on quote')
    return
  }

  // Check if "Send Invoice Email" node is enabled in active workflow
  const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id)
  if (!isEmailEnabled) {
    console.log(`[Order Confirmation Email] ⏸️ Skipping automatic order confirmation email for quote #${quote.quote_number || quote.id}: "Send Invoice Email" node was removed from workflow.`)
    return
  }

  // Handle flexible signature: (quote, bill, orderNumber) vs (quote, bill, billItems, orderNumber)
  if (typeof billItems === 'string' && !orderNumber) {
    orderNumber = billItems
    billItems = []
  }

  const orderNum = orderNumber || quote.order_number || bill?.order_number || `ORD-1001`

  const shopProfileRes = await pool.query('SELECT shop_name, phone, gstin, email, address FROM shop_profiles WHERE user_id::text = $1::text LIMIT 1', [quote.user_id || 'default-user']).catch(() => ({ rows: [] }))
  const shop = shopProfileRes.rows[0] || {}
  const sellerName = shop.shop_name || quote.shop_name || 'Workshop'

  const customerName = quote.customer_name || bill?.customer_name || 'Customer'
  const dateObj = new Date()
  const orderDateStr = `${dateObj.getDate()}-${dateObj.toLocaleString('en-US', { month: 'short' })}-${dateObj.getFullYear()}`
  const totalAmount = parseFloat(bill?.amount || bill?.total_amount || quote?.total_amount || 0)

  const catalogMap = await getProductHsnMap()
  const enrichedBillItems = enrichItemsWithCache(billItems || [], catalogMap)

  const confirmationHtml = getOrderConfirmationTemplate({
    customerName,
    orderNumber: orderNum,
    orderDate: orderDateStr,
    totalAmount
  })

  const subject = `Order Confirmation - ${orderNum}`

  const invNum = bill?.bill_number || `INV-${Math.floor(100000 + Math.abs(Math.sin(bill?.id || 1) * 899999))}`
  const pdfBuffer = await generateInvoicePdfBuffer({ quote, bill, billItems: enrichedBillItems, shop, type: 'invoice' }).catch(e => {
    console.error('[Invoice PDF Generation Error]', e.message)
    return null
  })

  const attachments = pdfBuffer ? [
    {
      filename: `Tax_Invoice_${invNum}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ] : []

  // Send Order Confirmation email with attached Tax Invoice PDF
  const sendRes = await sendEmail({
    to: quote.customer_email,
    subject,
    html: confirmationHtml,
    attachments
  }).catch(e => {
    console.error('[Order Confirmation Email Error]', e.message)
    return { error: e }
  })

  if (sendRes?.error) {
    console.error('[Order Confirmation Email Failed]', sendRes.error.message)
  } else {
    console.log(`[Order Confirmation Email Sent] ✅ Sent to ${quote.customer_email} with invoice ${invNum}`)
  }

  // Save email log
  await pool.query(
    `INSERT INTO emails (from_name, from_email, to_email, subject, body, preview, direction, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW(), NOW())`,
    [
      sellerName,
      quote.customer_email,
      quote.customer_email,
      subject,
      confirmationHtml,
      `Order ${orderNumber} confirmed for ${customerName} — ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      quote.user_id || 'default-user'
    ]
  ).catch(e => console.error('[Order Email Record Save Error]', e.message)).catch(() => { })
}

/* ── GET /api/quotes ── */
router.get('/', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const offset = (page - 1) * limit
    const search = req.query.search || ''
    const status = req.query.status || ''

    let countQuery = "SELECT COUNT(*) FROM quotes WHERE (user_id::text = $1::text OR user_id = 'default-user' OR $1 = 'default-user')"
    let dataQuery = "SELECT * FROM quotes WHERE (user_id::text = $1::text OR user_id = 'default-user' OR $1 = 'default-user')"
    const params = [userId]
    let paramIdx = 2

    if (search && search.trim()) {
      countQuery += ` AND (COALESCE(quote_number, '') ILIKE $${paramIdx} OR COALESCE(order_number, '') ILIKE $${paramIdx} OR COALESCE(customer_name, '') ILIKE $${paramIdx} OR COALESCE(customer_email, '') ILIKE $${paramIdx})`
      dataQuery += ` AND (COALESCE(quote_number, '') ILIKE $${paramIdx} OR COALESCE(order_number, '') ILIKE $${paramIdx} OR COALESCE(customer_name, '') ILIKE $${paramIdx} OR COALESCE(customer_email, '') ILIKE $${paramIdx})`
      params.push(`%${search.trim()}%`)
      paramIdx++
    }

    if (status && status !== 'all') {
      countQuery += ` AND status ILIKE $${paramIdx}`
      dataQuery += ` AND status ILIKE $${paramIdx}`
      params.push(status)
      paramIdx++
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`
    const dataParams = [...params, limit, offset]

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, dataParams)
    ])

    const total = parseInt(countRes.rows[0].count, 10)

    res.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    })
  } catch (err) {
    console.error('[Quotes GET Error]', err)
    res.status(500).json({ error: 'Failed to fetch quotes' })
  }
})

/* ── PUBLIC RESPONSE ENDPOINT: GET /api/quotes/respond ── */
router.get('/respond', emailLimiter, async (req, res) => {
  try {
    const { id, action } = req.query
    if (!id || !['Accepted', 'Declined'].includes(action)) {
      return res.status(400).send('<h3>Invalid quotation response request.</h3>')
    }

    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [id])
    if (quoteRes.rows.length === 0) {
      return res.status(404).send('<h3>Quotation not found.</h3>')
    }

    const quote = quoteRes.rows[0]

    // Block re-triggering if already responded
    if (quote.status === 'Accepted' || quote.status === 'Declined') {
      const isAcc = quote.status === 'Accepted'
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Already Responded</title>
            <style>body{font-family:-apple-system,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;} .card{background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:32px;max-width:460px;width:100%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.06);}</style>
          </head>
          <body>
            <div class="card">
              <div style="font-size:2.5rem;margin-bottom:12px;">${isAcc ? '✅' : '❌'}</div>
              <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-weight:700;font-size:0.85rem;background:${isAcc ? '#dcfce7' : '#fee2e2'};color:${isAcc ? '#15803d' : '#b91c1c'};margin-bottom:14px;">Already ${quote.status}</div>
              <h3 style="margin:0 0 8px;color:#0f172a;">This quotation has already been ${quote.status.toLowerCase()}.</h3>
              <p style="color:#64748b;font-size:0.875rem;">Quotation <strong>#${quote.quote_number}</strong> response has already been recorded. No further action is needed.</p>
            </div>
          </body>
        </html>
      `)
    }

    const generatedOrderNum = (quote.order_number && quote.order_number !== 'null') ? quote.order_number : `ORD-${crypto.randomInt(10000, 100000)}`

    // order_number column ensured at startup in initSchema()
    await pool.query(
      'UPDATE quotes SET status = $1, order_number = $2, updated_at = NOW() WHERE id = $3',
      [action, generatedOrderNum, id]
    )

    // Insert notification record into emails table so it immediately appears in the workspace Inbox
    await pool.query(
      `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, is_read, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'inbox', false, $6, NOW(), NOW())`,
      [
        quote.customer_name || 'Customer',
        quote.customer_email || 'customer@workshop.app',
        `Re: Quotation #${quote.quote_number} ${action}`,
        `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:16px; color:#1e293b;">
          <h3 style="margin-top:0; color:#0f172a;">Quotation #${quote.quote_number} ${action}</h3>
          <p>Customer <strong>${quote.customer_name}</strong> has <strong>${action.toLowerCase()}</strong> quotation #${quote.quote_number} for total amount ₹${parseFloat(quote.total_amount || 0).toFixed(2)}.</p>
          ${action === 'Accepted' ? `<p style="color:#16a34a; font-weight:bold;">✅ Order <strong>${generatedOrderNum}</strong> & Invoice generated in Billing.</p>` : ''}
        </div>`,
        `Quotation #${quote.quote_number} was ${action.toLowerCase()} by ${quote.customer_name}`,
        quote.user_id
      ]
    ).catch(eErr => console.error('[Quote Response Inbox Record Error]', eErr.message))

    let autoBillNotice = ''
    if (action === 'Accepted') {
      try {
        // Auto convert accepted quote to a bill
        let customerId = quote.person_id || null

        if (!customerId) {
          const personRes = await pool.query(
            'SELECT id FROM people WHERE (name ILIKE $1 OR email ILIKE $2) AND (user_id::text = $3::text OR user_id = \'default-user\') LIMIT 1',
            [quote.customer_name || '', quote.customer_email || 'xyz', quote.user_id || 'default-user']
          ).catch(() => ({ rows: [] }))

          if (personRes.rows.length > 0) {
            customerId = personRes.rows[0].id
          } else {
            const newPerson = await pool.query(
              `INSERT INTO people (name, phone, email, persona, user_id) VALUES ($1, $2, $3, 'Customer', $4) RETURNING id`,
              [quote.customer_name || 'Customer', quote.customer_phone || '', quote.customer_email || '', quote.user_id || 'default-user']
            ).catch(e => {
              console.error('[Person Insert Error]', e.message)
              return { rows: [] }
            })
            if (newPerson.rows[0]) customerId = newPerson.rows[0].id
          }
        }

        let items = []
        if (Array.isArray(quote.line_items)) {
          items = quote.line_items
        } else if (typeof quote.line_items === 'string') {
          try { items = JSON.parse(quote.line_items) } catch { }
        }
        if (!Array.isArray(items)) items = []

        const catalogMap = await getProductHsnMap()
        const enrichedItems = enrichItemsWithCache(items, catalogMap)
        const autoBillNum = `INV-${crypto.randomInt(100000, 1000000)}`

        const lineSum = enrichedItems.reduce((acc, it) => acc + (parseFloat(it.quantity || 1) * parseFloat(it.rate || it.price || 0)), 0)
        const quoteTotal = parseFloat(quote.total_amount || 0)
        const numericDiscount = lineSum > quoteTotal ? (lineSum - quoteTotal) : 0

        const billRes = await pool.query(
          `INSERT INTO bills (customer_id, bill_number, order_number, items, amount, discount, status, due_date, notes, user_id, paid_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'unpaid', NOW() + INTERVAL '15 days', $7, $8, NULL, NOW())
           RETURNING *`,
          [
            customerId,
            autoBillNum,
            generatedOrderNum,
            JSON.stringify(enrichedItems),
            quoteTotal,
            numericDiscount,
            `Generated from Quotation #${quote.quote_number} (Order ${generatedOrderNum})`,
            quote.user_id || 'default-user'
          ]
        )

        const bill = billRes.rows[0]
        const createdItems = []
        for (const item of items) {
          if (item && (item.name || item.product_id)) {
            try {
              const itemRes = await pool.query(
                `INSERT INTO bill_items (bill_id, product_id, product_name, quantity, price, line_total)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [
                  bill.id,
                  item.product_id || null,
                  item.name || 'Custom Item',
                  parseFloat(item.quantity || 1),
                  parseFloat(item.rate || item.price || 0),
                  parseFloat(item.amount || item.line_total || 0)
                ]
              ).catch(async () => {
                return pool.query(
                  `INSERT INTO bill_items (bill_id, product_id, quantity, price)
                   VALUES ($1, $2, $3, $4) RETURNING *`,
                  [
                    bill.id,
                    item.product_id || null,
                    parseFloat(item.quantity || 1),
                    parseFloat(item.rate || item.price || 0)
                  ]
                ).catch(() => null)
              })
              if (itemRes?.rows?.[0]) createdItems.push(itemRes.rows[0])
            } catch (_itemErr) { }
          }
        }

        // Decrease product inventory stock for accepted quotation line items
        await decreaseProductStockForQuote(items, quote.user_id, quote.quote_number || quote.id)

        // Check if "Send Invoice Email" / "Send Onboarding Email" node is active in the workflow
        const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id)

        // Send combined Order Confirmation + Invoice email ONLY if the node is present in the workflow
        if (isEmailEnabled) {
          await sendOrderConfirmationEmailToCustomer(quote, bill, createdItems.length > 0 ? createdItems : items, generatedOrderNum).catch(e => console.error('[Order Email Send Error]', e.message))
        }
        await triggerWorkflowForQuote(quote.user_id || 'default-user', { ...quote, status: 'Accepted', order_number: generatedOrderNum }, 'Accepted').catch(e => console.error('[Workflow Trigger Error]', e.message))

        const emailNoticeText = isEmailEnabled
          ? ` The official billing invoice will come to your mail (<strong>${quote.customer_email || 'your email'}</strong>) — please check your inbox!`
          : ''

        autoBillNotice = `<div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:20px; border-radius:12px; margin-top:20px; text-align:center;">
          <div style="font-size:1.15rem; font-weight:800; margin-bottom:6px; color:#047857;">Official Billing Invoice Issued Successfully</div>
          <div style="font-size:0.95rem; line-height:1.5;">Order <strong>${generatedOrderNum}</strong> · Invoice <strong>#${bill.bill_number || autoBillNum}</strong> has been generated and sent to Unpaid Bills.${emailNoticeText}</div>
        </div>`
      } catch (billErr) {
        console.error('[Auto Bill Generation Error]', billErr.message)
        const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id).catch(() => false)
        const emailNoticeText = isEmailEnabled
          ? ` The official billing invoice will come to your mail (<strong>${quote.customer_email || 'your email'}</strong>) — please check your inbox!`
          : ''
        autoBillNotice = `<div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:20px; border-radius:12px; margin-top:20px; text-align:center;">
          <div style="font-size:1.15rem; font-weight:800; margin-bottom:6px; color:#047857;">Official Billing Invoice Issued Successfully</div>
          <div style="font-size:0.95rem; line-height:1.5;">Order <strong>${generatedOrderNum}</strong> ·${emailNoticeText}</div>
        </div>`
      }
    } else {
      // Check if "Send Rejection Follow-up Email" is enabled in the workflow
      const isEmailEnabled = await isEmailStepActiveInWorkflow(quote.user_id, 'declined')
      if (isEmailEnabled) {
        await sendQuoteDeclinedEmailToCustomer(quote).catch(e => console.error('[Declined Email Send Error]', e.message))
      }
      await triggerWorkflowForQuote(quote.user_id || 'default-user', { ...quote, status: 'Declined' }, 'Declined').catch(e => console.error('[Workflow Trigger Error]', e.message))

      const emailNoticeText = isEmailEnabled
        ? ` A confirmation and follow-up has been sent to your email (<strong>${quote.customer_email || 'your email'}</strong>).`
        : ''

      autoBillNotice = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:18px 20px; border-radius:12px; margin-top:20px; text-align:center;">
        <div style="font-size:1.1rem; font-weight:800; color:#dc2626; margin-bottom:4px;">Quotation Declined</div>
        <div style="font-size:0.9rem; color:#7f1d1d; line-height:1.5;">No charges or billing invoices have been issued.${emailNoticeText} If you need a revised quotation or customized pricing, feel free to reply or contact us!</div>
      </div>`
    }

    const isAcc = action === 'Accepted'
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation Response Recorded</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 60px 20px; display: flex; justify-content: center; }
            .card { background: #ffffff; max-width: 520px; width: 100%; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center; }
            .badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-weight: 800; font-size: 0.9rem; margin-bottom: 18px; }
            .accepted { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .declined { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size:3rem; margin-bottom:12px;">${isAcc ? '🎉' : '📋'}</div>
            <div class="badge ${isAcc ? 'accepted' : 'declined'}">
              Quotation ${action}
            </div>
            <h2 style="margin:0 0 8px; color:#0f172a; font-size:1.4rem;">Thank you, ${quote.customer_name || 'Customer'}!</h2>
            <p style="color:#64748b; margin:0 0 16px; line-height:1.5;">Your response for Quotation <strong>#${quote.quote_number}</strong> has been saved.</p>
            ${autoBillNotice}
          </div>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('[Quotes Respond Error]', err)
    res.status(500).send('<h3>Error processing quotation response.</h3>')
  }
})

/* ── POST /api/quotes/:id/convert-to-bill ── */
router.post('/:id/convert-to-bill', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1 AND user_id = $2', [id, userId])
    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const quote = quoteRes.rows[0]

    let customerId = quote.person_id || null

    if (!customerId) {
      const personRes = await pool.query(
        'SELECT id FROM people WHERE (name ILIKE $1 OR email ILIKE $2) AND (user_id::text = $3::text OR user_id = \'default-user\') LIMIT 1',
        [quote.customer_name || '', quote.customer_email || 'xyz', userId || 'default-user']
      ).catch(() => ({ rows: [] }))

      if (personRes.rows.length > 0) {
        customerId = personRes.rows[0].id
      } else {
        const newPerson = await pool.query(
          `INSERT INTO people (name, phone, email, persona, user_id) VALUES ($1, $2, $3, 'Customer', $4) RETURNING id`,
          [quote.customer_name || 'Customer', quote.customer_phone || '', quote.customer_email || '', userId || 'default-user']
        ).catch(e => {
          console.error('[Person Insert Error]', e.message)
          return { rows: [] }
        })
        if (newPerson.rows[0]) customerId = newPerson.rows[0].id
      }
    }

    let items = []
    if (Array.isArray(quote.line_items)) {
      items = quote.line_items
    } else if (typeof quote.line_items === 'string') {
      try { items = JSON.parse(quote.line_items) } catch { }
    }
    if (!Array.isArray(items)) items = []

    const lineSum = items.reduce((acc, it) => acc + (parseFloat(it.quantity || 1) * parseFloat(it.rate || it.price || 0)), 0)
    const quoteTotal = parseFloat(quote.total_amount || 0)
    const numericDiscount = lineSum > quoteTotal ? (lineSum - quoteTotal) : 0

    const billRes = await pool.query(
      `INSERT INTO bills (customer_id, items, amount, discount, status, due_date, notes, user_id, paid_at, created_at)
       VALUES ($1, $2, $3, $4, 'unpaid', NOW() + INTERVAL '15 days', $5, $6, NULL, NOW())
       RETURNING *`,
      [
        customerId,
        JSON.stringify(items),
        quoteTotal,
        numericDiscount,
        `Generated from Quotation #${quote.quote_number}`,
        userId
      ]
    )

    const bill = billRes.rows[0]
    const createdItems = []
    for (const item of items) {
      if (item.name || item.product_id) {
        const itemRes = await pool.query(
          `INSERT INTO bill_items (bill_id, product_id, product_name, quantity, price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            bill.id,
            item.product_id || null,
            item.name || 'Custom Item',
            parseFloat(item.quantity || 1),
            parseFloat(item.rate || 0),
            parseFloat(item.amount || 0)
          ]
        )
        if (itemRes.rows[0]) createdItems.push(itemRes.rows[0])
      }
    }

    const orderNum = quote.order_number || `ORD-${quote.quote_number ? quote.quote_number.replace(/^QT-?/i, '') : quote.id}`
    await pool.query("UPDATE quotes SET status = 'Accepted', order_number = $1, updated_at = NOW() WHERE id = $2", [orderNum, id])

    // Decrease product inventory stock for accepted quotation line items
    await decreaseProductStockForQuote(items, userId, quote.quote_number || quote.id)

    // Send invoice email to customer
    const updatedQuote = { ...quote, status: 'Accepted', order_number: orderNum }
    await sendInvoiceEmailToCustomer(updatedQuote, bill, createdItems.length > 0 ? createdItems : items)

    // Trigger workflow automation for quote acceptance
    await triggerWorkflowForQuote(userId, updatedQuote, 'Accepted')

    res.json({ message: 'Converted to bill successfully and invoice sent to customer', bill })
  } catch (err) {
    console.error('[Convert to Bill Error]', err)
    res.status(500).json({ error: 'Failed to convert quote to bill' })
  }
})

/* ── POST /api/quotes/:id/send-email ── */
router.post('/:id/send-email', emailLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1 AND user_id = $2', [id, userId])
    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const quote = quoteRes.rows[0]
    if (!quote.customer_email) {
      return res.status(400).json({ error: 'Customer email is missing for this quote' })
    }

    let backendBase = process.env.BACKEND_URL
    if (!backendBase) {
      const rawHost = req.get('host') || 'localhost:5000'
      const safeHost = (/^[a-zA-Z0-9.-]+(:\d+)?$/).test(rawHost) ? rawHost : 'localhost:5000'
      const reqProtocol = (req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https') ? 'https' : 'http'
      backendBase = `${reqProtocol}://${safeHost}`
    }
    const acceptUrl = `${backendBase}/api/quotes/respond?id=${quote.id}&action=Accepted`
    const declineUrl = `${backendBase}/api/quotes/respond?id=${quote.id}&action=Declined`

    function formatPrettyDate(d) {
      if (!d) return '—'
      try {
        const dateObj = new Date(d)
        if (isNaN(dateObj.getTime())) return String(d)
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } catch {
        return String(d)
      }
    }

    const issueDateFmt = formatPrettyDate(quote.issue_date)
    const validUntilFmt = formatPrettyDate(quote.valid_until)

    let rawItems = []
    if (Array.isArray(quote.line_items)) {
      rawItems = quote.line_items
    } else if (typeof quote.line_items === 'string') {
      try { rawItems = JSON.parse(quote.line_items) } catch { }
    }
    if (!Array.isArray(rawItems)) rawItems = []
    const catalogMap = await getProductHsnMap()
    const enrichedItems = enrichItemsWithCache(rawItems || [], catalogMap)

    const quoteWithEnriched = { ...quote, line_items: enrichedItems }
    const emailHtml = getQuoteEmailTemplate({ quote: quoteWithEnriched, acceptUrl, declineUrl, issueDateFmt, validUntilFmt })

    const { data, error } = await sendEmail({
      to: quote.customer_email,
      subject: `Quotation #${quote.quote_number} from Workshop`,
      html: emailHtml
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    await pool.query("UPDATE quotes SET status = 'Sent', updated_at = NOW() WHERE id = $1", [id])

    // Save outgoing email into emails table so it appears in Sent tab
    await pool.query(
      `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'sent', $6, NOW(), NOW())`,
      [
        quote.customer_name || quote.customer_email,
        quote.customer_email,
        `Quotation #${quote.quote_number} from Workshop`,
        emailHtml,
        `Quotation #${quote.quote_number} for ₹${parseFloat(quote.total_amount || 0).toFixed(2)} sent to ${quote.customer_name}`,
        userId
      ]
    ).catch(eErr => console.error('[Quote Email Save Error]', eErr.message))

    res.json({ message: `Quotation sent successfully to ${quote.customer_email}`, mailId: data?.id })
  } catch (err) {
    console.error('[Send Quote Email Error]', err)
    res.status(500).json({ error: 'Failed to send quote email' })
  }
})

/* ── POST /api/quotes ── */
router.post('/', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const {
      quote_number,
      shop_name = 'Workshop Store',
      customer_company = '',
      customer_name,
      customer_phone,
      customer_email,
      total_amount,
      tax_amount,
      tax_rate = 18,
      status = 'Draft',
      issue_date = new Date().toISOString().split('T')[0],
      valid_until,
      notes = '',
      line_items = []
    } = req.body

    let finalShopName = shop_name
    if (!finalShopName || finalShopName === 'Workshop Store') {
      const shopRes = await pool.query(
        'SELECT shop_name FROM shop_profiles WHERE user_id::text = $1 OR email = $2 LIMIT 1',
        [userId, req.user?.email || '']
      ).catch(() => ({ rows: [] }))
      if (shopRes.rows[0]?.shop_name) {
        finalShopName = shopRes.rows[0].shop_name
      } else {
        // shop_name already defaults to 'Workshop Store' from destructuring; no reassignment needed
      }
    }

    const qNum = quote_number || `QT-${Date.now().toString().slice(-6)}`
    const itemsJson = JSON.stringify(line_items)

    const result = await pool.query(
      `INSERT INTO quotes (
        quote_number, shop_name, customer_company, customer_name, customer_phone, customer_email, 
        total_amount, tax_amount, tax_rate, status, issue_date, valid_until, 
        notes, line_items, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        qNum, finalShopName, customer_company, customer_name, customer_phone, customer_email,
        parseFloat(total_amount || 0), parseFloat(tax_amount || 0), parseFloat(tax_rate || 0),
        status, issue_date, valid_until || null, notes, itemsJson, userId
      ]
    )

    const createdQuote = result.rows[0]

    // Trigger workflow automation only when quote is created as Accepted
    if (createdQuote.status === 'Accepted') {
      await triggerWorkflowForQuote(userId, createdQuote, 'Accepted')
    }

    res.status(201).json(createdQuote)
  } catch (err) {
    console.error('[Quotes POST Error]', err)
    res.status(500).json({ error: 'Failed to create quote' })
  }
})

/* ── PUT /api/quotes/:id ── */
router.put('/:id', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const {
      quote_number,
      shop_name,
      customer_company,
      customer_name,
      customer_phone,
      customer_email,
      total_amount,
      tax_amount,
      tax_rate,
      status,
      issue_date,
      valid_until,
      notes,
      line_items
    } = req.body

    const itemsJson = line_items !== undefined ? JSON.stringify(line_items) : null

    const result = await pool.query(
      `UPDATE quotes SET
        quote_number = COALESCE($1, quote_number),
        shop_name = COALESCE($2, shop_name),
        customer_company = COALESCE($3, customer_company),
        customer_name = COALESCE($4, customer_name),
        customer_phone = COALESCE($5, customer_phone),
        customer_email = COALESCE($6, customer_email),
        total_amount = COALESCE($7, total_amount),
        tax_amount = COALESCE($8, tax_amount),
        tax_rate = COALESCE($9, tax_rate),
        status = COALESCE($10, status),
        issue_date = COALESCE($11, issue_date),
        valid_until = COALESCE($12, valid_until),
        notes = COALESCE($13, notes),
        line_items = COALESCE($14, line_items),
        updated_at = NOW()
      WHERE id = $15 AND user_id = $16
      RETURNING *`,
      [
        quote_number, shop_name, customer_company, customer_name, customer_phone, customer_email,
        total_amount !== undefined ? parseFloat(total_amount) : null,
        tax_amount !== undefined ? parseFloat(tax_amount) : null,
        tax_rate !== undefined ? parseFloat(tax_rate) : null,
        status, issue_date, valid_until, notes, itemsJson, id, userId
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const updatedQuote = result.rows[0]

    if (updatedQuote.status === 'Accepted') {
      const orderNum = updatedQuote.order_number || `ORD-${crypto.randomInt(10000, 100000)}`
      // order_number column ensured at startup
      await pool.query(
        "UPDATE quotes SET order_number = $1, updated_at = NOW() WHERE id = $2",
        [orderNum, updatedQuote.id]
      ).catch(() => { })
      updatedQuote.order_number = orderNum

      let itemsToDeduct = []
      if (Array.isArray(updatedQuote.line_items)) {
        itemsToDeduct = updatedQuote.line_items
      } else if (typeof updatedQuote.line_items === 'string') {
        try { itemsToDeduct = JSON.parse(updatedQuote.line_items) } catch { }
      }
      if (itemsToDeduct.length > 0) {
        await decreaseProductStockForQuote(itemsToDeduct, userId, updatedQuote.quote_number || updatedQuote.id)
      }

      // Find or create bill for accepted quotation so PDF invoice can be generated
      let bill = null
      const existingBillRes = await pool.query(
        'SELECT * FROM bills WHERE (notes ILIKE $1 OR order_number = $2) AND (user_id::text = $3::text OR user_id = \'default-user\') LIMIT 1',
        [`%Quotation #${updatedQuote.quote_number}%`, orderNum, userId]
      ).catch(() => ({ rows: [] }))

      if (existingBillRes.rows.length > 0) {
        bill = existingBillRes.rows[0]
      } else {
        const autoBillNum = `INV-${crypto.randomInt(100000, 1000000)}`
        const quoteTotal = parseFloat(updatedQuote.total_amount || 0)
        const newBillRes = await pool.query(
          `INSERT INTO bills (bill_number, order_number, items, amount, status, due_date, notes, user_id, created_at)
           VALUES ($1, $2, $3, $4, 'unpaid', NOW() + INTERVAL '15 days', $5, $6, NOW()) RETURNING *`,
          [
            autoBillNum,
            orderNum,
            JSON.stringify(itemsToDeduct),
            quoteTotal,
            `Generated from Quotation #${updatedQuote.quote_number} (Order ${orderNum})`,
            userId
          ]
        ).catch(() => ({ rows: [] }))
        if (newBillRes.rows?.[0]) bill = newBillRes.rows[0]
      }

      // Send Order Confirmation Email with attached TAX INVOICE PDF
      await sendOrderConfirmationEmailToCustomer(updatedQuote, bill, itemsToDeduct, orderNum).catch(e => console.error('[PUT Quote Order Confirmation Email Error]', e.message))
    }

    // Trigger workflow when quote is accepted
    if (updatedQuote.status === 'Accepted') {
      await triggerWorkflowForQuote(userId, updatedQuote, 'Accepted')
    }

    res.json(updatedQuote)
  } catch (err) {
    console.error('[Quotes PUT Error]', err)
    res.status(500).json({ error: 'Failed to update quote' })
  }
})

/* ── PATCH /api/quotes/:id/status ── */
router.patch('/:id/status', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ error: 'Status is required' })
    }

    const quoteRes = await pool.query(
      'SELECT * FROM quotes WHERE id = $1 AND (user_id::text = $2::text OR user_id = \'default-user\' OR $2 = \'default-user\')',
      [id, userId]
    )
    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const quote = quoteRes.rows[0]
    let orderNum = quote.order_number

    if (status === 'Accepted') {
      if (!orderNum || orderNum === 'null') {
        orderNum = `ORD-${crypto.randomInt(10000, 100000)}`
      }
      let itemsToDeduct = []
      if (Array.isArray(quote.line_items)) {
        itemsToDeduct = quote.line_items
      } else if (typeof quote.line_items === 'string') {
        try { itemsToDeduct = JSON.parse(quote.line_items) } catch { }
      }
      if (itemsToDeduct.length > 0) {
        await decreaseProductStockForQuote(itemsToDeduct, userId, quote.quote_number || quote.id)
      }
    }

    const updateRes = await pool.query(
      'UPDATE quotes SET status = $1, order_number = COALESCE($2, order_number), updated_at = NOW() WHERE id = $3 RETURNING *',
      [status, orderNum || null, id]
    )

    const updatedQuote = updateRes.rows[0]

    // Trigger workflow ONLY when quote is accepted
    if (status === 'Accepted') {
      await triggerWorkflowForQuote(userId, updatedQuote, 'Accepted')
    }

    res.json(updatedQuote)
  } catch (err) {
    console.error('[Quotes Status PATCH Error]', err)
    res.status(500).json({ error: 'Failed to update quote status' })
  }
})

/* ── DELETE /api/quotes/:id ── */
router.delete('/:id', apiLimiter, async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const result = await pool.query(
      'DELETE FROM quotes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    res.json({ message: 'Quote deleted successfully', id })
  } catch (err) {
    console.error('[Quotes DELETE Error]', err)
    res.status(500).json({ error: 'Failed to delete quote' })
  }
})

export default router
