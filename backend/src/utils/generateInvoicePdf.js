import puppeteer from 'puppeteer'
import PDFDocument from 'pdfkit'
import { getProductHsnMap } from '../lib/productCache.js'

let chromiumModule = null
let puppeteerCoreModule = null

try {
  chromiumModule = await import('@sparticuz/chromium').then(m => m.default || m).catch(() => null)
  puppeteerCoreModule = await import('puppeteer-core').then(m => m.default || m).catch(() => null)
} catch { }

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

  let uClean = String(rawUnit || '').trim()

  if (uClean.includes(':') || uClean.includes('₹') || uClean.includes('/')) {
    if (uClean.toLowerCase().includes('/ltr') || uClean.toLowerCase().includes('ltr')) {
      uClean = 'ltrs'
    } else if (uClean.toLowerCase().includes('/kg') || uClean.toLowerCase().includes('kg')) {
      uClean = 'kgs'
    } else if (uClean.toLowerCase().includes('/mtr') || uClean.toLowerCase().includes('mtr')) {
      uClean = 'mtrs'
    } else {
      uClean = uClean.split(':')[0].trim()
    }
  }

  const dbUnitStr = (typeof dbUnit === 'string' && ['kgs', 'kg', 'ltrs', 'ltr', 'pcs', 'bag', 'bags'].includes(dbUnit.toLowerCase())) ? dbUnit : ''
  const u = (uClean || dbUnitStr).toLowerCase().trim()
  const isBagUnit = ['bag', 'bags'].includes(u)

  // In Quotation flow (isQuote === true) OR explicitly specified Bag unit:
  // Quantity = 10 means 10 Bags (e.g. 10 Bag, subtext "50kg Bag")
  if (isQuote || isBagUnit) {
    let subtext
    if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l', 'ml'].includes(u)) {
      subtext = 'ltrs'
      return { displayQty: qty, displayUnit: 'ltrs', subtext }
    } else if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
      subtext = bw > 1 ? `${bw}m Roll` : 'mtrs'
      return { displayQty: qty, displayUnit: 'mtrs', subtext }
    } else {
      subtext = bw > 1 ? `${bw}kg Bag` : 'Bag'
      return { displayQty: qty, displayUnit: 'Bag', subtext }
    }
  }

  // Direct Invoice Flow (isQuote === false):
  // Quantity = 10 means 10 kgs (loose kgs, no bag subtext)
  let baseUnitLabel = uClean || u || 'kgs'
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) baseUnitLabel = 'kgs'
  else if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) baseUnitLabel = 'ltrs'
  else if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) baseUnitLabel = 'mtrs'

  return {
    displayQty: qty,
    displayUnit: baseUnitLabel,
    subtext: ''
  }
}

// ─────────────────────────────────────────────
// HTML Builder  (mirrors BillPreview.jsx exactly)
// ─────────────────────────────────────────────
function buildInvoiceHtml({ quote = {}, bill = {}, billItems = [], shop = {}, catalogMap = {}, type = '' } = {}) {
  const isQuote = type === 'quotation' || (type !== 'invoice' && !bill.bill_number && !bill.id && Boolean(quote.id || quote.quote_number)) || Boolean(quote.quote_number || bill.quote_number || quote.quote_id || bill.quote_id)

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
function getExplicitLineDiscount(li) {
  const explicit = parseFloat(li.discount ?? li.discount_amount ?? li.discountAmount ?? li.disc ?? NaN)
  if (!isNaN(explicit) && explicit >= 0) return explicit
  const qty = parseFloat(li.quantity || li.qty || 1)
  const rate = parseFloat(li.rate || li.price || 0)
  const lineGross = qty * rate
  const lineAmt = parseFloat(li.amount ?? li.line_total ?? NaN)
  if (!isNaN(lineAmt) && lineGross > lineAmt + 0.01) {
    return Math.round((lineGross - lineAmt) * 100) / 100
  }
  return 0
}

  const lineDiscounts = items.reduce((s, li) => s + getExplicitLineDiscount(li), 0)
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
  if (explicitTaxRate !== null && explicitTaxRate !== undefined && !isNaN(explicitTaxRate) && explicitTaxRate >= 0) {
    effectiveTaxRate = explicitTaxRate
  } else if (taxAmt > 0 && taxableSubtotal > 0) {
    effectiveTaxRate = Math.round((taxAmt / taxableSubtotal) * 100)
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
    const disc = getExplicitLineDiscount(li)
    const lineTotalGross = price * qty
    let itemDisc = disc
    if (itemDisc === 0 && lineDiscounts === 0 && totalDiscount > 0) {
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
      <td style="font-weight:600;color:#475569;font-size:10.5px;font-family:monospace;padding:10px 12px;border:1px solid #cbd5e1;line-height:1.4">${hsnCode}</td>
      <td style="padding:10px 12px;border:1px solid #cbd5e1;line-height:1.4">
        <div style="font-weight:700;color:#0f172a;font-size:11.5px">${prodName}</div>
        ${subtext ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px">${subtext}</div>` : ''}
      </td>
      <td style="text-align:center;font-weight:600;padding:10px 12px;border:1px solid #cbd5e1;font-size:11.5px;line-height:1.4">${displayQty} ${displayUnit}</td>
      <td style="text-align:right;font-weight:700;padding:10px 12px;border:1px solid #cbd5e1;font-size:11.5px;line-height:1.4">${INR(lineTotalGross)}</td>
      <td style="text-align:right;font-weight:700;padding:10px 12px;border:1px solid #cbd5e1;font-size:11.5px;line-height:1.4;color:${itemDisc > 0.01 ? '#dc2626' : '#64748b'}">
        ${itemDisc > 0.01 ? `-${INR(itemDisc)}` : '-'}
      </td>
      <td style="text-align:right;font-size:10.5px;color:#475569;padding:10px 12px;border:1px solid #cbd5e1;line-height:1.4">
        ${taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : '-'}
      </td>
    </tr>`
  }).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No line items found</td></tr>`

  const totalsHtml = `
    <div style="display:flex;border:1px solid #cbd5e1;background:#f8fafc;margin-bottom:20px;text-align:center;width:100%">
      ${totalDiscount > 0 ? `
      <div style="flex:1;padding:8px 3px;border-right:1px solid #cbd5e1;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;white-space:nowrap;overflow:hidden">Gross Subtotal</div>
        <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;white-space:nowrap;overflow:hidden">${INR(grossSubtotal)}</div>
      </div>
      <div style="flex:1;padding:8px 3px;border-right:1px solid #cbd5e1;background:#fef2f2;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#991b1b;text-transform:uppercase;white-space:nowrap;overflow:hidden">Total Discount</div>
        <div style="font-size:11px;font-weight:800;color:#dc2626;margin-top:2px;white-space:nowrap;overflow:hidden">- ${INR(totalDiscount)}</div>
      </div>
      ` : ''}
      <div style="flex:1;padding:8px 3px;border-right:1px solid #cbd5e1;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;white-space:nowrap;overflow:hidden">Tot. Tax'ble Amt</div>
        <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;white-space:nowrap;overflow:hidden">${INR(taxableSubtotal)}</div>
      </div>
      ${taxAmt > 0 ? `
      <div style="flex:1;padding:8px 3px;border-right:1px solid #cbd5e1;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;white-space:nowrap;overflow:hidden">CGST Amt</div>
        <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;white-space:nowrap;overflow:hidden">${INR(cgst)}</div>
      </div>
      <div style="flex:1;padding:8px 3px;border-right:1px solid #cbd5e1;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;white-space:nowrap;overflow:hidden">SGST Amt</div>
        <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;white-space:nowrap;overflow:hidden">${INR(sgst)}</div>
      </div>
      ` : ''}
      <div style="flex:1;padding:8px 3px;background:#0f172a;min-width:0">
        <div style="font-size:8.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;white-space:nowrap;overflow:hidden">${isQuote ? 'Total Quote.Amt' : 'Total Inv.Amt'}</div>
        <div style="font-size:12px;font-weight:800;color:#ffffff;margin-top:2px;white-space:nowrap;overflow:hidden">${INR(totalAmount)}</div>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { margin: 0; size: A4; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#fff; color:#0f172a; padding:20px; }
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
// PDFKit Professional Invoice Generator
// ─────────────────────────────────────────────
async function generatePdfKitFallback({ quote = {}, bill = {}, billItems = [], shop = {}, type = '' } = {}) {
  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true })
      const chunks = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      const isQuote = type === 'quote' || (!bill?.id && quote?.quote_number)
      const docTypeTitle = isQuote ? 'QUOTATION' : 'TAX INVOICE'
      const docNum = isQuote ? (quote.quote_number || 'QT-001') : (bill.bill_number || `INV-${String(bill.id || 1).padStart(6, '0')}`)
      const orderNum = quote.order_number || bill.order_number || ''
      const seller = shop.shop_name || shop.name || quote.shop_name || bill.shop_name || 'Workshop'
      const sellerGstin = shop.gstin || quote.shop_gstin || bill.shop_gstin || ''
      const sellerPhone = shop.phone || quote.shop_phone || bill.shop_phone || ''
      const sellerEmail = shop.email || quote.shop_email || bill.shop_email || ''
      const sellerAddress = shop.address || quote.shop_address || bill.shop_address || ''

      const customer = quote.customer_name || 'Customer'
      const customerCompany = quote.customer_company || ''
      const customerPhone = quote.customer_phone || ''
      const customerEmail = quote.customer_email || ''

      const itemsList = Array.isArray(billItems) && billItems.length ? billItems : parseItems(quote.line_items)
      
      const totalAmountNum = parseFloat(bill.amount || quote.total_amount || 0)
      const taxableAmount = totalAmountNum / 1.18
      const gstHalf = (totalAmountNum - taxableAmount) / 2

      // Top Accent Line
      doc.rect(40, 35, 515, 4).fill('#2563eb')

      // Header Section
      doc.fontSize(16).fillColor('#0f172a').font('Helvetica-Bold').text(seller, 40, 48)
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
      
      let headerY = 68
      if (sellerAddress) {
        doc.text(sellerAddress, 40, headerY, { width: 300 })
        headerY += 16
      }
      const sellerContact = [sellerPhone && `Phone: ${sellerPhone}`, sellerEmail && `Email: ${sellerEmail}`].filter(Boolean).join('   |   ')
      if (sellerContact) {
        doc.text(sellerContact, 40, headerY)
        headerY += 12
      }
      if (sellerGstin) {
        doc.text(`GSTIN: ${sellerGstin.toUpperCase()}`, 40, headerY)
      }

      // Right Header Badge & Meta
      doc.roundedRect(390, 48, 165, 24, 4).fill('#eff6ff')
      doc.fontSize(12).fillColor('#1d4ed8').font('Helvetica-Bold').text(docTypeTitle, 390, 55, { width: 165, align: 'center' })

      doc.fontSize(8.5).fillColor('#475569').font('Helvetica')
      doc.text(`Invoice No:`, 390, 80)
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(docNum, 460, 80, { width: 95, align: 'right' })

      if (orderNum) {
        doc.font('Helvetica').fillColor('#475569').text(`Order No:`, 390, 94)
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(orderNum, 460, 94, { width: 95, align: 'right' })
      }

      const dateY = orderNum ? 108 : 94
      doc.font('Helvetica').fillColor('#475569').text(`Date:`, 390, dateY)
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(new Date().toLocaleDateString('en-IN'), 460, dateY, { width: 95, align: 'right' })

      // Divider
      doc.strokeColor('#e2e8f0').lineWidth(0.75).moveTo(40, 128).lineTo(555, 128).stroke()

      // Billed To Card
      doc.roundedRect(40, 136, 515, 52, 4).fillAndStroke('#f8fafc', '#e2e8f0')
      doc.fontSize(7.5).fillColor('#64748b').font('Helvetica-Bold').text('BILLED TO / CUSTOMER DETAILS', 50, 142)
      doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text(customer + (customerCompany ? ` (${customerCompany})` : ''), 50, 154)
      doc.fontSize(8).fillColor('#475569').font('Helvetica')
      const custContact = [customerPhone && `Phone: ${customerPhone}`, customerEmail && `Email: ${customerEmail}`].filter(Boolean).join('   |   ')
      doc.text(custContact || 'No contact details specified', 50, 168)

      // Items Table
      let tableY = 200
      const col = { no: 40, name: 65, hsn: 260, unit: 325, qty: 375, rate: 435, amt: 495 }
      const colW = { no: 25, name: 195, hsn: 65, unit: 50, qty: 60, rate: 60, amt: 60 }

      // Table Header
      doc.rect(40, tableY, 515, 22).fill('#1e293b')
      doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica-Bold')
      doc.text('#', col.no + 5, tableY + 7)
      doc.text('ITEM DESCRIPTION', col.name, tableY + 7)
      doc.text('HSN/SAC', col.hsn, tableY + 7)
      doc.text('UNIT', col.unit, tableY + 7)
      doc.text('QTY', col.qty, tableY + 7, { width: colW.qty - 5, align: 'right' })
      doc.text('RATE (₹)', col.rate, tableY + 7, { width: colW.rate - 5, align: 'right' })
      doc.text('AMOUNT (₹)', col.amt, tableY + 7, { width: colW.amt - 5, align: 'right' })

      tableY += 22

      // Table Rows
      itemsList.forEach((it, idx) => {
        const isEven = idx % 2 === 0
        const rowBg = isEven ? '#ffffff' : '#f8fafc'
        doc.rect(40, tableY, 515, 20).fill(rowBg)
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(40, tableY, 515, 20).stroke()

        const name = it.product_name || it.name || `Item ${idx + 1}`
        const hsn = it.hsn_code || '100829'
        const unit = it.unit || 'Bag'
        const qty = parseFloat(it.quantity || 1).toFixed(2)
        const rate = parseFloat(it.price || it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const lineTotal = parseFloat(it.line_total || it.amount || (parseFloat(qty) * parseFloat(it.price || it.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

        doc.fontSize(8).fillColor('#475569').font('Helvetica')
        doc.text(String(idx + 1), col.no + 5, tableY + 6)
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(name, col.name, tableY + 6, { width: colW.name - 5, ellipsis: true })
        doc.fillColor('#64748b').font('Helvetica').text(hsn, col.hsn, tableY + 6)
        doc.text(unit, col.unit, tableY + 6)
        doc.text(qty, col.qty, tableY + 6, { width: colW.qty - 5, align: 'right' })
        doc.text(rate, col.rate, tableY + 6, { width: colW.rate - 5, align: 'right' })
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(lineTotal, col.amt, tableY + 6, { width: colW.amt - 5, align: 'right' })

        tableY += 20
      })

      // Bottom Totals & Summary Box
      tableY += 12

      // Left Column: Bank Details & Notes
      doc.roundedRect(40, tableY, 280, 84, 4).fillAndStroke('#f8fafc', '#e2e8f0')
      doc.fontSize(7.5).fillColor('#64748b').font('Helvetica-Bold').text('PAYMENT TERMS & NOTES', 48, tableY + 8)
      doc.fontSize(8).fillColor('#334155').font('Helvetica')
      if (shop.bank_name) {
        doc.text(`Bank Name: ${shop.bank_name}`, 48, tableY + 22)
        doc.text(`A/C No: ${shop.account_number || '—'}`, 48, tableY + 34)
        doc.text(`IFSC Code: ${shop.ifsc || '—'}   |   Branch: ${shop.branch || 'Main Branch'}`, 48, tableY + 46)
      } else {
        doc.text(`Terms: Payment within 15 days of invoice date.`, 48, tableY + 22)
        doc.text(`Notes: ${quote.notes || bill.notes || 'Goods once sold will not be taken back or exchanged.'}`, 48, tableY + 36, { width: 260 })
      }

      // Right Column: Tax Breakdown & Total
      const totX = 340
      const valX = 460
      const totW = 95

      doc.fontSize(8.5).fillColor('#475569').font('Helvetica')
      doc.text('Taxable Value:', totX, tableY + 4)
      doc.text(`₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valX, tableY + 4, { width: totW, align: 'right' })

      doc.text('CGST (9.0%):', totX, tableY + 18)
      doc.text(`₹${gstHalf.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valX, tableY + 18, { width: totW, align: 'right' })

      doc.text('SGST (9.0%):', totX, tableY + 32)
      doc.text(`₹${gstHalf.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valX, tableY + 32, { width: totW, align: 'right' })

      // Grand Total Box
      doc.roundedRect(totX - 8, tableY + 50, 223, 34, 4).fill('#2563eb')
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold').text('GRAND TOTAL:', totX, tableY + 61)
      doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold').text(`₹${totalAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valX - 20, tableY + 59, { width: totW + 20, align: 'right' })

      // Signatory Section
      const signY = tableY + 110
      doc.fontSize(7.5).fillColor('#64748b').font('Helvetica').text('Terms & Conditions: Goods once sold will not be taken back or exchanged.', 40, signY + 30)

      doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold').text(`For ${seller}`, 380, signY, { width: 175, align: 'center' })
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(390, signY + 36).lineTo(545, signY + 36).stroke()
      doc.fontSize(7.5).fillColor('#64748b').font('Helvetica').text('Authorised Signatory', 380, signY + 40, { width: 175, align: 'center' })

      // Footer
      doc.fontSize(7).fillColor('#94a3b8').text(`Official ${docTypeTitle} generated automatically by Workshop CRM · Computer Generated Document`, 40, 780, { width: 515, align: 'center' })

      doc.end()
    } catch (err) {
      console.error('[PDFKit Fallback Error]', err.message)
      resolve(null)
    }
  })
}

// ─────────────────────────────────────────────
// Main Export: HTML → PDF Buffer
// ─────────────────────────────────────────────
export async function generateInvoicePdfBuffer({ quote = {}, bill = {}, billItems = [], shop = {}, type = '' } = {}) {
  try {
    const catalogMap = await getProductHsnMap().catch(() => ({}))
    const html = buildInvoiceHtml({ quote, bill, billItems, shop, catalogMap, type })

    let browser = null
    const isLinux = process.platform === 'linux'

    if (isLinux && chromiumModule && puppeteerCoreModule) {
      try {
        const executablePath = await chromiumModule.executablePath()
        if (executablePath) {
          browser = await puppeteerCoreModule.launch({
            args: chromiumModule.args,
            defaultViewport: chromiumModule.defaultViewport,
            executablePath,
            headless: chromiumModule.headless
          })
        }
      } catch (sparticuzErr) {
        console.warn('[PDF Generation] Sparticuz chromium launch failed:', sparticuzErr.message)
      }
    }

    if (!browser) {
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ]
      }
      const exePath = getSystemBrowserPath()
      if (exePath) {
        launchOptions.executablePath = exePath
      }
      browser = await puppeteer.launch(launchOptions)
    }

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      })
      return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    } finally {
      if (browser) await browser.close()
    }
  } catch (err) {
    console.warn('[Puppeteer PDF Warning] Falling back to PDFKit generator:', err.message)
    const fallbackBuf = await generatePdfKitFallback({ quote, bill, billItems, shop, type })
    return fallbackBuf
  }
}

export default generateInvoicePdfBuffer