import express from 'express'
import pool from '../lib/db.js'
import { sendEmail } from '../lib/smtp.js'

const router = express.Router()

const getUserId = (req) => req.headers['x-workspace-id'] || 'default-user'

const triggerWorkflowForQuote = async (userId, quote, actionName = 'Record created') => {
  try {
    let wfRes = await pool.query('SELECT id, name FROM workflows WHERE user_id::text = $1::text LIMIT 1', [userId]).catch(() => ({ rows: [] }))
    if (wfRes.rows.length === 0) {
      wfRes = await pool.query('SELECT id, name FROM workflows ORDER BY id ASC LIMIT 1').catch(() => ({ rows: [] }))
    }
    if (wfRes.rows.length > 0) {
      const wf = wfRes.rows[0]
      await pool.query(
        `INSERT INTO workflow_runs (workflow_id, user_id, status, duration, test_company, test_value, current_step, created_at)
         VALUES ($1, $2, 'Completed', '0.3s', $3, $4, 1, NOW())`,
        [wf.id, userId, `${quote.customer_name || 'Customer'} (${quote.quote_number || 'Quote'})`, parseFloat(quote.total_amount || 0)]
      ).catch(e => console.error('[Workflow Run Insert Error]', e.message))
    }
  } catch (err) {
    console.error('[Quote Workflow Trigger Error]', err.message)
  }
}

const decreaseProductStockForQuote = async (items, userId) => {
  if (!Array.isArray(items)) return
  for (const item of items) {
    if (!item) continue
    const qty = parseFloat(item.quantity || item.qty || 1)
    const prodId = item.product_id || item.id

    if (prodId) {
      await pool.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2`,
        [qty, prodId]
      ).catch(e => console.error('[Stock Decrease Error by ID]', e.message))
    } else if (item.name) {
      await pool.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE name ILIKE $2 AND (user_id::text = $3::text OR user_id = 'default-user' OR $3 = 'default-user')`,
        [qty, item.name.trim(), userId || 'default-user']
      ).catch(e => console.error('[Stock Decrease Error by Name]', e.message))
    }
  }
}

const sendInvoiceEmailToCustomer = async (quote, bill, billItems) => {
  if (!quote?.customer_email) return

  const shopProfileRes = await pool.query('SELECT shop_name, phone, gstin, email, address FROM shop_profiles WHERE user_id::text = $1::text LIMIT 1', [quote.user_id || 'default-user']).catch(() => ({ rows: [] }))
  const shop = shopProfileRes.rows[0] || {}
  const sellerName = shop.shop_name || quote.shop_name || 'Busetty Traders'
  const sellerPhone = shop.phone || ''
  const sellerGstin = shop.gstin || ''
  const sellerAddress = shop.address || ''

  const invNum = bill?.bill_number || `INV-${String(bill?.id || 1).padStart(4, '0')}`
  const totalAmount = parseFloat(bill?.amount || bill?.total_amount || quote?.total_amount || 0)
  const taxAmt = parseFloat(quote?.tax_amount || 0)
  const subtotal = taxAmt > 0 ? totalAmount - taxAmt : totalAmount
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const dueDateObj = bill?.due_date ? new Date(bill.due_date) : new Date(Date.now() + 15 * 86400000)
  const dueDateStr = dueDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const subtotalFormatted = subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const cgstFormatted = cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sgstFormatted = sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const totalFormatted = totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const itemsHtml = (billItems || []).map((item, idx) => {
    const qty = parseFloat(item.quantity || item.qty || 1)
    const rate = parseFloat(item.price || item.rate || 0)
    const lineTotal = parseFloat(item.line_total || item.amount || (qty * rate))
    const unitStr = item.unit ? `<br/><span style="font-size:11px; color:#9ca3af;">${item.unit}</span>` : ''
    const formattedRate = rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const formattedTotal = lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return `
    <tr>
      <td style="padding:11px 12px; border-bottom:1px solid #f3f4f6; color:#9ca3af; font-size:13px;">${idx + 1}</td>
      <td style="padding:11px 12px; border-bottom:1px solid #f3f4f6; color:#111827; font-size:13px;">
        <div style="font-weight:600;">${item.product_name || item.name || 'Product'}</div>${unitStr}
      </td>
      <td style="padding:11px 12px; border-bottom:1px solid #f3f4f6; text-align:right; color:#111827; font-size:13px;">${qty}</td>
      <td style="padding:11px 12px; border-bottom:1px solid #f3f4f6; text-align:right; color:#111827; font-size:13px;">₹${formattedRate}</td>
      <td style="padding:11px 12px; border-bottom:1px solid #f3f4f6; text-align:right; font-weight:600; color:#111827; font-size:13px;">₹${formattedTotal}</td>
    </tr>
  `}).join('')

  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${invNum}</title>
      </head>
      <body style="margin:0; padding:0; background:#f8fafc; font-family:'Segoe UI', Arial, sans-serif; color:#111827;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc; padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:720px; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; padding:40px; box-shadow:0 4px 20px rgba(0,0,0,0.05); text-align:left;">
                <tr>
                  <td>
                    <!-- Header: Seller & TAX INVOICE -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px; padding-bottom:20px; border-bottom:2px solid #3d68f5;">
                      <tr>
                        <td align="left" valign="top">
                          <div style="font-size:22px; font-weight:800; color:#111827; margin-bottom:4px;">${sellerName}</div>
                          <div style="font-size:12px; color:#6b7280; line-height:1.6;">
                            ${sellerAddress ? `${sellerAddress}<br/>` : ''}
                            ${sellerPhone ? `Phone: ${sellerPhone}<br/>` : ''}
                            ${sellerGstin ? `GSTIN: ${sellerGstin}` : ''}
                          </div>
                        </td>
                        <td align="right" valign="top" style="text-align:right;">
                          <div style="font-size:28px; font-weight:800; color:#3d68f5; letter-spacing:-0.02em;">TAX INVOICE</div>
                          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">
                            Invoice No: <strong>${invNum}</strong><br/>
                            Date: ${dateStr}<br/>
                            Due: ${dueDateStr}<br/>
                            <span style="display:inline-block; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:700; background:#fef3c7; color:#92400e; margin-top:6px;">PENDING</span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Buyer & Payment Details -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                      <tr>
                        <td align="left" valign="top" width="60%">
                          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin-bottom:6px;">BILL TO</div>
                          <div style="font-size:15px; font-weight:700; color:#111827; margin-bottom:2px;">${quote.customer_name || 'General Customer'}</div>
                          <div style="font-size:12px; color:#6b7280; line-height:1.6;">
                            ${quote.customer_company ? `${quote.customer_company}<br/>` : ''}
                            ${quote.customer_email ? `${quote.customer_email}<br/>` : ''}
                            ${quote.customer_phone ? `Phone: ${quote.customer_phone}` : ''}
                          </div>
                        </td>
                        <td align="right" valign="top" width="40%" style="text-align:right;">
                          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin-bottom:6px;">PAYMENT</div>
                          <div style="font-size:12px; color:#6b7280; line-height:1.6;">
                            Status: <strong style="color:#d97706;">Pending</strong><br/>
                            Due by: ${dueDateStr}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Line Items Table -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin-bottom:24px; width:100%;">
                      <thead>
                        <tr style="background:#f8fafc;">
                          <th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1px solid #e5e7eb; width:35px;">#</th>
                          <th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1px solid #e5e7eb;">DESCRIPTION</th>
                          <th style="padding:10px 12px; text-align:right; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1px solid #e5e7eb;">QTY</th>
                          <th style="padding:10px 12px; text-align:right; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1px solid #e5e7eb;">UNIT PRICE</th>
                          <th style="padding:10px 12px; text-align:right; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1px solid #e5e7eb;">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>

                    <!-- Totals Breakdown -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                      <tr>
                        <td width="40%"></td>
                        <td width="60%" align="right">
                          <table width="260" border="0" cellspacing="0" cellpadding="0" style="font-size:13px; color:#6b7280; margin-left:auto;">
                            <tr>
                              <td style="padding:5px 0;" align="left">Subtotal</td>
                              <td style="padding:5px 0;" align="right">₹${subtotalFormatted}</td>
                            </tr>
                            ${taxAmt > 0 ? `
                            <tr>
                              <td style="padding:5px 0;" align="left">CGST (9%)</td>
                              <td style="padding:5px 0;" align="right">₹${cgstFormatted}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;" align="left">SGST (9%)</td>
                              <td style="padding:5px 0;" align="right">₹${sgstFormatted}</td>
                            </tr>
                            ` : ''}
                            <tr>
                              <td style="padding:10px 0 4px; font-size:15px; font-weight:800; color:#111827; border-top:2px solid #111827;" align="left">Grand Total</td>
                              <td style="padding:10px 0 4px; font-size:15px; font-weight:800; color:#111827; border-top:2px solid #111827;" align="right">₹${totalFormatted}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Footer -->
                    <div style="margin-top:36px; padding-top:16px; border-top:1px solid #e5e7eb; text-align:center; font-size:11px; color:#9ca3af;">
                      Thank you for your business! This is an official tax invoice generated by <strong>Workshop</strong>.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  // 1. Send invoice email to Customer
  await sendEmail({
    to: quote.customer_email,
    subject: `TAX INVOICE ${invNum} from ${sellerName}`,
    html: invoiceHtml
  }).catch(e => console.error('[Invoice Email Send Error Customer]', e.message))

  // 2. Send invoice email copy to Sender (Shop / Workspace)
  const senderEmail = shop.email || process.env.SMTP_USER
  if (senderEmail && senderEmail !== quote.customer_email) {
    await sendEmail({
      to: senderEmail,
      subject: `[Sender Copy] TAX INVOICE ${invNum} issued to ${quote.customer_name}`,
      html: invoiceHtml
    }).catch(e => console.error('[Invoice Email Send Error Sender]', e.message))
  }

  // 3. Save Email Log Record
  await pool.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS to_email TEXT`).catch(() => {})
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

/* ── GET /api/quotes ── */
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req)
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const offset = (page - 1) * limit
    const search = req.query.search || ''
    const status = req.query.status || ''

    let countQuery = 'SELECT COUNT(*) FROM quotes WHERE user_id = $1'
    let dataQuery  = 'SELECT * FROM quotes WHERE user_id = $1'
    const params   = [userId]
    let paramIdx   = 2

    if (search) {
      countQuery += ` AND (quote_number ILIKE $${paramIdx} OR customer_name ILIKE $${paramIdx})`
      dataQuery  += ` AND (quote_number ILIKE $${paramIdx} OR customer_name ILIKE $${paramIdx})`
      params.push(`%${search}%`)
      paramIdx++
    }

    if (status && status !== 'all') {
      countQuery += ` AND status ILIKE $${paramIdx}`
      dataQuery  += ` AND status ILIKE $${paramIdx}`
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
router.get('/respond', async (req, res) => {
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

    await pool.query(
      'UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2',
      [action, id]
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
          ${action === 'Accepted' ? '<p style="color:#16a34a; font-weight:bold;">✅ Invoice has been automatically generated in Billing.</p>' : ''}
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
          try { items = JSON.parse(quote.line_items) } catch {}
        }
        if (!Array.isArray(items)) items = []

        const billRes = await pool.query(
          `INSERT INTO bills (customer_id, items, amount, discount, status, due_date, notes, user_id, paid_at, created_at)
           VALUES ($1, $2, $3, 0, 'unpaid', NOW() + INTERVAL '15 days', $4, $5, NULL, NOW())
           RETURNING *`,
          [
            customerId,
            JSON.stringify(items),
            parseFloat(quote.total_amount || 0),
            `Generated from Quotation #${quote.quote_number}`,
            quote.user_id || 'default-user'
          ]
        )

        const bill = billRes.rows[0]
        const createdItems = []
        for (const item of items) {
          if (item && (item.name || item.product_id)) {
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
            ).catch(e => console.error('[Bill Item Insert Error]', e.message))
            if (itemRes?.rows[0]) createdItems.push(itemRes.rows[0])
          }
        }

        // Decrease product inventory stock for accepted quotation line items
        await decreaseProductStockForQuote(items, quote.user_id)

        // Send invoice email to customer asynchronously and trigger workflow automation safely
        sendInvoiceEmailToCustomer(quote, bill, createdItems.length > 0 ? createdItems : items).catch(e => console.error('[Invoice Email Send Error]', e.message))
        triggerWorkflowForQuote(quote.user_id || 'default-user', quote, 'Accepted').catch(e => console.error('[Workflow Trigger Error]', e.message))

        autoBillNotice = `<div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:18px; border-radius:12px; margin-top:20px; text-align:center;">
          <div style="font-size:1.15rem; font-weight:800; margin-bottom:6px; color:#047857;">Official Billing Invoice Issued Successfully</div>
          <div style="font-size:0.95rem; line-height:1.5;">Invoice <strong>#${billNumber}</strong> has been generated and sent to Unpaid Bills. The official billing invoice will come to your mail (<strong>${quote.customer_email || 'customer'}</strong>) — please check your inbox!</div>
        </div>`
      } catch (billErr) {
        console.error('[Auto Bill Generation Error]', billErr.message)
        autoBillNotice = `<div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:18px; border-radius:12px; margin-top:20px; text-align:center;">
          <div style="font-size:1rem; font-weight:700;">Quotation response recorded successfully. The official billing invoice will come to your mail — please check your inbox!</div>
        </div>`
      }
    } else {
      autoBillNotice = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:16px; border-radius:10px; margin-top:20px; text-align:center;">
        <div style="font-size:1rem; font-weight:700;">Quotation Declined</div>
        <div style="font-size:0.875rem; margin-top:4px;">No billing invoice has been generated.</div>
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
router.post('/:id/convert-to-bill', async (req, res) => {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1 AND user_id = $2', [id, userId])
    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const quote = quoteRes.rows[0]
    const billNumber = `INV-${Date.now().toString().slice(-6)}`

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
      try { items = JSON.parse(quote.line_items) } catch {}
    }
    if (!Array.isArray(items)) items = []

    const billRes = await pool.query(
      `INSERT INTO bills (customer_id, items, amount, discount, status, due_date, notes, user_id, paid_at, created_at)
       VALUES ($1, $2, $3, 0, 'unpaid', NOW() + INTERVAL '15 days', $4, $5, NULL, NOW())
       RETURNING *`,
      [
        customerId,
        JSON.stringify(items),
        parseFloat(quote.total_amount || 0),
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

    await pool.query("UPDATE quotes SET status = 'Accepted', updated_at = NOW() WHERE id = $1", [id])

    // Decrease product inventory stock for accepted quotation line items
    await decreaseProductStockForQuote(items, userId)

    // Send invoice email to customer and trigger workflow automation
    const updatedQuote = { ...quote, status: 'Accepted' }
    await sendInvoiceEmailToCustomer(updatedQuote, bill, createdItems.length > 0 ? createdItems : items)
    await triggerWorkflowForQuote(userId, updatedQuote, 'Accepted')

    res.json({ message: 'Converted to bill successfully and invoice sent to customer', bill })
  } catch (err) {
    console.error('[Convert to Bill Error]', err)
    res.status(500).json({ error: 'Failed to convert quote to bill' })
  }
})

/* ── POST /api/quotes/:id/send-email ── */
router.post('/:id/send-email', async (req, res) => {
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

    const backendBase = process.env.BACKEND_URL || 'http://localhost:5000'
    const acceptUrl  = `${backendBase}/api/quotes/respond?id=${quote.id}&action=Accepted`
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

    const items = Array.isArray(quote.line_items) ? quote.line_items : []
    const itemsHtml = items.map(item => {
      const unitStr = item.unit ? ` ${item.unit}` : ''
      const subtextStr = item.subtext ? `<br/><span style="font-size:11px; color:#0d9488; font-weight:600;">${item.subtext}</span>` : ''
      return `
      <tr>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#1e293b;">
          <strong>${item.name || 'Product'}</strong>${subtextStr}
        </td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:center; color:#475467;">${item.quantity || 1}${unitStr}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:right; color:#475467;">₹${parseFloat(item.rate || 0).toFixed(2)}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#0f172a;">₹${parseFloat(item.amount || 0).toFixed(2)}</td>
      </tr>
    `}).join('')

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Quotation #${quote.quote_number}</title>
        </head>
        <body style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:24px 12px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; text-align:left;">

                  <!-- Header Logo Bar -->
                  <tr>
                    <td align="center" style="padding:12px 0 20px;">
                      <table border="0" cellspacing="0" cellpadding="0" align="center">
                        <tr>
                          <td style="vertical-align:middle; padding-right:10px;">
                            <div style="width:34px; height:34px; background:#2563eb; border-radius:8px; color:#ffffff; font-weight:900; font-size:18px; line-height:34px; text-align:center;">W</div>
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:20px; font-weight:800; color:#1e293b; letter-spacing:-0.5px;">Workshop</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Main Card -->
                  <tr>
                    <td>
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.06);">
                        
                        <!-- Header Blue Banner -->
                        <tr>
                          <td style="background:#2563eb; background:linear-gradient(135deg, #1d4ed8, #2563eb); padding:28px 32px; color:#ffffff;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td align="left" valign="top">
                                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#ffffff; opacity:0.85; margin-bottom:4px;">QUOTATION</div>
                                  <div style="font-size:22px; font-weight:800; color:#ffffff; line-height:28px; margin:0;">#${quote.quote_number}</div>
                                </td>
                                <td align="right" valign="top" style="text-align:right;">
                                  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#ffffff; opacity:0.85; margin-bottom:4px;">Total Amount</div>
                                  <div style="font-size:26px; font-weight:900; color:#ffffff; line-height:32px; margin:0;">₹${parseFloat(quote.total_amount || 0).toFixed(2)}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                          <td style="padding:28px 32px;">
                            <p style="font-size:15px; color:#1e293b; margin:0 0 6px;">Dear <strong>${quote.customer_name}</strong>,</p>
                            <p style="font-size:14px; color:#475467; margin:0 0 24px; line-height:1.6;">
                              We are pleased to share your quotation. Please review the details below and respond with your decision.
                            </p>

                             <!-- Meta Info Table (2-column layout in email HTML) -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:24px; border-collapse:collapse;">
                              <tr>
                                <td width="50%" valign="top" style="padding:14px 16px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">FROM (SHOP / SUPPLIER)</div>
                                  <div style="font-size:13px; font-weight:700; color:#1e40af;">${quote.shop_name || 'Workshop Store'}</div>
                                </td>
                                <td width="50%" valign="top" style="padding:14px 16px; border-bottom:1px solid #e2e8f0;">
                                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">TO (CUSTOMER / COMPANY)</div>
                                  <div style="font-size:13px; font-weight:700; color:#0f172a;">${quote.customer_name} ${quote.customer_company ? `(${quote.customer_company})` : ''}</div>
                                </td>
                              </tr>
                              <tr>
                                <td width="50%" valign="top" style="padding:14px 16px; border-right:1px solid #e2e8f0;">
                                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">ISSUE DATE</div>
                                  <div style="font-size:13px; font-weight:700; color:#0f172a;">${issueDateFmt}</div>
                                </td>
                                <td width="50%" valign="top" style="padding:14px 16px;">
                                  <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">VALID UNTIL</div>
                                  <div style="font-size:13px; font-weight:700; color:#0f172a;">${validUntilFmt}</div>
                                </td>
                              </tr>
                            </table>

                            <!-- Line Items Table -->
                            <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:20px;">
                              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:13px;">
                                <thead>
                                  <tr style="background:#f1f5f9;">
                                    <th style="padding:10px 14px; text-align:left; font-weight:700; color:#374151; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">ITEM</th>
                                    <th style="padding:10px 14px; text-align:center; font-weight:700; color:#374151; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">QTY</th>
                                    <th style="padding:10px 14px; text-align:right; font-weight:700; color:#374151; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">RATE</th>
                                    <th style="padding:10px 14px; text-align:right; font-weight:700; color:#374151; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">AMOUNT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${itemsHtml}
                                </tbody>
                              </table>
                            </div>

                            <!-- Total Row -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; padding:12px 16px; margin-bottom:28px;">
                              <tr>
                                <td align="right" style="text-align:right;">
                                  ${parseFloat(quote.tax_amount || 0) > 0 ? `<div style="font-size:13px; color:#64748b; margin-bottom:4px;">Tax: ₹${parseFloat(quote.tax_amount).toFixed(2)}</div>` : ''}
                                  <div style="font-size:20px; font-weight:800; color:#0f172a;">Total: ₹${parseFloat(quote.total_amount || 0).toFixed(2)}</div>
                                </td>
                              </tr>
                            </table>

                            <!-- CTA Buttons -->
                            <div style="text-align:center; margin-bottom:24px;">
                              <p style="font-size:14px; font-weight:700; color:#1e293b; margin:0 0 16px; text-align:center;">Please respond to this quotation:</p>
                              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                                <tr>
                                  <td align="center" style="padding:0 8px;">
                                    <a href="${acceptUrl}" target="_blank" style="background:#16a34a; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:700; font-size:14px; display:inline-block; line-height:20px; box-shadow:0 3px 10px rgba(22,163,74,0.25);">
                                      ✓ Accept Quotation
                                    </a>
                                  </td>
                                  <td align="center" style="padding:0 8px;">
                                    <a href="${declineUrl}" target="_blank" style="background:#dc2626; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:700; font-size:14px; display:inline-block; line-height:20px; box-shadow:0 3px 10px rgba(220,38,38,0.25);">
                                      ✕ Reject Quotation
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="font-size:12px; color:#94a3b8; margin:16px 0 0; text-align:center;">Clicking <strong>Accept</strong> will automatically confirm this quotation and generate your billing invoice.</p>
                            </div>

                            ${quote.notes ? `<div style="background:#fafafa; border-left:3px solid #2563eb; border-radius:6px; padding:12px 16px; font-size:13px; color:#475467; line-height:1.5; margin-top:16px;"><strong style="color:#1e293b;">Notes:</strong> ${quote.notes}</div>` : ''}

                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 32px; text-align:center;">
                            <p style="margin:0; font-size:12px; color:#94a3b8;">
                              This is an automated quotation email from <strong style="color:#64748b;">Workshop</strong>. Please do not reply to this email.
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

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
router.post('/', async (req, res) => {
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
        finalShopName = 'Workshop Store'
      }
    }

    const qNum = quote_number || `QT-${Date.now().toString().slice(-6)}`
    const itemsJson = JSON.stringify(line_items)

    const result = await pool.query(
      `INSERT INTO quotes (
        quote_number, shop_name, customer_company, customer_name, customer_phone, customer_email, 
        total_amount, tax_amount, status, issue_date, valid_until, 
        notes, line_items, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        qNum, finalShopName, customer_company, customer_name, customer_phone, customer_email,
        parseFloat(total_amount || 0), parseFloat(tax_amount || 0),
        status, issue_date, valid_until || null, notes, itemsJson, userId
      ]
    )

    const createdQuote = result.rows[0]

    // Trigger workflow automation
    await triggerWorkflowForQuote(userId, createdQuote, 'Record created')

    res.status(201).json(createdQuote)
  } catch (err) {
    console.error('[Quotes POST Error]', err)
    res.status(500).json({ error: 'Failed to create quote' })
  }
})

/* ── PUT /api/quotes/:id ── */
router.put('/:id', async (req, res) => {
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
        status = COALESCE($9, status),
        issue_date = COALESCE($10, issue_date),
        valid_until = COALESCE($11, valid_until),
        notes = COALESCE($12, notes),
        line_items = COALESCE($13, line_items),
        updated_at = NOW()
      WHERE id = $14 AND user_id = $15
      RETURNING *`,
      [
        quote_number, shop_name, customer_company, customer_name, customer_phone, customer_email,
        total_amount !== undefined ? parseFloat(total_amount) : null,
        tax_amount !== undefined ? parseFloat(tax_amount) : null,
        status, issue_date, valid_until, notes, itemsJson, id, userId
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' })
    }

    const updatedQuote = result.rows[0]

    // Trigger workflow automation
    await triggerWorkflowForQuote(userId, updatedQuote, 'Record updated')

    res.json(updatedQuote)
  } catch (err) {
    console.error('[Quotes PUT Error]', err)
    res.status(500).json({ error: 'Failed to update quote' })
  }
})

/* ── DELETE /api/quotes/:id ── */
router.delete('/:id', async (req, res) => {
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
