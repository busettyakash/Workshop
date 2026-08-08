import puppeteer from 'puppeteer'
import PDFDocument from 'pdfkit'
import { getProductHsnMap } from '../lib/productCache.js'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseItems(items) {
  if (Array.isArray(items)) return items
  if (!items) return []
  try {
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function INR(v) {
  return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return String(d) }
}

function resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName = '', isQuote = false) {
  let bw = parseFloat(bagWeight || 1)
  let pName
  if (typeof prodName === 'string' && prodName.trim()) {
    pName = prodName
  } else if (typeof dbUnit === 'string' && !['kgs', 'kg', 'ltrs', 'ltr', 'pcs', 'bag', 'bags'].includes(dbUnit.toLowerCase())) {
    pName = dbUnit
  } else {
    pName = ''
  }
  const pNameLower = pName.toLowerCase()

  if (bw <= 1 && pNameLower) {
    const nameWeightMatch = pNameLower.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
    if (nameWeightMatch && nameWeightMatch[1]) {
      bw = parseFloat(nameWeightMatch[1])
    } else if (pNameLower.includes('soddalu')) {
      bw = 50
    } else if (pNameLower.includes('kurnool') || pNameLower.includes('rice')) {
      bw = 26
    }
  }

  let uRaw = String(rawUnit || '').trim()

  if (uRaw.includes(':') || uRaw.includes('₹') || uRaw.includes('/')) {
    if (uRaw.toLowerCase().includes('/ltr') || uRaw.toLowerCase().includes('ltr')) {
      uRaw = 'ltrs'
    } else if (uRaw.toLowerCase().includes('/kg') || uRaw.toLowerCase().includes('kg')) {
      uRaw = 'kgs'
    } else if (uRaw.toLowerCase().includes('/mtr') || uRaw.toLowerCase().includes('mtr')) {
      uRaw = 'mtrs'
    } else {
      uRaw = uRaw.split(':')[0].trim()
    }
  }

  const dbUnitStr = (typeof dbUnit === 'string' && ['kgs', 'kg', 'ltrs', 'ltr', 'pcs', 'bag', 'bags'].includes(dbUnit.toLowerCase())) ? dbUnit : ''
  const u = (uRaw || dbUnitStr).toLowerCase().trim()
  const isBagUnit = ['bag', 'bags'].includes(u)

  let baseUnitLabel = uRaw || u || 'pcs'
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) baseUnitLabel = 'kgs'
  else if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) baseUnitLabel = 'ltrs'
  else if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) baseUnitLabel = 'mtrs'
  else if (isBagUnit) baseUnitLabel = 'Bag'

  // If item is in Bags or isQuote is true -> QUOTE FLOW DISPLAY (Show 50kg Bag, 26kg Bag)!
  if (isQuote || isBagUnit) {
    let subtext
    if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l', 'ml'].includes(u)) {
      subtext = 'ltrs'
    } else if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
      subtext = bw > 1 ? `${bw}m Roll` : 'mtrs'
    } else {
      const packName = bw > 1 ? 'Bag' : 'Pack'
      subtext = bw > 1 ? `${bw}kg ${packName}` : 'Bag'
    }

    if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l', 'ml'].includes(u)) {
      return { displayQty: qty, displayUnit: 'ltrs', subtext }
    }

    if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
      return { displayQty: qty, displayUnit: 'mtrs', subtext }
    }

    return { displayQty: qty, displayUnit: 'Bag', subtext }
  }

  // Direct Normal Bill Flow (base UOM without bags):
  return {
    displayQty: qty,
    displayUnit: baseUnitLabel,
    subtext: baseUnitLabel
  }
}

// ─────────────────────────────────────────────
// HTML Builder  (mirrors BillPreview.jsx exactly)
// ─────────────────────────────────────────────
function buildInvoiceHtml({ quote = {}, bill = {}, billItems = [], shop = {}, catalogMap = {}, type = '' } = {}) {
  const isQuote = type === 'quotation' || (type !== 'invoice' && !bill.bill_number && !bill.id && Boolean(quote.id || quote.quote_number))

  let quoteNumFound = quote.quote_number || bill.quote_number || ''
  if (!quoteNumFound && (quote.quote_id || bill.quote_id)) {
    const qid = quote.quote_id || bill.quote_id
    quoteNumFound = String(qid).startsWith('QT-') ? String(qid) : `QT-${qid}`
  }
  if (!quoteNumFound && (quote.notes || bill.notes)) {
    const notesStr = String(quote.notes || bill.notes || '')
    const match = notesStr.match(/QT-[A-Z0-9]+/i)
    if (match) quoteNumFound = match[0].toUpperCase()
  }
  if (!quoteNumFound && (quote.id || !bill.id)) {
    if (quote.id) {
      const qStr = String(quote.id)
      quoteNumFound = qStr.startsWith('QT-') ? qStr : `QT-${qStr}`
    } else {
      quoteNumFound = 'QT-820332'
    }
  }

  let docId = ''
  if (isQuote) {
    docId = quoteNumFound || `QT-${quote.id || '820332'}`
  } else if (bill.bill_number) {
    docId = bill.bill_number
  } else if (bill.id) {
    docId = `INV-${String(bill.id).padStart(5, '0')}`
  } else {
    docId = 'INV-10001'
  }

  const orderId = bill.order_number || quote.order_number || ''
  const bannerLabel = isQuote ? 'QUOTATION' : 'TAX INVOICE'
  const sectionTitle1 = isQuote ? '1. QUOTATION DETAILS' : '1. INVOICE DETAILS'
  const docTypeTitle = isQuote ? 'Commercial Quotation' : 'Tax Invoice'

  // Supplier
  const companyName = shop.shop_name || shop.name || quote.shop_name || bill.shop_name || 'Workshop'
  const companyGstin = shop.gstin || quote.shop_gstin || bill.shop_gstin || ''
  const companyPhone = shop.phone || quote.shop_phone || bill.shop_phone || ''
  const companyAddress = shop.address || quote.shop_address || bill.shop_address || ''

  // Customer
  const customerName = quote.customer_name || bill.customer_name || ''
  const customerGstin = quote.customer_gstin || bill.customer_gstin || ''
  const customerPhone = quote.customer_phone || bill.customer_phone || ''
  const customerCompany = quote.customer_company || bill.customer_company || ''
  const custStateStr = quote.customer_state ? `, ${quote.customer_state}` : ''
  const customerAddress = quote.customer_address || bill.customer_address ||
    (quote.customer_city ? (quote.customer_city + custStateStr) : '')

  const doc = { ...quote, ...bill }
  const items = parseItems(billItems.length ? billItems : (bill.items || quote.line_items || []))

  const grossSubtotal = items.reduce((s, li) => {
    const q = parseFloat(li.qty || li.quantity || 1)
    const p = parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)
  const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
  const explicitDiscount = parseFloat(doc.discount || doc.discount_amount || quote?.discount || bill?.discount || 0)
  const explicitTotalAmount = parseFloat(doc.amount || doc.total_amount || 0)

  const rawTaxAmt = doc.tax_amount ?? doc.taxAmount ?? quote?.tax_amount ?? bill?.tax_amount
  const hasExplicitTaxAmt = rawTaxAmt !== undefined && rawTaxAmt !== null && rawTaxAmt !== '' && !isNaN(parseFloat(rawTaxAmt))
  const explicitTaxAmt = hasExplicitTaxAmt ? parseFloat(rawTaxAmt) : 0

  const rawTaxRate = doc.tax_rate ?? doc.taxRate ?? quote?.tax_rate ?? bill?.tax_rate
  const explicitTaxRate = (rawTaxRate !== undefined && rawTaxRate !== null && rawTaxRate !== '' && !isNaN(parseFloat(rawTaxRate)))
    ? parseFloat(rawTaxRate)
    : null

  const tempDiscount = Math.max(explicitDiscount, lineDiscounts)
  const tempTaxable = Math.max(0, grossSubtotal - tempDiscount)

  let taxAmt = 0
  if (explicitTaxAmt > 0) {
    taxAmt = explicitTaxAmt
  } else if (explicitTaxRate !== null && explicitTaxRate > 0) {
    taxAmt = tempTaxable * (explicitTaxRate / 100)
  } else if (explicitTotalAmount > 0 && explicitTotalAmount > tempTaxable) {
    taxAmt = explicitTotalAmount - tempTaxable
  }

  const grossTotalWithTax = grossSubtotal + taxAmt
  const diffDiscount = (grossTotalWithTax > 0 && explicitTotalAmount > 0 && grossTotalWithTax > explicitTotalAmount + 0.01)
    ? (grossTotalWithTax - explicitTotalAmount)
    : 0
  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)
  const taxableSubtotal = Math.max(0, grossSubtotal - totalDiscount)
  const totalAmount = explicitTotalAmount > 0 ? explicitTotalAmount : (taxableSubtotal + taxAmt)

  let effectiveTaxRate = 0
  if (taxAmt > 0 && taxableSubtotal > 0) {
    effectiveTaxRate = Math.round((taxAmt / taxableSubtotal) * 100)
  } else if (explicitTaxRate > 0) {
    effectiveTaxRate = explicitTaxRate
  }

  const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '0'
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const issueDate = fmtDate(doc.issue_date || doc.created_at)
  const dueDate = fmtDate(doc.valid_until || doc.due_date)

  // Build table rows
  const rowsHtml = items.length > 0 ? items.map((li, i) => {
    const qty = parseFloat(li.qty || li.quantity || 1)
    const price = parseFloat(li.price || li.rate || 0)
    const disc = parseFloat(li.discount || 0)
    const lineTotalGross = price * qty
    let itemDisc = 0
    if (disc > 0) {
      itemDisc = disc
    } else if (totalDiscount > 0) {
      itemDisc = items.length === 1
        ? totalDiscount
        : Math.round(((lineTotalGross / (grossSubtotal || 1)) * totalDiscount) * 100) / 100
    }
    const pId = li.product_id || li.productId || li.id
    const prodNameRaw = (typeof li === 'string' && li.trim())
      ? li
      : (li.name || li.product_name || li.productName || li.product || li.item_name || li.title || li.description || '')

    const normSearch = prodNameRaw ? prodNameRaw.toLowerCase().replace(/[-_]/g, ' ').trim() : ''

    const dbProd = (pId && catalogMap[String(pId)])
      || (prodNameRaw && catalogMap[prodNameRaw.toLowerCase().trim()])
      || (normSearch && catalogMap[normSearch])
      || Object.values(catalogMap).find(p => {
           if (!p.name) return false
           const pNorm = p.name.toLowerCase().replace(/[-_]/g, ' ').trim()
           return pNorm === normSearch || pNorm.includes(normSearch) || normSearch.includes(pNorm)
         })

    const prodName = prodNameRaw || dbProd?.name || 'Product Item'
    const rawUnit = li.unit || li.unitLabel || dbProd?.unit || ''
    const dbUnit = dbProd?.unit || ''

    let bagWeight = parseFloat(
      li.bag_weight ?? li.bagWeight ?? li.pack_weight ?? li.packWeight ??
      dbProd?.bag_weight ?? dbProd?.bagWeight ?? dbProd?.pack_weight ?? dbProd?.packWeight ?? 0
    )

    if (isNaN(bagWeight) || bagWeight <= 0) {
      const nameMatch = prodName.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
      if (nameMatch && nameMatch[1]) {
        bagWeight = parseFloat(nameMatch[1])
      } else {
        bagWeight = 1
      }
    }

    const { displayQty, displayUnit, subtext } = resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName, isQuote)
    const rawHsn = li.hsn_code || li.hsn || li.sku || dbProd?.hsn_code || dbProd?.sku || ''
    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
      ? `1006${String(pId || (i + 1001)).padStart(4, '0')}`
      : rawHsn

    return `<tr>
      <td style="font-weight:600;color:#475569;font-size:10px;font-family:monospace;padding:7px 10px;border:1px solid #cbd5e1">${hsnCode}</td>
      <td style="padding:7px 10px;border:1px solid #cbd5e1">
        <div style="font-weight:700;color:#0f172a;font-size:11px">${prodName}</div>
        ${subtext ? `<div style="font-size:10px;color:#64748b">${subtext}</div>` : ''}
      </td>
      <td style="text-align:center;font-weight:600;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px">${displayQty} ${displayUnit}</td>
      <td style="text-align:right;font-weight:700;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px">${INR(lineTotalGross)}</td>
      <td style="text-align:right;font-weight:700;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px;color:${itemDisc > 0.01 ? '#dc2626' : '#64748b'}">
        ${itemDisc > 0.01 ? `-${INR(itemDisc)}` : '-'}
      </td>
      <td style="text-align:right;font-size:10px;color:#475569;padding:7px 10px;border:1px solid #cbd5e1">
        ${taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : '-'}
      </td>
    </tr>`
  }).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No line items found</td></tr>`

  // Totals summary
  const totalsHtml = `
    <div style="display:flex;border:1px solid #cbd5e1;background:#f8fafc;margin-bottom:20px;text-align:center">
      ${totalDiscount > 0 ? `
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1">
        <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Gross Subtotal</div>
        <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-top:2px">${INR(grossSubtotal)}</div>
      </div>
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1;background:#fef2f2">
        <div style="font-size:9px;font-weight:800;color:#991b1b;text-transform:uppercase">Total Discount</div>
        <div style="font-size:11.5px;font-weight:800;color:#dc2626;margin-top:2px">- ${INR(totalDiscount)}</div>
      </div>
      ` : ''}
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1">
        <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Tot. Tax'ble Amt</div>
        <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-top:2px">${INR(taxableSubtotal)}</div>
      </div>
      ${taxAmt > 0 ? `
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1">
        <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">CGST Amt</div>
        <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-top:2px">${INR(cgst)}</div>
      </div>
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1">
        <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">SGST Amt</div>
        <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-top:2px">${INR(sgst)}</div>
      </div>
      ` : ''}
      <div style="flex:1;padding:8px 4px;background:#0f172a">
        <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase">${isQuote ? 'Total Quote.Amt' : 'Total Inv.Amt'}</div>
        <div style="font-size:13px;font-weight:800;color:#ffffff;margin-top:2px">${INR(totalAmount)}</div>
      </div>
    </div>
  `

  let gstinPart = ''
  if (companyGstin) {
    const dotStr = companyPhone ? '· ' : ''
    gstinPart = `${dotStr}GSTIN: ${companyGstin.toUpperCase()}`
  }

  let validUntilHtml = ''
  if (isQuote) {
    validUntilHtml = `Valid Until: <strong>${dueDate}</strong><br/>`
  } else if (doc.due_date) {
    validUntilHtml = `Due: <strong>${fmtDate(doc.due_date)}</strong><br/>`
  }

  let validOrGstinBox = ''
  if (isQuote) {
    validOrGstinBox = `<div><span class="meta-lbl">Valid Until</span><span class="meta-val">${dueDate}</span></div>`
  } else if (companyGstin) {
    validOrGstinBox = `<div><span class="meta-lbl">Company GSTIN</span><span class="meta-val">${companyGstin.toUpperCase()}</span></div>`
  }

  const barcodePart = String(docId).replace(/\D/g, '') || '112157195020'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${docId}</title>
  <style>
    @page { margin: 0; size: A4; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#0f172a; padding:20px; }
    .page { max-width:800px; margin:0 auto; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; }
    .banner { background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%); padding:36px 44px 32px; display:flex; justify-content:space-between; align-items:flex-start; position:relative; overflow:hidden; color:#fff; }
    .banner::before { content:''; position:absolute; top:-40px; right:-40px; width:180px; height:180px; background:rgba(255,255,255,0.12); border-radius:50%; }
    .banner::after  { content:''; position:absolute; bottom:-60px; right:60px; width:130px; height:130px; background:rgba(255,255,255,0.08); border-radius:50%; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #1e293b; font-size: 12px; line-height: 1.4; }
    .page { padding: 32px; max-width: 800px; margin: 0 auto; }
    .banner { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #fff; padding: 24px 28px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: flex-start; }
    .co-name { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
    .co-meta { font-size: 11px; opacity: 0.9; line-height: 1.5; }
    .br { text-align: right; }
    .inv-lbl { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; opacity: 0.8; margin-bottom: 2px; }
    .inv-num { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .inv-meta { font-size: 11px; opacity: 0.85; margin-top: 6px; }
    .body { border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px; padding: 24px 28px; }
    .sec { font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 0.05em; margin-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
    .meta-lbl { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:2px; }
    .meta-val { font-weight:700; color:#0f172a; }
    .addr-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
    .addr-card { border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#fff; }
    .addr-hdr  { font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px; }
    .addr-name { font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px; }
    .addr-txt  { font-size:12px; color:#475569; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1; }
    th { background:#f8fafc; padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:left; }
    .bc-wrap { text-align:center; margin:20px 0 10px; }
    .footer { border-top:1px solid #e2e8f0; padding-top:14px; text-align:center; font-size:11px; color:#94a3b8; }
  </style>
</head>
<body>
<div class="page">

  <!-- Banner -->
  <div class="banner">
    <div class="bl">
      <div class="co-name">${companyName}</div>
      <div class="co-meta">
        ${companyAddress ? companyAddress + '<br/>' : ''}
        ${companyPhone ? 'Phone: ' + companyPhone + ' ' : ''}
        ${gstinPart}
        ${!companyGstin ? 'Official Supplier &amp; Goods Provider' : ''}
      </div>
    </div>
    <div class="br">
      <div class="inv-lbl">${bannerLabel}</div>
      <div class="inv-num">${docId}</div>
      <div class="inv-meta">
        Date: <strong>${issueDate}</strong><br/>
        ${validUntilHtml}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <div class="sec">${sectionTitle1}</div>
    <div class="meta-grid">
      <div><span class="meta-lbl">${isQuote ? 'Quotation No' : 'Invoice No'}</span><span class="meta-val">${docId}</span></div>
      ${orderId ? `<div><span class="meta-lbl">Order No</span><span class="meta-val" style="color:#2563eb;font-weight:800">${orderId}</span></div>` : ''}
      <div><span class="meta-lbl">Generated Date</span><span class="meta-val">${issueDate}</span></div>
      ${validOrGstinBox}
      <div><span class="meta-lbl">Document Type</span><span class="meta-val">${docTypeTitle}</span></div>
    </div>

    <div class="sec">2. ADDRESS DETAILS</div>
    <div class="addr-grid">
      <div class="addr-card">
        <div class="addr-hdr">FROM (SUPPLIER)</div>
        <div class="addr-name">${companyName}</div>
        <div class="addr-txt">
          ${companyGstin ? `<div><strong>GSTIN:</strong> ${companyGstin.toUpperCase()}</div>` : ''}
          ${companyAddress ? `<div style="margin-top:4px"><strong style="color:#0f172a">:: Dispatch From ::</strong><br/>${companyAddress}</div>` : ''}
          ${companyPhone ? `<div style="margin-top:4px">Phone: ${companyPhone}</div>` : ''}
          ${!companyGstin && !companyAddress ? '<div style="color:#64748b">Official Registered Supplier</div>' : ''}
        </div>
      </div>
      <div class="addr-card">
        <div class="addr-hdr">TO (BUYER)</div>
        <div class="addr-name">${customerName || '—'}</div>
        <div class="addr-txt">
          ${customerGstin ? `<div><strong>GSTIN:</strong> ${customerGstin.toUpperCase()}</div>` : ''}
          ${customerCompany ? `<div style="margin-top:2px">${customerCompany}</div>` : ''}
          ${customerAddress ? `<div style="margin-top:4px"><strong style="color:#0f172a">:: Ship To ::</strong><br/>${customerAddress}</div>` : ''}
          ${customerPhone ? `<div style="margin-top:4px">Phone: ${customerPhone}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="sec">3. GOODS DETAILS</div>
    <table>
      <thead>
        <tr>
          <th style="width:90px">HSN CODE</th>
          <th>PRODUCT NAME &amp; DESC.</th>
          <th style="width:100px;text-align:center">QUANTITY</th>
          <th style="width:120px;text-align:right">GROSS SUBTOTAL</th>
          <th style="width:100px;text-align:right">DISCOUNT</th>
          <th style="width:140px;text-align:right">TAX RATE (C+S+I)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    ${totalsHtml}

    <!-- Barcode -->
    <div class="bc-wrap">
      <svg width="220" height="40" viewBox="0 0 220 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0"   width="3" height="30" fill="black"/>
        <rect x="5"   width="1" height="30" fill="black"/>
        <rect x="8"   width="4" height="30" fill="black"/>
        <rect x="15"  width="2" height="30" fill="black"/>
        <rect x="20"  width="5" height="30" fill="black"/>
        <rect x="28"  width="1" height="30" fill="black"/>
        <rect x="32"  width="3" height="30" fill="black"/>
        <rect x="38"  width="2" height="30" fill="black"/>
        <rect x="44"  width="4" height="30" fill="black"/>
        <rect x="50"  width="1" height="30" fill="black"/>
        <rect x="54"  width="5" height="30" fill="black"/>
        <rect x="62"  width="2" height="30" fill="black"/>
        <rect x="68"  width="3" height="30" fill="black"/>
        <rect x="74"  width="1" height="30" fill="black"/>
        <rect x="78"  width="4" height="30" fill="black"/>
        <rect x="85"  width="2" height="30" fill="black"/>
        <rect x="90"  width="5" height="30" fill="black"/>
        <rect x="98"  width="1" height="30" fill="black"/>
        <rect x="102" width="3" height="30" fill="black"/>
        <rect x="108" width="2" height="30" fill="black"/>
        <rect x="114" width="4" height="30" fill="black"/>
        <rect x="120" width="1" height="30" fill="black"/>
        <rect x="124" width="5" height="30" fill="black"/>
        <rect x="132" width="2" height="30" fill="black"/>
        <rect x="138" width="3" height="30" fill="black"/>
        <rect x="144" width="1" height="30" fill="black"/>
        <rect x="148" width="4" height="30" fill="black"/>
        <rect x="155" width="2" height="30" fill="black"/>
        <rect x="160" width="5" height="30" fill="black"/>
        <rect x="168" width="1" height="30" fill="black"/>
        <rect x="172" width="3" height="30" fill="black"/>
        <rect x="178" width="2" height="30" fill="black"/>
        <rect x="184" width="4" height="30" fill="black"/>
        <rect x="190" width="1" height="30" fill="black"/>
        <rect x="194" width="5" height="30" fill="black"/>
        <rect x="202" width="2" height="30" fill="black"/>
        <rect x="208" width="3" height="30" fill="black"/>
        <rect x="214" width="2" height="30" fill="black"/>
        <text x="110" y="38" font-size="9" text-anchor="middle" fill="#475569" font-family="monospace">${barcodePart}</text>
      </svg>
    </div>

    <div class="footer">
      Official ${docTypeTitle} generated by <strong>Workshop</strong> · ${fmtDate(new Date())}
    </div>

  </div>
</div>
</body>
</html>`
}

import fs from 'fs'

function getSystemBrowserPath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean)

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// ─────────────────────────────────────────────
// PDFKit Fallback (Rich Layout Matching Image 1 Design)
// ─────────────────────────────────────────────
function generatePdfKitFallback({ quote = {}, bill = {}, billItems = [], shop = {}, type = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({ margin: 36, size: 'A4' })
      const chunks = []
      pdf.on('data', c => chunks.push(c))
      pdf.on('end', () => resolve(Buffer.concat(chunks)))

      const doc = { ...quote, ...bill }
      const isQuote = type === 'quotation' || (type !== 'invoice' && !bill.bill_number && !bill.id && Boolean(quote.id || quote.quote_number))

      let quoteNumFound = quote.quote_number || bill.quote_number || ''
      if (!quoteNumFound && (quote.quote_id || bill.quote_id)) {
        const qid = quote.quote_id || bill.quote_id
        quoteNumFound = String(qid).startsWith('QT-') ? String(qid) : `QT-${qid}`
      }
      if (!quoteNumFound && (quote.notes || bill.notes)) {
        const notesStr = String(quote.notes || bill.notes || '')
        const match = notesStr.match(/QT-[A-Z0-9]+/i)
        if (match) quoteNumFound = match[0].toUpperCase()
      }
      if (!quoteNumFound && (quote.id || !bill.id)) {
        if (quote.id) {
          const qStr = String(quote.id)
          quoteNumFound = qStr.startsWith('QT-') ? qStr : `QT-${qStr}`
        } else {
          quoteNumFound = 'QT-820332'
        }
      }

      let docId = ''
      if (isQuote) {
        docId = quoteNumFound || `QT-${quote.id || '820332'}`
      } else if (bill.bill_number) {
        docId = bill.bill_number
      } else if (bill.id) {
        docId = `INV-${String(bill.id).padStart(5, '0')}`
      } else {
        docId = 'INV-10001'
      }

      const orderId = bill.order_number || quote.order_number || ''
      const bannerLabel = isQuote ? 'QUOTATION' : 'TAX INVOICE'
      const sectionTitle1 = isQuote ? '1. QUOTATION DETAILS' : '1. INVOICE DETAILS'
      const docTypeTitle = isQuote ? 'Commercial Quotation' : 'Tax Invoice'

      // Supplier
      const companyName = shop.shop_name || shop.name || quote.shop_name || bill.shop_name || 'Workshop'
      const companyGstin = shop.gstin || quote.shop_gstin || bill.shop_gstin || ''
      const companyPhone = shop.phone || quote.shop_phone || bill.shop_phone || ''
      const companyAddress = shop.address || quote.shop_address || bill.shop_address || ''

      // Customer
      const customerName = quote.customer_name || bill.customer_name || ''
      const customerGstin = quote.customer_gstin || bill.customer_gstin || ''
      const customerPhone = quote.customer_phone || bill.customer_phone || ''
      const customerCompany = quote.customer_company || bill.customer_company || ''
      const custStateStr = quote.customer_state ? `, ${quote.customer_state}` : ''
      const customerAddress = quote.customer_address || bill.customer_address ||
        (quote.customer_city ? (quote.customer_city + custStateStr) : '')

      const items = parseItems(billItems.length ? billItems : (bill.items || quote.line_items || []))

      const grossSubtotal = items.reduce((s, li) => {
        const q = parseFloat(li.qty || li.quantity || 1)
        const p = parseFloat(li.price || li.rate || 0)
        return s + (p * q)
      }, 0)
      const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
      const explicitDiscount = parseFloat(doc.discount || doc.discount_amount || quote?.discount || bill?.discount || 0)
      const explicitTotalAmount = parseFloat(doc.amount || doc.total_amount || 0)

      const rawTaxAmt = doc.tax_amount ?? doc.taxAmount ?? quote?.tax_amount ?? bill?.tax_amount
      const hasExplicitTaxAmt = rawTaxAmt !== undefined && rawTaxAmt !== null && rawTaxAmt !== '' && !isNaN(parseFloat(rawTaxAmt))
      const explicitTaxAmt = hasExplicitTaxAmt ? parseFloat(rawTaxAmt) : 0

      const rawTaxRate = doc.tax_rate ?? doc.taxRate ?? quote?.tax_rate ?? bill?.tax_rate
      const explicitTaxRate = (rawTaxRate !== undefined && rawTaxRate !== null && rawTaxRate !== '' && !isNaN(parseFloat(rawTaxRate)))
        ? parseFloat(rawTaxRate)
        : null

      const tempDiscount = Math.max(explicitDiscount, lineDiscounts)
      const tempTaxable = Math.max(0, grossSubtotal - tempDiscount)

      let taxAmt = 0
      if (explicitTaxAmt > 0) {
        taxAmt = explicitTaxAmt
      } else if (explicitTaxRate !== null && explicitTaxRate > 0) {
        taxAmt = tempTaxable * (explicitTaxRate / 100)
      } else if (explicitTotalAmount > 0 && explicitTotalAmount > tempTaxable) {
        taxAmt = explicitTotalAmount - tempTaxable
      }

      const grossTotalWithTax = grossSubtotal + taxAmt
      const diffDiscount = (grossTotalWithTax > 0 && explicitTotalAmount > 0 && grossTotalWithTax > explicitTotalAmount + 0.01)
        ? (grossTotalWithTax - explicitTotalAmount)
        : 0
      const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)
      const taxableSubtotal = Math.max(0, grossSubtotal - totalDiscount)
      const totalAmount = explicitTotalAmount > 0 ? explicitTotalAmount : (taxableSubtotal + taxAmt)

      let effectiveTaxRate = 0
      if (taxAmt > 0 && taxableSubtotal > 0) {
        effectiveTaxRate = Math.round((taxAmt / taxableSubtotal) * 100)
      } else if (explicitTaxRate > 0) {
        effectiveTaxRate = explicitTaxRate
      }

      const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '0'
      const cgst = taxAmt / 2
      const sgst = taxAmt / 2

      const issueDate = fmtDate(doc.issue_date || doc.created_at)
      const dueDate = fmtDate(doc.valid_until || doc.due_date)

      const startX = 36
      const contentWidth = 523
      let currentY = 36

      // ── 1. Header Banner (Blue Box) ──
      const bannerHeight = 70
      pdf.rect(startX, currentY, contentWidth, bannerHeight).fill('#1e3a8a')

      // Left Banner Info
      pdf.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(companyName, startX + 16, currentY + 12, { width: 300 })
      let subStr = companyAddress ? `${companyAddress}\n` : ''
      subStr += companyPhone ? `Phone: ${companyPhone} ` : ''
      if (companyGstin) subStr += `· GSTIN: ${companyGstin.toUpperCase()}`
      else if (isQuote) subStr += `Official Supplier & Goods Provider`

      pdf.fillColor('#cbd5e1').fontSize(8.5).font('Helvetica').text(subStr, startX + 16, currentY + 34, { width: 320, lineGap: 2 })

      // Right Banner Info
      pdf.fillColor('#93c5fd').fontSize(8.5).font('Helvetica-Bold').text(bannerLabel, startX + 300, currentY + 12, { width: 207, align: 'right' })
      pdf.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(docId, startX + 300, currentY + 24, { width: 207, align: 'right' })
      let dateMeta = `Date: ${issueDate}`
      if (isQuote) dateMeta += `  |  Valid Until: ${dueDate}`
      else if (doc.due_date) dateMeta += `  |  Due: ${fmtDate(doc.due_date)}`
      pdf.fillColor('#e2e8f0').fontSize(8).font('Helvetica').text(dateMeta, startX + 300, currentY + 48, { width: 207, align: 'right' })

      currentY += bannerHeight + 16

      // ── 2. Section 1: Details Grid ──
      pdf.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text(sectionTitle1, startX, currentY)
      currentY += 12

      const gridHeight = 34
      pdf.rect(startX, currentY, contentWidth, gridHeight).fillAndStroke('#f8fafc', '#cbd5e1')

      let validOrGstinVal = '—'
      if (isQuote) {
        validOrGstinVal = dueDate
      } else if (companyGstin) {
        validOrGstinVal = companyGstin.toUpperCase()
      }

      const detailsArr = [
        { lbl: isQuote ? 'QUOTATION NO' : 'INVOICE NO', val: docId },
        ...(orderId ? [{ lbl: 'ORDER NO', val: orderId, color: '#2563eb' }] : []),
        { lbl: 'GENERATED DATE', val: issueDate },
        { lbl: isQuote ? 'VALID UNTIL' : 'COMPANY GSTIN', val: validOrGstinVal },
        { lbl: 'DOCUMENT TYPE', val: docTypeTitle }
      ]

      const numCols = detailsArr.length
      const colW = contentWidth / numCols

      detailsArr.forEach((item, idx) => {
        const cX = startX + (idx * colW)
        if (idx > 0) {
          pdf.moveTo(cX, currentY).lineTo(cX, currentY + gridHeight).stroke('#e2e8f0')
        }
        pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(item.lbl, cX + 6, currentY + 6, { width: colW - 12 })
        pdf.fillColor(item.color || '#0f172a').fontSize(8.5).font('Helvetica-Bold').text(item.val, cX + 6, currentY + 18, { width: colW - 12 })
      })

      currentY += gridHeight + 16

      // ── 3. Section 2: Address Details ──
      pdf.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('2. ADDRESS DETAILS', startX, currentY)
      currentY += 12

      const cardW = (contentWidth - 14) / 2
      const cardH = 75

      // Supplier Card (From)
      pdf.rect(startX, currentY, cardW, cardH).fillAndStroke('#ffffff', '#cbd5e1')
      pdf.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('FROM (SUPPLIER)', startX + 10, currentY + 8)
      pdf.moveTo(startX + 10, currentY + 20).lineTo(startX + cardW - 10, currentY + 20).stroke('#f1f5f9')
      pdf.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(companyName, startX + 10, currentY + 24, { width: cardW - 20 })
      let fromDetails = ''
      if (companyGstin) fromDetails += `GSTIN: ${companyGstin.toUpperCase()}\n`
      if (companyAddress) fromDetails += `Dispatch From: ${companyAddress}\n`
      if (companyPhone) fromDetails += `Phone: ${companyPhone}`
      pdf.fillColor('#475569').fontSize(8).font('Helvetica').text(fromDetails, startX + 10, currentY + 38, { width: cardW - 20, lineGap: 1 })

      // Buyer Card (To)
      const buyerX = startX + cardW + 14
      pdf.rect(buyerX, currentY, cardW, cardH).fillAndStroke('#ffffff', '#cbd5e1')
      pdf.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('TO (BUYER)', buyerX + 10, currentY + 8)
      pdf.moveTo(buyerX + 10, currentY + 20).lineTo(buyerX + cardW - 10, currentY + 20).stroke('#f1f5f9')
      pdf.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(customerName || '—', buyerX + 10, currentY + 24, { width: cardW - 20 })
      let toDetails = ''
      if (customerGstin) toDetails += `GSTIN: ${customerGstin.toUpperCase()}\n`
      if (customerCompany) toDetails += `${customerCompany}\n`
      if (customerAddress) toDetails += `Ship To: ${customerAddress}\n`
      if (customerPhone) toDetails += `Phone: ${customerPhone}`
      pdf.fillColor('#475569').fontSize(8).font('Helvetica').text(toDetails, buyerX + 10, currentY + 38, { width: cardW - 20, lineGap: 1 })

      currentY += cardH + 16

      // ── 4. Section 3: Goods Details Table ──
      pdf.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('3. GOODS DETAILS', startX, currentY)
      currentY += 12

      // Header Row
      const tableHdrH = 22
      pdf.rect(startX, currentY, contentWidth, tableHdrH).fillAndStroke('#f8fafc', '#cbd5e1')
      pdf.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')

      // Balanced Column widths: HSN(58), Prod(156), Qty(60), GrossSubtotal(82), Disc(62), TaxRate(80)
      pdf.text('HSN CODE', startX + 6, currentY + 7, { width: 56 })
      pdf.text('PRODUCT NAME & DESC.', startX + 66, currentY + 7, { width: 154 })
      pdf.text('QUANTITY', startX + 224, currentY + 7, { width: 58, align: 'center' })
      pdf.text('GROSS SUBTOTAL', startX + 286, currentY + 7, { width: 80, align: 'right' })
      pdf.text('DISCOUNT', startX + 370, currentY + 7, { width: 58, align: 'right' })
      pdf.text('TAX RATE (C+S+I)', startX + 432, currentY + 7, { width: 85, align: 'right' })

      currentY += tableHdrH

      // Table Item Rows
      items.forEach((li, i) => {
        const qty = parseFloat(li.qty || li.quantity || 1)
        const price = parseFloat(li.price || li.rate || 0)
        const disc = parseFloat(li.discount || 0)
        const lineTotalGross = price * qty

        let itemDisc = 0
        if (disc > 0) {
          itemDisc = disc
        } else if (totalDiscount > 0) {
          itemDisc = items.length === 1
            ? totalDiscount
            : Math.round(((lineTotalGross / (grossSubtotal || 1)) * totalDiscount) * 100) / 100
        }

        const pId = li.product_id || li.productId || li.id
        const prodNameRaw = (typeof li === 'string' && li.trim())
          ? li
          : (li.name || li.product_name || li.productName || li.product || li.item_name || li.title || li.description || '')

        const prodName = prodNameRaw || 'Product Item'
        const rawUnit = li.unit || li.unitLabel || ''
        const dbUnit = ''

        let bagWeight = parseFloat(li.bag_weight ?? li.bagWeight ?? li.pack_weight ?? li.packWeight ?? 0)
        if (isNaN(bagWeight) || bagWeight <= 0) {
          const nameMatch = prodName.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
          if (nameMatch && nameMatch[1]) bagWeight = parseFloat(nameMatch[1])
          else bagWeight = 1
        }

        const { displayQty, displayUnit, subtext } = resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName, isQuote)
        const rawHsn = li.hsn_code || li.hsn || li.sku || ''
        const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
          ? `1006${String(pId || (i + 1001)).padStart(4, '0')}`
          : rawHsn

        const rowH = subtext ? 26 : 22
        pdf.rect(startX, currentY, contentWidth, rowH).fillAndStroke('#ffffff', '#cbd5e1')

        pdf.fillColor('#475569').fontSize(7.5).font('Courier').text(hsnCode, startX + 6, currentY + 6, { width: 56 })
        pdf.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(prodName, startX + 66, currentY + 4, { width: 154 })
        if (subtext) {
          pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(subtext, startX + 66, currentY + 14, { width: 154 })
        }

        pdf.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(`${displayQty} ${displayUnit}`, startX + 224, currentY + 6, { width: 58, align: 'center' })
        
        // GROSS SUBTOTAL Cell (price * qty)
        pdf.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(`Rs. ${lineTotalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, startX + 286, currentY + 6, { width: 80, align: 'right' })

        // DISCOUNT Cell
        pdf.fillColor(itemDisc > 0.01 ? '#dc2626' : '#64748b').fontSize(8.5).font('Helvetica-Bold')
           .text(itemDisc > 0.01 ? `-Rs. ${itemDisc.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-', startX + 370, currentY + 6, { width: 58, align: 'right' })

        // TAX RATE Cell
        const taxLabel = taxAmt > 0 ? `CGST(${halfTaxRate}%)+SGST(${halfTaxRate}%)` : '-'
        pdf.fillColor('#475569').fontSize(7.5).font('Helvetica').text(taxLabel, startX + 432, currentY + 6, { width: 85, align: 'right' })

        currentY += rowH
      })

      currentY += 12

      // ── 5. Section 4: Totals Summary Row ──
      const summaryH = 34
      const summaryCols = []
      if (totalDiscount > 0) {
        summaryCols.push({ lbl: 'GROSS SUBTOTAL', val: `Rs. ${grossSubtotal.toFixed(2)}`, bg: '#f8fafc', textColor: '#0f172a' })
        summaryCols.push({ lbl: 'TOTAL DISCOUNT', val: `- Rs. ${totalDiscount.toFixed(2)}`, bg: '#fef2f2', textColor: '#dc2626' })
      }
      summaryCols.push({ lbl: "TOT. TAX'BLE AMT", val: `Rs. ${taxableSubtotal.toFixed(2)}`, bg: '#f8fafc', textColor: '#0f172a' })
      if (taxAmt > 0) {
        summaryCols.push({ lbl: 'CGST AMT', val: `Rs. ${cgst.toFixed(2)}`, bg: '#f8fafc', textColor: '#0f172a' })
        summaryCols.push({ lbl: 'SGST AMT', val: `Rs. ${sgst.toFixed(2)}`, bg: '#f8fafc', textColor: '#0f172a' })
      }
      summaryCols.push({ lbl: isQuote ? 'TOTAL QUOTE.AMT' : 'TOTAL INV.AMT', val: `Rs. ${totalAmount.toFixed(2)}`, bg: '#0f172a', textColor: '#ffffff' })

      const sColW = contentWidth / summaryCols.length

      summaryCols.forEach((col, idx) => {
        const sX = startX + (idx * sColW)
        pdf.rect(sX, currentY, sColW, summaryH).fillAndStroke(col.bg, '#cbd5e1')
        let labelColor = '#64748b'
        if (col.bg === '#0f172a') {
          labelColor = '#94a3b8'
        } else if (col.bg === '#fef2f2') {
          labelColor = '#991b1b'
        }
        pdf.fillColor(labelColor)
           .fontSize(7).font('Helvetica-Bold').text(col.lbl, sX + 4, currentY + 6, { width: sColW - 8, align: 'center' })
        pdf.fillColor(col.textColor).fontSize(9).font('Helvetica-Bold')
           .text(col.val, sX + 4, currentY + 18, { width: sColW - 8, align: 'center' })
      })

      currentY += summaryH + 20

      // ── 6. Barcode Drawing ──
      const barcodeCenterX = startX + (contentWidth / 2)
      const barcodeX = barcodeCenterX - 90
      pdf.rect(barcodeX, currentY, 180, 24).fill('#000000')
      pdf.fillColor('#ffffff').fontSize(7).font('Courier').text(docId, barcodeX, currentY + 8, { width: 180, align: 'center' })

      currentY += 32

      // ── 7. Footer ──
      pdf.moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke('#e2e8f0')
      currentY += 8
      pdf.fillColor('#94a3b8').fontSize(8).font('Helvetica')
         .text(`Official ${docTypeTitle} generated by Workshop · ${fmtDate(new Date())}`, startX, currentY, { width: contentWidth, align: 'center' })

      pdf.end()
    } catch (e) {
      reject(e)
    }
  })
}

// ─────────────────────────────────────────────
// Main Export: puppeteer HTML → PDF Buffer
// ─────────────────────────────────────────────
export async function generateInvoicePdfBuffer({ quote = {}, bill = {}, billItems = [], shop = {}, type = '' } = {}) {
  const catalogMap = await getProductHsnMap().catch(() => ({}))
  const html = buildInvoiceHtml({ quote, bill, billItems, shop, catalogMap, type })

  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    }
    const exePath = getSystemBrowserPath()
    if (exePath) {
      launchOptions.executablePath = exePath
    }

    const browser = await puppeteer.launch(launchOptions)
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      })
      return pdfBuffer
    } finally {
      await browser.close()
    }
  } catch (puppeteerErr) {
    console.warn('[PDF Generation] Puppeteer failed, using PDFKit fallback:', puppeteerErr.message)
    return generatePdfKitFallback({ quote, bill, billItems, shop, type })
  }
}

export default generateInvoicePdfBuffer