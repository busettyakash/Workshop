import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import redis from '../lib/redis.js'
import { query } from '../lib/db.js'
import crypto from 'crypto'
import insforge from '../lib/insforge.js'
import { sendEmail } from '../lib/smtp.js'
import { deleteCachedPattern, clearMemoryCachePrefix, deleteCached } from '../lib/fastCache.js'
import { clearProductsCache } from './products.js'

const router = Router()
router.use(requireAuth)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/* POST /api/chat — send a message and get AI response */
const tools = [
  {
    type: 'function',
    function: {
      name: 'add_to_import_stock',
      description: 'Adds a product/item to the staged import stock (import_stock table). If a product with the same name or SKU already exists, it will automatically update the existing product instead of creating a duplicate.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the product/item' },
          sku: { type: 'string', description: 'Unique SKU code for the product' },
          category: { type: 'string', description: 'Category of the product (e.g. Grain, Flour, Oil)' },
          selling_price: { type: 'number', description: 'Selling price per unit/bag' },
          price: { type: 'number', description: 'Selling price per unit/bag (alias for selling_price)' },
          buying_price: { type: 'number', description: 'Buying price paid to supplier / buyer price (cost from supplier)' },
          buyer_name: { type: 'string', description: 'Supplier or buyer company name (e.g. "Mani Traders")' },
          buyer_phone: { type: 'string', description: 'Supplier or buyer phone number' },
          stock: { type: 'number', description: 'Quantity of stock to import. Defaults to 0.' },
          unit: { type: 'string', description: 'Unit of measurement, e.g. "Bags", "pcs", "kg". Defaults to "pcs".' },
          bag_weight: { type: 'number', description: 'Pack size or weight per bag in kg. Defaults to 1.' },
          description: { type: 'string', description: 'Detailed description of the product' },
          status: { type: 'string', enum: ['active', 'pending', 'added'], description: 'Staging status, defaults to "active"' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_import_stock',
      description: 'Updates or modifies an existing product/item in the staged import stock (import_stock table). Use this whenever the user wants to modify, edit, change price, change buying/buyer price, change selling price, change category, change status (e.g. active), or adjust stock of an EXISTING product.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Optional ID of the import stock item if known' },
          name: { type: 'string', description: 'Name of the product to find and update (case-insensitive match, e.g. "maida")' },
          sku: { type: 'string', description: 'SKU of the product to find and update' },
          category: { type: 'string', description: 'New/updated category (e.g. Grain)' },
          selling_price: { type: 'number', description: 'New/updated selling price per unit/bag (e.g. 400 or 4000)' },
          price: { type: 'number', description: 'New/updated selling price (alias)' },
          buying_price: { type: 'number', description: 'New/updated buying price / cost from supplier / buyer price (e.g. 3500)' },
          stock: { type: 'number', description: 'New/updated stock quantity' },
          unit: { type: 'string', description: 'Unit of measurement (e.g. "Bags", "pcs", "kg")' },
          bag_weight: { type: 'number', description: 'Pack size or weight per bag in kg' },
          buyer_name: { type: 'string', description: 'Supplier / buyer name (e.g. Mani Traders)' },
          buyer_phone: { type: 'string', description: 'Supplier phone number' },
          status: { type: 'string', enum: ['active', 'pending', 'added'], description: 'New status (e.g. "active", "pending", "added")' },
          description: { type: 'string', description: 'Updated description' }
        }
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
            description: 'The dataset to query. Use "import_stock" when asked about purchased stock, supplier payments, money owed to suppliers/buyers for stock batches, or remaining balance on imported products. Use "bills" for customer sales invoices.'
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
  },
  {
    type: 'function',
    function: {
      name: 'delete_import_stock',
      description: 'Deletes a product/item or duplicate items from staged import stock (import_stock table). Use this when user asks to delete or remove an item or duplicate from stock.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID of the import stock item' },
          name: { type: 'string', description: 'Name of the item to delete (case-insensitive)' },
          sku: { type: 'string', description: 'SKU of the item to delete' }
        }
      }
    }
  }
]

async function handleDealP2PChat(conversationId, userId, lastMsg) {
  if (!conversationId?.startsWith('deal-')) return null
  const dealIdStr = conversationId.split('-')[1]
  const dealId = Number.parseInt(dealIdStr, 10)
  if (Number.isNaN(dealId)) return null

  const dealCheck = await query('SELECT * FROM deals WHERE id = $1 AND (user_id = $2 OR company_shop_id = $2)', [dealId, userId])
  if (!dealCheck.rows.length) return null

  const deal = dealCheck.rows[0]
  const senderName = deal.user_id === userId ? 'Seller' : 'Buyer'

  const currentSession = await query('SELECT messages FROM chat_sessions WHERE conversation_id = $1', [conversationId])
  const dbMessages = currentSession.rows[0]?.messages || []

  dbMessages.push({
    id: Date.now(),
    role: 'user',
    content: `**${senderName}:** ${lastMsg}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })

  await query(
    `UPDATE chat_sessions SET messages = $1::jsonb, last_message = $2, updated_at = NOW() WHERE conversation_id = $3`,
    [JSON.stringify(dbMessages), lastMsg.slice(0, 255), conversationId]
  )

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
    } catch (_err) {
      console.error('Failed to notify counterparty:', _err.message)
    }
  }

  return `*Message delivered to ${senderName === 'Seller' ? 'Buyer' : 'Seller'}.*`
}

async function callOpenRouterWithFallback(apiMessages) {
  const MODELS = ['openai/gpt-4o-mini', 'openrouter/free', 'meta-llama/llama-3.3-70b-instruct']
  let lastErrText = ''

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
        return { ok: true, response: resCandidate }
      }
      lastErrText = await resCandidate.text()
      console.warn('[OPENROUTER MODEL FAIL] model=%s status=%s', modelCandidate, resCandidate.status)
    } catch (fetchErr) {
      lastErrText = fetchErr.message
      console.warn('[OPENROUTER FETCH ERROR] model=%s', modelCandidate)
    }
  }

  return { ok: false, error: lastErrText }
}

const DATASET_HANDLERS = {
  products: async (userId, searchPattern, status, limit) => {
    if (searchPattern && status) {
      return query('SELECT name, sku, hsn_code, category, price, stock, unit, status, description FROM products WHERE (user_id::text = $1::text OR user_id = \'default-user\' OR $1 = \'default-user\') AND status = $2 AND (name ILIKE $3 OR sku ILIKE $3 OR hsn_code ILIKE $3) ORDER BY id DESC LIMIT $4', [userId, status, searchPattern, limit])
    }
    if (searchPattern) {
      return query('SELECT name, sku, hsn_code, category, price, stock, unit, status, description FROM products WHERE (user_id::text = $1::text OR user_id = \'default-user\' OR $1 = \'default-user\') AND (name ILIKE $2 OR sku ILIKE $2 OR hsn_code ILIKE $2) ORDER BY id DESC LIMIT $3', [userId, searchPattern, limit])
    }
    if (status) {
      return query('SELECT name, sku, hsn_code, category, price, stock, unit, status, description FROM products WHERE (user_id::text = $1::text OR user_id = \'default-user\' OR $1 = \'default-user\') AND status = $2 ORDER BY id DESC LIMIT $3', [userId, status, limit])
    }
    return query('SELECT name, sku, hsn_code, category, price, stock, unit, status, description FROM products WHERE (user_id::text = $1::text OR user_id = \'default-user\' OR $1 = \'default-user\') ORDER BY id DESC LIMIT $2', [userId, limit])
  },
  import_stock: async (userId, searchPattern, _status, limit) => {
    let sql = `
      SELECT 
        i.id,
        i.name,
        i.sku,
        i.category,
        i.stock,
        i.unit,
        i.bag_weight,
        i.buying_price,
        i.price_covers,
        i.buyer_name AS supplier_name,
        i.buyer_phone,
        i.buyer_city,
        i.buyer_state,
        ROUND(
          (i.stock::numeric * COALESCE(NULLIF(i.bag_weight::numeric, 0), 1) * (COALESCE(i.buying_price::numeric, 0) / COALESCE(NULLIF(i.price_covers::numeric, 0), 1))),
          2
        ) AS total_supplier_cost,
        COALESCE(
          (SELECT SUM(isp.amount) FROM import_stock_payments isp WHERE isp.import_stock_id = i.id),
          0
        ) AS total_paid_to_supplier,
        ROUND(
          (i.stock::numeric * COALESCE(NULLIF(i.bag_weight::numeric, 0), 1) * (COALESCE(i.buying_price::numeric, 0) / COALESCE(NULLIF(i.price_covers::numeric, 0), 1))) - 
          COALESCE((SELECT SUM(isp.amount) FROM import_stock_payments isp WHERE isp.import_stock_id = i.id), 0),
          2
        ) AS remaining_balance_due,
        i.status,
        i.created_at
      FROM import_stock i
      WHERE (i.user_id::text = $1::text OR i.user_id = 'default-user' OR $1 = 'default-user')
    `
    const params = [userId]
    if (searchPattern) {
      params.push(searchPattern)
      sql += ` AND (i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR i.buyer_name ILIKE $${params.length})`
    }
    params.push(limit)
    sql += ` ORDER BY i.id DESC LIMIT $${params.length}`
    return query(sql, params)
  },
  bills: async (userId, searchPattern, status, limit) => {
    let sql = `SELECT b.id, b.bill_number, b.amount, b.discount, b.status, b.due_date, b.created_at, b.items, p.name AS customer_name 
               FROM bills b 
               LEFT JOIN people p ON b.customer_id = p.id 
               WHERE (b.user_id::text = $1::text OR b.user_id = 'default-user' OR $1 = 'default-user')`
    const params = [userId]
    if (status) {
      params.push(status)
      sql += ` AND b.status = $${params.length}`
    }
    if (searchPattern) {
      params.push(searchPattern)
      sql += ` AND (b.bill_number ILIKE $${params.length} OR p.name ILIKE $${params.length} OR b.items::text ILIKE $${params.length})`
    }
    params.push(limit)
    sql += ` ORDER BY b.id DESC LIMIT $${params.length}`
    return query(sql, params)
  },
  quotes: async (userId, searchPattern, status, limit) => {
    let sql = `SELECT quote_number, customer_name, customer_email, total_amount, status, issue_date, valid_until 
               FROM quotes 
               WHERE (user_id::text = $1::text OR user_id = 'default-user' OR $1 = 'default-user')`
    const params = [userId]
    if (status) {
      params.push(status)
      sql += ` AND status = $${params.length}`
    }
    if (searchPattern) {
      params.push(searchPattern)
      sql += ` AND (quote_number ILIKE $${params.length} OR customer_name ILIKE $${params.length})`
    }
    params.push(limit)
    sql += ` ORDER BY id DESC LIMIT $${params.length}`
    return query(sql, params)
  },
  people: async (userId, searchPattern, _status, limit) => {
    if (searchPattern) {
      return query('SELECT name, email, phone, company, persona, status, notes FROM people WHERE user_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR company ILIKE $2) ORDER BY id DESC LIMIT $3', [userId, searchPattern, limit])
    }
    return query('SELECT name, email, phone, company, persona, status, notes FROM people WHERE user_id = $1 ORDER BY id DESC LIMIT $2', [userId, limit])
  },
  notes: async (userId, _sp, _st, limit) => query('SELECT title, content, created_at FROM notes WHERE user_id = $1 ORDER BY id DESC LIMIT $2', [userId, limit]),
  deals: async (userId, _sp, _st, limit) => query('SELECT title, value, stage, owner, close_date, status FROM deals WHERE user_id = $1 ORDER BY id DESC LIMIT $2', [userId, limit]),
  revenue_summary: async (userId, _sp, _st, limit) => query(`SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*) AS total_bills, SUM(amount) AS revenue FROM bills WHERE user_id = $1 GROUP BY day ORDER BY day DESC LIMIT $2`, [userId, limit]),
  top_products: async (userId, _sp, _st, limit) => query('SELECT bi.name, SUM(bi.qty) AS total_qty FROM bill_items bi WHERE bi.user_id = $1 GROUP BY bi.name ORDER BY total_qty DESC LIMIT $2', [userId, limit]),
  quotes_summary: async (userId) => query('SELECT status, COUNT(*) AS count, SUM(total_amount) AS total_value FROM quotes WHERE user_id = $1 GROUP BY status', [userId]),
}

async function queryBusinessData(args, userId) {
  const { dataset, search, status, limit: rawLimit } = args || {}
  const limit = Math.min(Math.max(Number.parseInt(rawLimit, 10) || 20, 1), 50)
  const searchPattern = search ? `%${search.trim()}%` : null

  const handler = DATASET_HANDLERS[dataset]
  if (!handler) {
    return { error: `Unsupported dataset: ${dataset}` }
  }

  const res = await handler(userId, searchPattern, status, limit)
  return { success: true, count: res.rows?.length, data: res.rows }
}

async function sendEmailTool(args, userId, reqUser) {
  const { to, subject, body } = args
  if (!to || !subject || !body) {
    return { error: 'to, subject and body are required' }
  }

  const { rows } = await query(
    `INSERT INTO emails (from_name, from_email, subject, body, preview, direction, user_id, created_at, updated_at)
     VALUES ('Me', $1, $2, $3, $4, 'sent', $5, NOW(), NOW()) RETURNING *`,
    [to.trim(), subject.trim(), body, body.slice(0, 120), userId]
  )

  try {
    const keys = await redis.keys(`emails:${userId}:*`).catch(() => [])
    for (const key of keys) { await redis.del(key).catch(() => {}) }
  } catch { }

  try {
    const recipientEmail = to.toLowerCase().trim()
    const senderEmail = reqUser?.email || ''
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
        [reqUser?.shopName || senderEmail || 'Me', senderEmail || 'Me', subject.trim(), body, body.slice(0, 120), recipientUserId]
      )

      const recipientKeys = await redis.keys(`emails:${recipientUserId}:*`).catch(() => [])
      for (const key of recipientKeys) { await redis.del(key).catch(() => {}) }
    }
  } catch (_inboxErr) {
    console.error('[Emails AI Recipient Inbox Error]:', _inboxErr.message)
  }

  await sendEmail({
    to: to.trim(),
    subject: subject.trim(),
    html: body.replaceAll('\n', '<br/>')
  })

  return { success: true, email: rows[0], message: 'Email sent successfully via SMTP' }
}

async function invalidateStockAndProductCaches(userId) {
  try {
    clearMemoryCachePrefix(`import_stock:${userId}`)
    clearMemoryCachePrefix(`import_stock_note:${userId}`)
    await deleteCached(redis, `profit_margin:${userId}`)
    await Promise.all([
      deleteCachedPattern(redis, `import_stock:${userId}*`),
      deleteCachedPattern(redis, `import_stock_note:${userId}*`),
      clearProductsCache(userId)
    ]).catch(() => {})
  } catch (err) {
    console.warn('[Chat] Failed to clear stock caches:', err.message)
  }
}

async function handleUpdateImportStock(args, userId, reqUser) {
  const {
    id,
    name,
    sku,
    category,
    price,
    selling_price,
    buying_price,
    stock,
    unit,
    bag_weight,
    buyer_name,
    buyer_phone,
    status,
    description
  } = args || {}

  const searchId = id ? Number.parseInt(id, 10) : null
  const searchSku = sku ? sku.trim() : null
  const searchName = name ? name.trim() : null

  let existingRes = { rows: [] }
  if (searchId) {
    existingRes = await query(
      `SELECT * FROM import_stock WHERE id = $1 AND user_id = $2`,
      [searchId, userId]
    )
  }

  if (!existingRes.rows.length && (searchSku || searchName)) {
    const conditions = []
    const params = [userId]
    if (searchSku) {
      params.push(searchSku)
      conditions.push(`(sku IS NOT NULL AND LOWER(TRIM(sku)) = LOWER(TRIM($${params.length})))`)
    }
    if (searchName) {
      params.push(searchName)
      conditions.push(`LOWER(TRIM(name)) = LOWER(TRIM($${params.length}))`)
    }

    existingRes = await query(
      `SELECT * FROM import_stock 
       WHERE user_id = $1 AND (${conditions.join(' OR ')})
       ORDER BY (CASE WHEN status = 'added' THEN 1 WHEN status = 'active' THEN 2 ELSE 3 END), id DESC`,
      params
    )
  }

  // Fallback fuzzy search if still not found
  if (!existingRes.rows.length && searchName) {
    existingRes = await query(
      `SELECT * FROM import_stock 
       WHERE user_id = $1 AND name ILIKE $2
       ORDER BY (CASE WHEN status = 'added' THEN 1 WHEN status = 'active' THEN 2 ELSE 3 END), id DESC`,
      [userId, `%${searchName}%`]
    )
  }

  if (!existingRes.rows.length) {
    // If not found to update, fall back to creating it
    return await handleAddImportStock(args, userId, reqUser)
  }

  const primary = existingRes.rows[0]

  // If there are duplicate records (e.g. from previous duplicate additions), clean them up
  if (existingRes.rows.length > 1) {
    const duplicateIds = existingRes.rows.slice(1).map(r => r.id)
    await query(
      `DELETE FROM import_stock WHERE id = ANY($1) AND user_id = $2`,
      [duplicateIds, userId]
    ).catch(() => {})
  }

  const finalName = searchName || primary.name
  const finalSku = searchSku || primary.sku
  let finalCategory = primary.category
  if (category !== undefined) {
    finalCategory = category ? category.trim() : null
  }

  // Resolve selling price (price column) vs buying price (buying_price column)
  let finalSellingPrice = primary.price
  if (selling_price !== undefined && selling_price !== null && selling_price !== '') {
    finalSellingPrice = Number.parseFloat(selling_price)
  } else if (price !== undefined && price !== null && price !== '') {
    finalSellingPrice = Number.parseFloat(price)
  }

  let finalBuyingPrice = primary.buying_price
  if (buying_price !== undefined && buying_price !== null && buying_price !== '') {
    finalBuyingPrice = Number.parseFloat(buying_price)
  }

  const finalStock = stock !== undefined ? Number.parseFloat(stock) : (Number.parseFloat(primary.stock) || 0)
  const finalUnit = unit ? unit.trim() : (primary.unit || 'pcs')
  const finalBagWeight = bag_weight !== undefined ? Number.parseFloat(bag_weight) : (Number.parseFloat(primary.bag_weight) || 1)
  let finalBuyerName = primary.buyer_name
  if (buyer_name !== undefined) {
    finalBuyerName = buyer_name ? buyer_name.trim() : null
  }
  let finalBuyerPhone = primary.buyer_phone
  if (buyer_phone !== undefined) {
    finalBuyerPhone = buyer_phone ? buyer_phone.trim() : null
  }
  const finalStatus = status || primary.status || 'active'
  const finalDesc = description !== undefined ? description : primary.description

  // Recalculate total_amount and balance_due
  const priceCoversVal = Number.parseFloat(primary.price_covers || 0)
  const buyingPriceVal = finalBuyingPrice !== null && finalBuyingPrice !== undefined ? Number.parseFloat(finalBuyingPrice) : 0

  let totalAmount = 0
  if (priceCoversVal > 0) {
    totalAmount = finalStock * finalBagWeight * (buyingPriceVal / priceCoversVal)
  } else {
    totalAmount = finalStock * buyingPriceVal
  }
  totalAmount = Math.round(totalAmount * 100) / 100

  const paidAmount = Number.parseFloat(primary.paid_amount || primary.amount_paid || 0)
  const balanceDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100)

  const { rows } = await query(
    `UPDATE import_stock 
     SET name = $1, sku = $2, category = $3, price = $4, buying_price = $5,
         stock = $6, unit = $7, bag_weight = $8, buyer_name = $9, buyer_phone = $10,
         status = $11, description = $12, total_amount = $13, balance_due = $14,
         updated_at = NOW()
     WHERE id = $15 AND user_id = $16
     RETURNING *`,
    [
      finalName, finalSku, finalCategory, finalSellingPrice, finalBuyingPrice,
      finalStock, finalUnit, finalBagWeight, finalBuyerName, finalBuyerPhone,
      finalStatus, finalDesc, totalAmount, balanceDue,
      primary.id, userId
    ]
  )

  // If already linked in products table, sync products table
  await query(
    `UPDATE products 
     SET name = $1, category = $2, price = $3, stock = $4, unit = $5, bag_weight = $6, updated_at = NOW()
     WHERE user_id = $7 AND (
       (sku IS NOT NULL AND sku <> '' AND sku <> 'N/A' AND sku = $8)
       OR LOWER(TRIM(name)) = LOWER(TRIM($9))
     )`,
    [finalName, finalCategory, finalSellingPrice, finalStock, finalUnit, finalBagWeight, userId, finalSku || 'N/A', finalName]
  ).catch(() => {})

  await invalidateStockAndProductCaches(userId)

  return {
    success: true,
    action: 'updated',
    product: rows[0],
    message: `Updated product "${rows[0].name}" successfully: Buying Price=₹${finalBuyingPrice ?? 0}, Selling Price=₹${finalSellingPrice ?? 0}, Category=${finalCategory || 'None'}, Stock=${finalStock} ${finalUnit}, Status=${finalStatus}.`
  }
}

async function handleAddImportStock(args, userId, reqUser) {
  const {
    name,
    sku,
    category,
    price,
    selling_price,
    buying_price,
    stock,
    status,
    unit,
    bag_weight,
    buyer_name,
    buyer_phone,
    description
  } = args || {}

  if (!name) {
    return { error: 'Product name is required' }
  }

  // Deduplication check: if product with same name or SKU already exists, update it!
  const existingCheck = await query(
    `SELECT id FROM import_stock 
     WHERE user_id = $1 AND (
       LOWER(TRIM(name)) = LOWER(TRIM($2))
       OR ($3::text IS NOT NULL AND sku IS NOT NULL AND LOWER(TRIM(sku)) = LOWER(TRIM($3)))
     )
     ORDER BY (CASE WHEN status = 'added' THEN 1 WHEN status = 'active' THEN 2 ELSE 3 END), id DESC
     LIMIT 1`,
    [userId, name.trim(), sku ? sku.trim() : null]
  )

  if (existingCheck.rows.length > 0) {
    return await handleUpdateImportStock({ ...args, id: existingCheck.rows[0].id }, userId, reqUser)
  }

  // Resolve selling price (price column) vs buying price (buying_price column)
  let sellingPriceVal = null
  if (selling_price !== undefined && selling_price !== null && selling_price !== '') {
    sellingPriceVal = Number.parseFloat(selling_price)
  } else if (price !== undefined && price !== null && price !== '') {
    sellingPriceVal = Number.parseFloat(price)
  }

  let buyingPriceVal = null
  if (buying_price !== undefined && buying_price !== null && buying_price !== '') {
    buyingPriceVal = Number.parseFloat(buying_price)
  }

  if (sellingPriceVal === null && buyingPriceVal !== null) {
    sellingPriceVal = buyingPriceVal
  }

  const stockQty = Number.parseFloat(stock) || 0
  const bagWeightVal = Number.parseFloat(bag_weight) || 1
  const unitVal = unit ? unit.trim() : 'pcs'
  const statusVal = status || 'active'

  let totalAmount = 0
  if (buyingPriceVal !== null) {
    totalAmount = Math.round(stockQty * buyingPriceVal * 100) / 100
  }
  const balanceDue = totalAmount

  const creatorName = (reqUser?.firstName || reqUser?.first_name)
    ? `${reqUser.firstName || reqUser.first_name} ${reqUser?.lastName || reqUser?.last_name || ''}`.trim()
    : (reqUser?.shopName || reqUser?.email?.split('@')[0] || 'Admin')
  const creatorEmail = reqUser?.email || ''
  const creatorRole = reqUser?.role?.toLowerCase() === 'member' ? 'Member' : 'Admin'

  const { rows } = await query(
    `INSERT INTO import_stock (
      name, sku, category, price, buying_price, stock, status, unit, description,
      bag_weight, buyer_name, buyer_phone, total_amount, balance_due, amount_paid, paid_amount,
      created_by_name, created_by_email, created_by_role, user_id, created_at, updated_at
    )
     VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, 0, 0,
      $15, $16, $17, $18, NOW(), NOW()
    ) RETURNING *`,
    [
      name.trim(),
      sku ? sku.trim() : null,
      category ? category.trim() : null,
      sellingPriceVal,
      buyingPriceVal,
      stockQty,
      statusVal,
      unitVal,
      description || null,
      bagWeightVal,
      buyer_name ? buyer_name.trim() : null,
      buyer_phone ? buyer_phone.trim() : null,
      totalAmount,
      balanceDue,
      creatorName,
      creatorEmail,
      creatorRole,
      userId
    ]
  )

  await invalidateStockAndProductCaches(userId)
  return { success: true, action: 'created', product: rows[0] }
}

async function handleDeleteImportStock(args, userId) {
  const { id, name, sku } = args || {}
  const conditions = []
  const params = [userId]

  if (id) {
    params.push(id)
    conditions.push(`id = $${params.length}`)
  }
  if (sku) {
    params.push(sku.trim())
    conditions.push(`(sku IS NOT NULL AND LOWER(TRIM(sku)) = LOWER(TRIM($${params.length})))`)
  }
  if (name) {
    params.push(name.trim())
    conditions.push(`LOWER(TRIM(name)) = LOWER(TRIM($${params.length}))`)
  }

  if (conditions.length === 0) {
    return { error: 'id, name, or sku is required to delete' }
  }

  const { rows } = await query(
    `DELETE FROM import_stock WHERE user_id = $1 AND (${conditions.join(' OR ')}) RETURNING id, name`,
    params
  )

  await invalidateStockAndProductCaches(userId)
  return { success: true, deletedCount: rows.length, deletedItems: rows }
}

async function handleAddNote(args, userId) {
  const { title, body = '' } = args
  if (!title) return { error: 'title is required' }
  const { rows } = await query(
    `INSERT INTO notes (title, body, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
    [title.trim(), body, userId]
  )
  try {
    const keys = await redis.keys(`notes:${userId}:*`).catch(() => [])
    for (const key of keys) { await redis.del(key).catch(() => {}) }
  } catch { }
  return { success: true, note: rows[0] }
}

async function handleCreatePerson(args, userId) {
  const { name, email = '', phone = '', company = '', persona = 'Lead', notes = '' } = args
  if (!name) return { error: 'name is required' }
  const validPersonas = ['Lead', 'Prospect', 'Customer', 'Partner', 'Vendor', 'Other']
  const matchedPersona = validPersonas.find(p => p.toLowerCase() === String(persona).toLowerCase()) || persona || 'Lead'
  const compVal = company?.trim() ? company.trim() : null

  const { rows } = await query(
    `INSERT INTO people (name, email, phone, company, company_name, persona, notes, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
    [name.trim(), email.trim(), phone.trim(), compVal, compVal, matchedPersona, notes, userId]
  )
  try {
    const pKeys = await redis.keys(`people:${userId}:*`).catch(() => [])
    for (const key of pKeys) { await redis.del(key).catch(() => {}) }
  } catch {
    // Intentionally ignored: cache invalidation fallback
  }
  return { success: true, person: rows[0] }
}

const TOOL_HANDLERS = {
  add_to_import_stock: (args, userId, reqUser) => handleAddImportStock(args, userId, reqUser),
  update_import_stock: (args, userId, reqUser) => handleUpdateImportStock(args, userId, reqUser),
  delete_import_stock: (args, userId) => handleDeleteImportStock(args, userId),
  query_business_data: (args, userId) => queryBusinessData(args, userId),
  send_email: (args, userId, reqUser) => sendEmailTool(args, userId, reqUser),
  add_note: (args, userId) => handleAddNote(args, userId),
  create_person: (args, userId) => handleCreatePerson(args, userId),
}

async function executeToolCall(toolName, args, userId, reqUser) {
  const handler = TOOL_HANDLERS[toolName]
  if (!handler) {
    return { error: `Unknown tool: ${toolName}` }
  }
  return await handler(args, userId, reqUser)
}

/* POST /api/chat — send a message and get AI response */
router.post('/', async (req, res) => {
  const { messages, conversationId, title } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }

  const userId = req.workspaceId
  const lastMsg = messages.at(-1)?.content || ''

  const cacheKey = `chat_cache:${userId}:${crypto.createHash('sha256').update(lastMsg.toLowerCase().trim()).digest('hex')}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log('[REDIS] Chat cache hit')
      saveSession(userId, conversationId, messages, cached, title).catch(() => {})
      return res.json({ content: cached, cached: true })
    }
  } catch { }

  try {
    const dealChatResponse = await handleDealP2PChat(conversationId, userId, lastMsg)
    if (dealChatResponse) {
      return res.json({ content: dealChatResponse, cached: false })
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' })
    }

    const systemPrompt = {
      role: 'system',
      content: `You are Workshop AI, a helpful business assistant for a retail/wholesale management platform called Workshop. 
You help users with: sales analysis, inventory management, customer relations, billing, workflow automation, and business insights.
Be concise, friendly, and actionable. Use markdown for formatting when helpful. Current context: Indian retail/wholesale business platform.

CRITICAL ROLE & BUSINESS CONTEXT:
- The user is the MERCHANT / SHOP OWNER (Seller / Supplier, e.g. Akash Traders).
- "bills": Contains SALES INVOICES issued to customers. Unpaid bills represent money customers owe to the merchant (Accounts Receivable).
- "import_stock": Contains STOCK BATCHES PURCHASED FROM SUPPLIERS (the supplier details are listed as "Supplier / Buyer", e.g. Mani Traders).
  When the user asks "how much amount to pay to the supplier / buyer for this product/batch" or "what is the remaining balance / due amount to pay for product [SKU/barcode/name]" (e.g. SKU 48765977), ALWAYS query "import_stock". This returns the supplier name, total supplier cost, total paid so far, and remaining balance due to the supplier.
- Format all currency and prices with the Rupee symbol (₹).

CRITICAL STOCK EDITING & DEDUPLICATION RULES:
- When the user asks to modify, update, change prices, change category, change status, or edit an EXISTING product/stock item (or supplies follow-up/updated values like "buyer price is 3500 and selling price is 400 and catageroy is grain and make satus active"):
  NEVER create a new product! ALWAYS call the "update_import_stock" tool!
- Calling "add_to_import_stock" when modifying an existing item causes unwanted duplicate products.
- PRICE FIELDS DISTINCTION:
  * "buyer price", "buying price", "purchase price", "cost price", "supplier price" -> maps to "buying_price" (cost from the supplier/buyer).
  * "selling price", "retail price", "sale price", "market price", "price" -> maps to "selling_price" (or "price") (price charged to customers).
  * "buyer name", "supplier name" -> maps to "buyer_name" (e.g. "Mani Traders").
  * "category" -> maps to "category" (e.g. "Grain", "Oil", "Spices").
  * "status" -> maps to "status" ("active", "pending", "added").
- Always clearly display both Buying Price (₹) and Selling Price (₹) in your confirmation reply so the merchant has complete transparency.

You have access to tools to query business data (products, bills, quotes, people, notes, deals, revenue_summary, import_stock), create contacts, add notes, stage import stock (add_to_import_stock), modify stock (update_import_stock), and remove stock (delete_import_stock).
When presenting data tables, format them cleanly with proper columns and values.`
    }

    const apiMessages = [systemPrompt, ...messages.map(m => ({ role: m.role, content: m.content }))]
    let loopCount = 0
    let finalContent = ''

    while (loopCount < 5) {
      const openRouterResult = await callOpenRouterWithFallback(apiMessages)
      if (!openRouterResult.ok) {
        return res.status(502).json({ error: 'AI service unavailable', details: openRouterResult.error })
      }

      const data = await openRouterResult.response.json()
      const message = data.choices?.[0]?.message
      if (!message) {
        throw new Error('Empty response from AI model')
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        apiMessages.push(message)

        for (const toolCall of message.tool_calls) {
          const { name: toolName, arguments: toolArgsStr } = toolCall.function
          let args = {}
          try {
            args = JSON.parse(toolArgsStr)
          } catch { }

          let toolResult
          try {
            toolResult = await executeToolCall(toolName, args, userId, req.user)
          } catch (err) {
            toolResult = { error: err.message }
          }

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

    redis.set(cacheKey, content, { ex: 3600 }).catch(() => {})
    saveSession(userId, conversationId, messages, content, title).catch(() => {})

    return res.json({ content, cached: false })
  } catch (err) {
    console.error('[CHAT ERROR]', err)
    return res.status(500).json({ error: err.message })
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
    console.error('Sessions list error')
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
    console.error('Session load error')
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
