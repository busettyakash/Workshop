import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { query } from '../lib/db.js'
import crypto from 'crypto'
import insforge from '../lib/insforge.js'
import { sendEmail } from '../lib/smtp.js'

const router = Router()
router.use(requireAuth)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/* POST /api/chat — send a message and get AI response */
const tools = [
  {
    type: 'function',
    function: {
      name: 'add_to_import_stock',
      description: 'Adds a product/item to the staged import stock (import_stock table). Use this when the user wants to add, import, stage, or register new stock items or products.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the product/item' },
          sku: { type: 'string', description: 'Unique SKU code for the product' },
          category: { type: 'string', description: 'Category of the product' },
          price: { type: 'number', description: 'Price per unit' },
          stock: { type: 'number', description: 'Quantity of stock to import. Defaults to 0.' },
          unit: { type: 'string', description: 'Unit of measurement, e.g. "pcs", "kg", "box". Defaults to "pcs".' },
          description: { type: 'string', description: 'Detailed description of the product' },
          status: { type: 'string', enum: ['pending', 'added'], description: 'Staging status, defaults to "pending"' }
        },
        required: ['name', 'price']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_business_data',
      description: 'Queries business data such as products, bills, quotes, people/contacts, import stock, notes, deals, or analytics summaries. Use this to retrieve information about inventory, invoices, quotations, contacts, or sales performance.',
      parameters: {
        type: 'object',
        properties: {
          dataset: {
            type: 'string',
            enum: ['products', 'bills', 'quotes', 'people', 'import_stock', 'notes', 'deals', 'top_products', 'revenue_summary', 'quotes_summary'],
            description: 'The dataset to query'
          },
          search: { type: 'string', description: 'Optional keyword to search across names, SKUs, or titles' },
          status: { type: 'string', description: 'Optional status filter (e.g. active, paid, unpaid, pending, accepted)' },
          limit: { type: 'number', description: 'Maximum number of items to retrieve (default 20, max 50)' }
        },
        required: ['dataset']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Sends an email to a recipient via SMTP and records it in the database emails table. Use this whenever the user asks you to send, dispatch, or write an email.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'The recipient email address' },
          subject: { type: 'string', description: 'The email subject line' },
          body: { type: 'string', description: 'The body content of the email' }
        },
        required: ['to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Creates a new note in the database notes table. Use this when the user asks you to take, save, create, or add a note.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the note' },
          body: { type: 'string', description: 'Content/body of the note' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_person',
      description: 'Creates a new person/contact (Lead, Prospect, Customer, Partner, Vendor, or Other) in the database people table. Use this when the user asks to add or create a new contact, customer, lead, vendor, supplier, or partner.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the contact' },
          email: { type: 'string', description: 'Email address of the contact' },
          phone: { type: 'string', description: 'Phone number of the contact' },
          company: { type: 'string', description: 'Company or business name associated with this contact' },
          persona: { type: 'string', enum: ['Lead', 'Prospect', 'Customer', 'Partner', 'Vendor', 'Other'], description: 'Role or persona of the contact (Lead, Prospect, Customer, Partner, Vendor, Other). When the user asks to add a vendor or supplier, persona MUST be "Vendor". Defaults to "Lead"' },
          notes: { type: 'string', description: 'Any extra notes about this contact' }
        },
        required: ['name']
      }
    }
  }
]

/* POST /api/chat — send a message and get AI response */
router.post('/', async (req, res) => {
  const { messages, conversationId, title } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }

  const userId = req.workspaceId
  const lastMsg = messages[messages.length - 1]?.content || ''

  // ── Redis Cache Check ──
  const cacheKey = `chat_cache:${userId}:${crypto.createHash('sha256').update(lastMsg.toLowerCase().trim()).digest('hex')}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log('[REDIS] Cache Hit for query:', lastMsg)
      saveSession(userId, conversationId, messages, cached, title).catch(err => {
        console.warn('[DB] Session save failed:', err.message)
      })
      return res.json({ content: cached, cached: true })
    }
  } catch (cacheErr) {
    console.warn('[REDIS] Cache read failed:', cacheErr.message)
  }

  try {
    // ── Handle Deal P2P Chat Bypassing AI ──
    if (conversationId && conversationId.startsWith('deal-')) {
      const dealIdStr = conversationId.split('-')[1]
      const dealId = parseInt(dealIdStr, 10)
      if (!isNaN(dealId)) {
        const dealCheck = await query('SELECT * FROM deals WHERE id = $1 AND (user_id = $2 OR company_shop_id = $2)', [dealId, userId])
        if (dealCheck.rows.length > 0) {
          const deal = dealCheck.rows[0]
          const senderName = deal.user_id === userId ? 'Seller' : 'Buyer'

          const currentSession = await query('SELECT messages FROM chat_sessions WHERE conversation_id = $1', [conversationId])
          let dbMessages = currentSession.rows[0]?.messages || []
          
          dbMessages.push({
            id: Date.now(),
            role: 'user',
            content: `**${senderName}:** ${lastMsg}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })

          await query(`UPDATE chat_sessions SET messages = $1::jsonb, last_message = $2, updated_at = NOW() WHERE conversation_id = $3`, [JSON.stringify(dbMessages), lastMsg.slice(0, 255), conversationId])
          
          // Notify counterparty
          const targetUserId = deal.user_id === userId ? deal.company_shop_id : deal.user_id
          if (targetUserId) {
            try {
              const notifTitle = `New message from ${senderName}`
              const notifBody = `New message in deal "${deal.title}": ${lastMsg}`
              const notifLink = deal.user_id === targetUserId ? `/deals/edit/${deal.id}` : `/deals/review/${deal.id}`
              
              await query(
                `INSERT INTO notifications (user_id, title, body, type, read, link, created_at)
                 VALUES ($1, $2, $3, 'info', false, $4, NOW())`,
                [targetUserId, notifTitle, notifBody, notifLink]
              )
              
              await insforge.realtime.publish(`notifications:${targetUserId}`, {
                event: 'new_notification',
                payload: { title: notifTitle, body: notifBody, link: notifLink }
              }).catch(() => {})
            } catch (err) {
              console.error('Failed to notify counterparty:', err.message)
            }
          }

          // Send system confirmation
          return res.json({ content: `*Message delivered to ${senderName === 'Seller' ? 'Buyer' : 'Seller'}.*`, cached: false })
        }
      }
    }

    // ── Call OpenRouter ──
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' })
    }

    const systemPrompt = {
      role: 'system',
      content: `You are Workshop AI, a helpful business assistant for a retail/wholesale management platform called Workshop. 
You help users with: sales analysis, inventory management, customer relations, billing, workflow automation, and business insights.
Be concise, friendly, and actionable. Use markdown for formatting when helpful. Current context: Indian retail/wholesale business platform.

You have access to tools to:
1. Add products to the staged import stock (import_stock)
2. Run read-only database queries to retrieve context (query_database_readonly)
3. Send emails to customers/suppliers (send_email)
4. Create/add new notes to the database (add_note)
5. Create new contacts/people (create_person)

Database tables available for SELECT queries:
- products: id, name, sku, hsn_code, category, price, price_covers, updated_price, updated_price_date, stock, loose_kg, bag_weight, unit, status, description, user_id, created_at, updated_at
- import_stock: id, name, sku, category, price, stock, loose_kg, bag_weight, unit, status, description, buying_price, price_covers, user_id, created_at, updated_at
- people: id, name, email, phone, company, persona, status, notes, user_id, created_at, updated_at (stores customers, leads, prospects, partners, vendors)
- bills: id, bill_number, customer_id, amount, discount, tax_rate, status (paid/unpaid/cancelled), due_date, notes, order_number, paid_at, user_id, created_at, updated_at
- bill_items: id, bill_id, product_id, name, qty, price, discount, unit, hsn_code, user_id, created_at (each row is one line item in a bill)
- quotes: id, quote_number, customer_name, customer_phone, customer_email, total_amount, tax_amount, status, issue_date, valid_until, notes, line_items, user_id, created_at, updated_at
- deals: id, title, value, stage, owner, close_date, notes, status, user_id, created_at, updated_at
- deal_logs: id, deal_id, deal_title, event, from_value, to_value, done_by, user_id, created_at
- notes: id, title, body, user_id, created_at, updated_at
- emails: id, from_name, from_email, subject, body, preview, is_read, starred, direction, user_id, created_at, updated_at
- product_stock_history: id, product_id, user_id, change_type, qty_change, stock_before, stock_after, source, source_ref, notes, created_at
- product_price_history: id, product_id, user_id, old_price, new_price, effective_date, notes, created_at

CRITICAL DISPLAY & FORMATTING RULES:
- When presenting product tables, bills, stock, or business data in markdown tables or lists, NEVER include internal technical database columns like "id", "ID", "user_id", or numerical primary keys.
- Present clean, business-friendly columns such as: Name, SKU, Category, Price (₹), Stock, Status, Unit, Description.
- Format all currency and prices with the Rupee symbol (₹).

Always call query_business_data to get real-time accurate information when asked about business data (e.g. products, bills, quotes, people/customers, or sales summaries) instead of using placeholders or dump data.`
    }

    let apiMessages = [systemPrompt, ...messages.map(m => ({ role: m.role, content: m.content }))]
    let loopCount = 0
    let finalContent = ''

    while (loopCount < 5) {
      let response
      let lastErrText = ''
      const MODELS = ['openai/gpt-4o-mini', 'openrouter/free', 'meta-llama/llama-3.3-70b-instruct']

      for (const modelCandidate of MODELS) {
        try {
          const resCandidate = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://workshop.app',
              'X-Title': 'Workshop AI Assistant'
            },
            body: JSON.stringify({
              model: modelCandidate,
              messages: apiMessages,
              tools: tools,
              max_tokens: 1024,
              temperature: 0.7
            })
          })

          if (resCandidate.ok) {
            response = resCandidate
            break
          } else {
            lastErrText = await resCandidate.text()
            console.warn(`[OPENROUTER MODEL FAIL] ${modelCandidate} status ${resCandidate.status}: ${lastErrText}`)
          }
        } catch (fetchErr) {
          lastErrText = fetchErr.message
          console.warn(`[OPENROUTER FETCH ERROR] ${modelCandidate}: ${fetchErr.message}`)
        }
      }

      if (!response || !response.ok) {
        console.error('[OPENROUTER ALL MODELS FAILED]', lastErrText)
        return res.status(502).json({ error: 'AI service unavailable', details: lastErrText })
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message
      if (!message) {
        throw new Error('Empty response from AI model')
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant's message with tool calls to history
        apiMessages.push(message)

        for (const toolCall of message.tool_calls) {
          const { name: toolName, arguments: toolArgsStr } = toolCall.function
          let args = {}
          try {
            args = JSON.parse(toolArgsStr)
          } catch (e) {
            console.error('[TOOL PARSE ERROR]', e)
          }

          let toolResult
          try {
            if (toolName === 'add_to_import_stock') {
              const { name, sku, category, price, stock, status, unit, description } = args
              if (!name || price === undefined) {
                toolResult = { error: 'name and price are required' }
              } else {
                const { rows } = await query(
                  `INSERT INTO import_stock (name, sku, category, price, stock, status, unit, description, user_id, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
                  [name, sku || null, category || null, price, stock || 0, status || 'pending', unit || 'pcs', description || null, userId]
                )
                await redis.del(`import_stock:${userId}`).catch(() => {})
                toolResult = { success: true, product: rows[0] }
              }
            } else if (toolName === 'query_business_data') {
              const { dataset, search, status, limit: rawLimit } = args || {}
              const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 50)
              const searchPattern = search ? `%${search.trim()}%` : null

              try {
                switch (dataset) {
                  case 'products': {
                    let res
                    if (searchPattern && status) {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM products WHERE user_id = $1 AND status = $2 AND (name ILIKE $3 OR sku ILIKE $3) ORDER BY id DESC LIMIT $4',
                        [userId, status, searchPattern, limit]
                      )
                    } else if (searchPattern) {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM products WHERE user_id = $1 AND (name ILIKE $2 OR sku ILIKE $2) ORDER BY id DESC LIMIT $3',
                        [userId, searchPattern, limit]
                      )
                    } else if (status) {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM products WHERE user_id = $1 AND status = $2 ORDER BY id DESC LIMIT $3',
                        [userId, status, limit]
                      )
                    } else {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM products WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                        [userId, limit]
                      )
                    }
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'import_stock': {
                    let res
                    if (searchPattern) {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM import_stock WHERE user_id = $1 AND (name ILIKE $2 OR sku ILIKE $2) ORDER BY id DESC LIMIT $3',
                        [userId, searchPattern, limit]
                      )
                    } else {
                      res = await query(
                        'SELECT name, sku, category, price, stock, unit, status, description FROM import_stock WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                        [userId, limit]
                      )
                    }
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'bills': {
                    let res
                    if (status) {
                      res = await query(
                        'SELECT b.id, b.amount, b.discount, b.status, b.due_date, b.created_at, p.name AS customer_name FROM bills b LEFT JOIN people p ON b.customer_id = p.id WHERE b.user_id = $1 AND b.status = $2 ORDER BY b.id DESC LIMIT $3',
                        [userId, status, limit]
                      )
                    } else {
                      res = await query(
                        'SELECT b.id, b.amount, b.discount, b.status, b.due_date, b.created_at, p.name AS customer_name FROM bills b LEFT JOIN people p ON b.customer_id = p.id WHERE b.user_id = $1 ORDER BY b.id DESC LIMIT $2',
                        [userId, limit]
                      )
                    }
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'quotes': {
                    let res
                    if (status) {
                      res = await query(
                        'SELECT quote_number, customer_name, customer_email, total_amount, status, issue_date, valid_until FROM quotes WHERE user_id = $1 AND status = $2 ORDER BY id DESC LIMIT $3',
                        [userId, status, limit]
                      )
                    } else {
                      res = await query(
                        'SELECT quote_number, customer_name, customer_email, total_amount, status, issue_date, valid_until FROM quotes WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                        [userId, limit]
                      )
                    }
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'people': {
                    let res
                    if (searchPattern) {
                      res = await query(
                        'SELECT name, email, phone, company, persona, status, notes FROM people WHERE user_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR company ILIKE $2) ORDER BY id DESC LIMIT $3',
                        [userId, searchPattern, limit]
                      )
                    } else {
                      res = await query(
                        'SELECT name, email, phone, company, persona, status, notes FROM people WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                        [userId, limit]
                      )
                    }
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'notes': {
                    const res = await query(
                      'SELECT title, content, created_at FROM notes WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                      [userId, limit]
                    )
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'deals': {
                    const res = await query(
                      'SELECT title, value, stage, owner, close_date, status FROM deals WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
                      [userId, limit]
                    )
                    toolResult = { success: true, count: res.rows.length, data: res.rows }
                    break
                  }

                  case 'revenue_summary': {
                    const res = await query(
                      'SELECT created_at::date AS day, COUNT(*) AS total_bills, SUM(amount) AS revenue FROM bills WHERE user_id = $1 GROUP BY day ORDER BY day DESC LIMIT $2',
                      [userId, limit]
                    )
                    toolResult = { success: true, data: res.rows }
                    break
                  }

                  case 'top_products': {
                    const res = await query(
                      'SELECT bi.name, SUM(bi.qty) AS total_qty FROM bill_items bi WHERE bi.user_id = $1 GROUP BY bi.name ORDER BY total_qty DESC LIMIT $2',
                      [userId, limit]
                    )
                    toolResult = { success: true, data: res.rows }
                    break
                  }

                  case 'quotes_summary': {
                    const res = await query(
                      'SELECT status, COUNT(*) AS count, SUM(total_amount) AS total_value FROM quotes WHERE user_id = $1 GROUP BY status',
                      [userId]
                    )
                    toolResult = { success: true, data: res.rows }
                    break
                  }

                  default:
                    toolResult = { error: `Unsupported dataset: ${dataset}` }
                }
              } catch (queryErr) {
                toolResult = { error: queryErr.message }
              }
            } else if (toolName === 'send_email') {
              const { to, subject, body } = args
              if (!to || !subject || !body) {
                toolResult = { error: 'to, subject and body are required' }
              } else {
                // 1. Record sent email in DB
                const { rows } = await query(
                  `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, user_id, created_at, updated_at)
                   VALUES ('Me', $1, $2, $3, $4, 'sent', $5, NOW(), NOW()) RETURNING *`,
                  [to.trim(), subject.trim(), body, body.slice(0, 120), userId]
                )
                
                // Invalidate emails cache
                try {
                  const keys = await redis.keys(`emails:${userId}:*`).catch(() => [])
                  for (const key of keys) {
                    await redis.del(key).catch(() => {})
                  }
                } catch (cErr) {
                  console.error('[Emails AI Cache Invalidation Error]', cErr.message)
                }

                // Also create an inbox copy for registered recipients.
                try {
                  const recipientEmail = to.toLowerCase().trim()
                  const senderEmail = req.user?.email || ''
                  let recipientUserId = recipientEmail === senderEmail.toLowerCase().trim() ? userId : null

                  if (!recipientUserId) {
                    const recipientRes = await query(
                      'SELECT user_id FROM shop_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
                      [recipientEmail]
                    )
                    recipientUserId = recipientRes.rows[0]?.user_id || null
                  }

                  if (recipientUserId) {
                    await query(
                      `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, user_id, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, 'inbox', $6, NOW(), NOW())`,
                      [req.user?.shopName || senderEmail || 'Me', senderEmail || 'Me', subject.trim(), body, body.slice(0, 120), recipientUserId]
                    )

                    const recipientKeys = await redis.keys(`emails:${recipientUserId}:*`).catch(() => [])
                    for (const key of recipientKeys) {
                      await redis.del(key).catch(() => {})
                    }
                  }
                } catch (inboxErr) {
                  console.error('[Emails AI Recipient Inbox Error]', inboxErr.message)
                }

                // 2. Deliver via SMTP
                await sendEmail({
                  to: to.trim(),
                  subject: subject.trim(),
                  html: body.replace(/\n/g, '<br/>')
                })
                
                toolResult = { success: true, email: rows[0], message: 'Email sent successfully via SMTP' }
              }
            } else if (toolName === 'add_note') {
              const { title, body = '' } = args
              if (!title) {
                toolResult = { error: 'title is required' }
              } else {
                const { rows } = await query(
                  `INSERT INTO notes (title, body, user_id, created_at, updated_at)
                   VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
                  [title.trim(), body, userId]
                )

                // Invalidate notes cache
                try {
                  const keys = await redis.keys(`notes:${userId}:*`).catch(() => [])
                  for (const key of keys) {
                    await redis.del(key).catch(() => {})
                  }
                } catch (cErr) {
                  console.error('[Notes AI Cache Invalidation Error]', cErr.message)
                }

                toolResult = { success: true, note: rows[0] }
              }
            } else if (toolName === 'create_person') {
              const { name, email = '', phone = '', company = '', persona = 'Lead', notes = '' } = args
              if (!name) {
                toolResult = { error: 'name is required' }
              } else {
                const validPersonas = ['Lead', 'Prospect', 'Customer', 'Partner', 'Vendor', 'Other']
                const matchedPersona = validPersonas.find(p => p.toLowerCase() === String(persona).toLowerCase()) || persona || 'Lead'
                const compVal = company && company.trim() ? company.trim() : null

                const { rows } = await query(
                  `INSERT INTO people (name, email, phone, company, company_name, persona, notes, user_id, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
                  [name.trim(), email.trim(), phone.trim(), compVal, compVal, matchedPersona, notes, userId]
                )

                // Invalidate people cache if any
                try {
                  const pKeys = await redis.keys(`people:${userId}:*`).catch(() => [])
                  for (const key of pKeys) {
                    await redis.del(key).catch(() => {})
                  }
                } catch { }

                toolResult = { success: true, person: rows[0] }
              }
            } else {
              toolResult = { error: `Unknown tool: ${toolName}` }
            }
          } catch (err) {
            console.error('[TOOL EXECUTION ERROR]', err)
            toolResult = { error: err.message }
          }

          // Push tool response
          apiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(toolResult)
          })
        }

        loopCount++
      } else {
        finalContent = message.content || 'Sorry, I could not generate a response.'
        break
      }
    }

    const content = finalContent || 'Sorry, I could not generate a response.'

    // Save to Redis Cache
    try {
      await redis.set(cacheKey, content, { ex: 3600 })
      console.log('[REDIS] Cache Saved for query:', lastMsg)
    } catch (cacheErr) {
      console.warn('[REDIS] Cache write failed:', cacheErr.message)
    }

    // ── Save session to DB ──
    saveSession(userId, conversationId, messages, content, title).catch(err => {
      console.warn('[DB] Session save failed:', err.message)
    })

    res.json({ content, cached: false })
  } catch (err) {
    console.error('[CHAT ERROR]', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/chat/sessions — list chat sessions for the user */
router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, conversation_id, title, last_message, updated_at 
       FROM chat_sessions 
       WHERE user_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 20`,
      [req.workspaceId]
    )
    res.json(rows)
  } catch (err) {
    console.error('Sessions list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* GET /api/chat/sessions/:id — get full session details and messages */
router.get('/sessions/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, conversation_id, title, messages, last_message, updated_at 
       FROM chat_sessions 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.workspaceId]
    )

    if (rows.length > 0) {
      return res.json({
        id: rows[0].id,
        conversation_id: rows[0].conversation_id,
        title: rows[0].title,
        messages: rows[0].messages || [],
        last_message: rows[0].last_message,
        updated_at: rows[0].updated_at
      })
    }

    // Fallback check for deal peer-to-peer chats if needed
    const dealRows = await query(
      `SELECT cs.id, cs.conversation_id, cs.title, cs.messages, cs.last_message, cs.updated_at 
       FROM chat_sessions cs
       WHERE cs.id = $1 AND cs.conversation_id IN (
         SELECT 'deal-' || id FROM deals WHERE user_id = $2::text OR company_shop_id = $2::text
       )`,
      [req.params.id, req.workspaceId]
    )

    if (!dealRows.length) return res.status(404).json({ error: 'Session not found' })

    res.json({
      id: dealRows[0].id,
      conversation_id: dealRows[0].conversation_id,
      title: dealRows[0].title,
      messages: dealRows[0].messages || [],
      last_message: dealRows[0].last_message,
      updated_at: dealRows[0].updated_at
    })
  } catch (err) {
    console.error('Session load error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* DELETE /api/chat/sessions/:id */
router.delete('/sessions/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.workspaceId]
    )
    res.json({ message: 'Session deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Helper: save/update chat session in DB
async function saveSession(userId, conversationId, messages, aiResponse, title) {
  const allMessages = [
    ...messages,
    { role: 'assistant', content: aiResponse }
  ]
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
  const sessionTitle = title || (lastUserMsg.length > 50 ? lastUserMsg.slice(0, 50) + '...' : lastUserMsg)

  if (conversationId) {
    // Upsert by conversation_id
    await query(
      `INSERT INTO chat_sessions (user_id, conversation_id, title, messages, last_message, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
       ON CONFLICT (conversation_id) DO UPDATE 
         SET messages = $4::jsonb, 
             last_message = $5, 
             title = COALESCE(EXCLUDED.title, chat_sessions.title),
             updated_at = NOW()`,
      [userId, conversationId, sessionTitle, JSON.stringify(allMessages), lastUserMsg.slice(0, 255)]
    )
  } else {
    await query(
      `INSERT INTO chat_sessions (user_id, title, messages, last_message, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())`,
      [userId, sessionTitle, JSON.stringify(allMessages), lastUserMsg.slice(0, 255)]
    )
  }
}

export default router
