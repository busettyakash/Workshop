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

function resolveProdName(prodName, dbUnit) {
  if (typeof prodName === 'string' && prodName.trim()) return prodName
  if (typeof dbUnit === 'string' && !['kgs', 'kg', 'ltrs', 'ltr', 'pcs', 'bag', 'bags'].includes(dbUnit.toLowerCase())) {
    return dbUnit
  }
  return ''
}

function inferBagWeight(bw, pNameLower) {
  if (bw > 1 || !pNameLower) return bw
  const nameWeightMatch = pNameLower.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
  if (nameWeightMatch && nameWeightMatch[1]) {
    return Number.parseFloat(nameWeightMatch[1])
  }
  if (pNameLower.includes('soddalu')) return 50
  if (pNameLower.includes('kurnool') || pNameLower.includes('rice')) return 26
  return bw
}

function cleanUnitStr(rawUnit) {
  let uClean = String(rawUnit || '').trim()
  if (uClean.includes(':') || uClean.includes('₹') || uClean.includes('/')) {
    const lower = uClean.toLowerCase()
    if (lower.includes('/ltr') || lower.includes('ltr')) return 'ltrs'
    if (lower.includes('/kg') || lower.includes('kg')) return 'kgs'
    if (lower.includes('/mtr') || lower.includes('mtr')) return 'mtrs'
    return uClean.split(':')[0].trim()
  }
  return uClean
}

function getExplicitLineDiscount(li) {
  const explicit = Number.parseFloat(li.discount ?? li.discount_amount ?? li.discountAmount ?? li.disc ?? Number.NaN)
  if (!Number.isNaN(explicit) && explicit >= 0) return explicit
  const qty = Number.parseFloat(li.quantity || li.qty || 1)
  const rate = Number.parseFloat(li.rate || li.price || 0)
  const lineGross = qty * rate
  const lineAmt = Number.parseFloat(li.amount ?? li.line_total ?? Number.NaN)
  if (!Number.isNaN(lineAmt) && lineGross > lineAmt + 0.01) {
    return Math.round((lineGross - lineAmt) * 100) / 100
  }
  return 0
}

function resolveBoxUnit(u, qty, bw) {
  if (!['box', 'boxes', 'carton', 'cartons', 'pkt', 'pack', 'packs'].includes(u)) return null
  let unitName = 'Pack'
  if (u === 'box' || u === 'boxes') {
    unitName = qty === 1 ? 'Box' : 'Boxes'
  }
  const sub = bw > 1 ? `${bw} pcs/${unitName}` : unitName
  return { displayQty: qty, displayUnit: unitName, subtext: sub }
}

function resolveCountUnit(u, qty) {
  if (['pcs', 'pc', 'piece', 'pieces'].includes(u)) return { displayQty: qty, displayUnit: 'pcs', subtext: 'pcs' }
  if (['doz', 'dozen'].includes(u)) return { displayQty: qty, displayUnit: 'doz', subtext: 'Dozen' }
  if (['set', 'sets'].includes(u)) return { displayQty: qty, displayUnit: 'set', subtext: 'Set' }
  return null
}

function resolveLengthUnit(u, qty, bw) {
  if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) return { displayQty: qty, displayUnit: 'mtrs', subtext: bw > 1 ? `${bw}m Roll` : 'mtrs' }
  if (['ft', 'feet', 'foot'].includes(u)) return { displayQty: qty, displayUnit: 'ft', subtext: bw > 1 ? `${bw}ft Bundle` : 'ft' }
  return null
}

function resolveVolumeUnit(u, qty, bw) {
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) return { displayQty: qty, displayUnit: 'ltrs', subtext: bw > 1 ? `${bw}L Drum` : 'ltrs' }
  if (['ml', 'milliliter', 'milliliters'].includes(u)) return { displayQty: qty, displayUnit: 'ml', subtext: 'ml' }
  return null
}

function resolveWeightUnit(u, qty, bw, isQuote) {
  if (['bag', 'bags'].includes(u) || (isQuote && ['kgs', 'kg', 'kilogram', 'kilograms'].includes(u))) {
    return { displayQty: qty, displayUnit: 'Bag', subtext: bw > 1 ? `${bw}kg Bag` : 'Bag' }
  }
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) {
    return { displayQty: qty, displayUnit: 'kgs', subtext: bw > 1 ? `${bw}kg Bag` : 'kgs' }
  }
  return null
}

function resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName = '', isQuote = false) {
  const pName = resolveProdName(prodName, dbUnit)
  const bw = inferBagWeight(Number.parseFloat(bagWeight || 1), pName.toLowerCase())
  const uClean = cleanUnitStr(rawUnit)
  const dbUnitStr = (typeof dbUnit === 'string' && ['kgs', 'kg', 'ltrs', 'ltr', 'pcs', 'pc', 'box', 'boxes', 'pack', 'doz', 'set', 'mtr', 'mtrs', 'bag', 'bags'].includes(dbUnit.toLowerCase())) ? dbUnit : ''
  const u = (uClean || dbUnitStr).toLowerCase().trim()

  return resolveBoxUnit(u, qty, bw) ||
    resolveCountUnit(u, qty) ||
    resolveLengthUnit(u, qty, bw) ||
    resolveVolumeUnit(u, qty, bw) ||
    resolveWeightUnit(u, qty, bw, isQuote) ||
    { displayQty: qty, displayUnit: uClean || dbUnitStr || 'unit', subtext: uClean || dbUnitStr || 'unit' }
}

function resolveDocumentNumber({ quote, bill, isQuote }) {
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

  if (isQuote) {
    return quoteNumFound || `QT-${quote.id || '820332'}`
  }
  if (bill.bill_number) {
    return bill.bill_number
  }
  if (bill.id) {
    return `INV-${String(bill.id).padStart(5, '0')}`
  }
  return 'INV-10001'
}

function resolveExplicitTaxValues(doc, quote, bill) {
  const rawTaxAmt = doc.tax_amount ?? doc.taxAmount ?? quote?.tax_amount ?? bill?.tax_amount
  const hasExplicitTaxAmt = rawTaxAmt !== undefined && rawTaxAmt !== null && rawTaxAmt !== '' && !Number.isNaN(Number.parseFloat(rawTaxAmt))
  const explicitTaxAmt = hasExplicitTaxAmt ? Number.parseFloat(rawTaxAmt) : 0

  const rawTaxRate = doc.tax_rate ?? doc.taxRate ?? quote?.tax_rate ?? bill?.tax_rate
  const explicitTaxRate = (rawTaxRate !== undefined && rawTaxRate !== null && rawTaxRate !== '' && !Number.isNaN(Number.parseFloat(rawTaxRate)))
    ? Number.parseFloat(rawTaxRate)
    : null

  return { explicitTaxAmt, explicitTaxRate }
}

function computeInvoiceTaxAmount(explicitTaxAmt, explicitTaxRate, tempTaxable, explicitTotalAmount) {
  if (explicitTaxAmt > 0) return explicitTaxAmt
  if (explicitTaxRate !== null && explicitTaxRate > 0) {
    return tempTaxable * (explicitTaxRate / 100)
  }
  if (explicitTotalAmount > 0 && explicitTotalAmount > tempTaxable) {
    return explicitTotalAmount - tempTaxable
  }
  return 0
}

function calculateInvoiceEffectiveTaxRate(explicitTaxRate, taxAmt, taxableSubtotal) {
  if (explicitTaxRate !== null && explicitTaxRate !== undefined && !Number.isNaN(explicitTaxRate) && explicitTaxRate >= 0) {
    return explicitTaxRate
  }
  if (taxAmt > 0 && taxableSubtotal > 0) {
    return Math.round((taxAmt / taxableSubtotal) * 100)
  }
  return 0
}

function calculateInvoiceTotals({ items, doc, quote, bill }) {
  const grossSubtotal = items.reduce((s, li) => {
    const q = Number.parseFloat(li.qty || li.quantity || 1)
    const p = Number.parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)

  const lineDiscounts = items.reduce((s, li) => s + getExplicitLineDiscount(li), 0)
  const explicitDiscount = Number.parseFloat(doc.discount || doc.discount_amount || quote?.discount || bill?.discount || 0)
  const explicitTotalAmount = Number.parseFloat(doc.amount || doc.total_amount || 0)

  const { explicitTaxAmt, explicitTaxRate } = resolveExplicitTaxValues(doc, quote, bill)

  const tempDiscount = Math.max(explicitDiscount, lineDiscounts)
  const tempTaxable = Math.max(0, grossSubtotal - tempDiscount)
  const taxAmt = computeInvoiceTaxAmount(explicitTaxAmt, explicitTaxRate, tempTaxable, explicitTotalAmount)

  const grossTotalWithTax = grossSubtotal + taxAmt
  const diffDiscount = (grossTotalWithTax > 0 && explicitTotalAmount > 0 && grossTotalWithTax > explicitTotalAmount + 0.01)
    ? (grossTotalWithTax - explicitTotalAmount)
    : 0
  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)
  const taxableSubtotal = Math.max(0, grossSubtotal - totalDiscount)
  const totalAmount = explicitTotalAmount > 0 ? explicitTotalAmount : (taxableSubtotal + taxAmt)

  const effectiveTaxRate = calculateInvoiceEffectiveTaxRate(explicitTaxRate, taxAmt, taxableSubtotal)
  const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '0'
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  return {
    grossSubtotal,
    lineDiscounts,
    totalDiscount,
    taxableSubtotal,
    totalAmount,
    taxAmt,
    halfTaxRate,
    cgst,
    sgst
  }
}

function renderInvoiceItemRow(li, i, { items, grossSubtotal, lineDiscounts, totalDiscount, catalogMap, isQuote, halfTaxRate, taxAmt }) {
  const qty = Number.parseFloat(li.qty || li.quantity || 1)
  const price = Number.parseFloat(li.price || li.rate || 0)
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

  let bagWeight = Number.parseFloat(
    li.bag_weight ?? li.bagWeight ?? li.pack_weight ?? li.packWeight ??
    dbProd?.bag_weight ?? dbProd?.bagWeight ?? dbProd?.pack_weight ?? dbProd?.packWeight ?? 0
  )

  if (Number.isNaN(bagWeight) || bagWeight <= 0) {
    const nameMatch = prodName.match(/\b(\d{1,6})\s*(kgs?|ltrs?|liters?|mtrs?)\b/i)
    bagWeight = (nameMatch && nameMatch[1]) ? Number.parseFloat(nameMatch[1]) : 1
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
}

// ─────────────────────────────────────────────
// HTML Builder  (mirrors BillPreview.jsx exactly)
// ─────────────────────────────────────────────
function buildInvoiceHtml({ quote = {}, bill = {}, billItems = [], shop = {}, catalogMap = {}, type = '' } = {}) {
  const isQuote = type === 'quotation' || (type !== 'invoice' && !bill.bill_number && !bill.id && Boolean(quote.id || quote.quote_number)) || Boolean(quote.quote_number || bill.quote_number || quote.quote_id || bill.quote_id)
  const docId = resolveDocumentNumber({ quote, bill, isQuote })

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

  const {
    grossSubtotal,
    lineDiscounts,
    totalDiscount,
    taxableSubtotal,
    totalAmount,
    taxAmt,
    halfTaxRate,
    cgst,
    sgst
  } = calculateInvoiceTotals({ items, doc, quote, bill })

  const issueDate = fmtDate(doc.issue_date || doc.created_at)
  const dueDate = fmtDate(doc.valid_until || doc.due_date)

  const rowsHtml = items.length > 0
    ? items.map((li, i) => renderInvoiceItemRow(li, i, {
        items,
        grossSubtotal,
        lineDiscounts,
        totalDiscount,
        catalogMap,
        isQuote,
        halfTaxRate,
        taxAmt
      })).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No line items found</td></tr>'

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
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${docId}</title>
  <style>
    @page { margin: 0; size: A4; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color-adjust:exact!important; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    a[href^="tel"], a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; pointer-events: none !important; cursor: default !important; }
    body { font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#ffffff; color:#0f172a; padding:20px; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .page { max-width:800px; margin:0 auto; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; background:#ffffff; }
    .banner { background:#1e3a8a!important; background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%)!important; padding:36px 44px 32px; display:flex; justify-content:space-between; align-items:flex-start; position:relative; overflow:hidden; color:#ffffff!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .banner::before { content:''; position:absolute; top:-40px; right:-40px; width:180px; height:180px; background:rgba(255,255,255,0.12)!important; border-radius:50%; pointer-events:none; -webkit-print-color-adjust:exact!important; display:block!important; }
    .banner::after  { content:''; position:absolute; bottom:-60px; right:60px; width:130px; height:130px; background:rgba(255,255,255,0.08)!important; border-radius:50%; pointer-events:none; -webkit-print-color-adjust:exact!important; display:block!important; }
    .bl { position:relative; z-index:1; }
    .br { text-align:right; position:relative; z-index:1; }
    .co-name { font-size:24px; font-weight:800; color:#ffffff!important; margin-bottom:6px; letter-spacing:-0.03em; }
    .co-meta { font-size:12.5px; color:rgba(255,255,255,0.85)!important; line-height:1.6; }
    .inv-lbl { font-size:11px; font-weight:800; color:rgba(255,255,255,0.75)!important; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:6px; }
    .inv-num { font-size:30px; font-weight:900; color:#ffffff!important; line-height:1.1; margin-bottom:8px; }
    .inv-meta { font-size:12px; color:rgba(255,255,255,0.9)!important; line-height:1.7; }
    .body { padding:28px 40px; }
    .sec { font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:20px 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
    .meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; background:#f8fafc!important; border:1px solid #cbd5e1; border-radius:6px; padding:12px 16px; font-size:12px; margin-bottom:16px; -webkit-print-color-adjust:exact!important; }
    .meta-lbl { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:2px; }
    .meta-val { font-weight:700; color:#0f172a; }
    .addr-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
    .addr-card { border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#ffffff; }
    .addr-hdr  { font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px; }
    .addr-name { font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px; }
    .addr-txt  { font-size:12px; color:#475569; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1; }
    th { background:#f8fafc!important; padding:8px 10px; font-size:10px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:left; -webkit-print-color-adjust:exact!important; }
    td { padding:7px 10px; font-size:11px; border:1px solid #cbd5e1; color:#0f172a; }
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

import fs from 'node:fs'

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

function calculatePdfKitAmounts(items, quote, bill) {
  const grossSubtotal = items.reduce((s, li) => {
    const q = Number.parseFloat(li.qty || li.quantity || 1)
    const p = Number.parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)

  const lineDiscounts = items.reduce((s, li) => s + getExplicitLineDiscount(li), 0)
  const explicitDocDiscount = Number.parseFloat(quote.discount || bill.discount || quote.discount_amount || bill.discount_amount || 0)
  const totalDiscount = Math.max(lineDiscounts, explicitDocDiscount)
  const taxableSubtotal = Math.max(0, grossSubtotal - totalDiscount)

  const rawTaxRate = quote.tax_rate ?? bill.tax_rate
  const hasTaxRate = rawTaxRate !== undefined && rawTaxRate !== null && rawTaxRate !== '' && !Number.isNaN(Number.parseFloat(rawTaxRate))
  const explicitTaxRate = hasTaxRate ? Number.parseFloat(rawTaxRate) : 18.00

  const rawTaxAmt = quote.tax_amount ?? bill.tax_amount
  const hasTaxAmt = rawTaxAmt !== undefined && rawTaxAmt !== null && rawTaxAmt !== '' && !Number.isNaN(Number.parseFloat(rawTaxAmt))

  let taxAmt = 0
  if (hasTaxAmt && Number.parseFloat(rawTaxAmt) >= 0) {
    taxAmt = Number.parseFloat(rawTaxAmt)
  } else {
    taxAmt = taxableSubtotal * (explicitTaxRate / 100)
  }

  const explicitTotal = Number.parseFloat(bill.amount || quote.total_amount || 0)
  const totalAmount = explicitTotal > 0 ? explicitTotal : (taxableSubtotal + taxAmt)

  const halfRate = (explicitTaxRate / 2).toFixed(2).replace(/\.00$/, '')
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  return {
    grossSubtotal,
    lineDiscounts,
    totalDiscount,
    taxableSubtotal,
    explicitTaxRate,
    taxAmt,
    totalAmount,
    halfRate,
    cgst,
    sgst
  }
}

// ─────────────────────────────────────────────
// PDFKit Template Matching Screenshot Exactly
// ─────────────────────────────────────────────
export async function generatePdfKitFallback({ quote = {}, bill = {}, billItems = [], shop = {}, type = '' } = {}) {
  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true })
      const chunks = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      const isQuote = type === 'quote' || (!bill?.id && quote?.quote_number)
      const bannerLabel = isQuote ? 'QUOTATION' : 'TAX INVOICE'
      const docId = isQuote ? (quote.quote_number || 'QT-001') : (bill.bill_number || `INV-${String(bill.id || 1).padStart(6, '0')}`)
      const orderId = quote.order_number || bill.order_number || ''
      const sectionTitle1 = isQuote ? '1. QUOTATION DETAILS' : '1. INVOICE DETAILS'
      const docTypeTitle = isQuote ? 'Commercial Quotation' : 'Tax Invoice'

      const companyName = shop.shop_name || shop.name || quote.shop_name || bill.shop_name || (shop.first_name ? `${shop.first_name}'s Store` : 'Store')
      const companyGstin = shop.gstin || quote.shop_gstin || bill.shop_gstin || ''
      const companyPhone = shop.phone || quote.shop_phone || bill.shop_phone || ''
      const companyAddress = shop.address || quote.shop_address || bill.shop_address || ''

      const customerName = quote.customer_name || bill.customer_name || 'Customer'
      const customerCompany = quote.customer_company || bill.customer_company || ''
      const customerPhone = quote.customer_phone || bill.customer_phone || ''
      const customerAddress = quote.customer_address || bill.customer_address || ''

      const items = parseItems(billItems.length ? billItems : (bill.items || quote.line_items || []))
      
      const issueDate = fmtDate(quote.issue_date || bill.created_at || quote.created_at || new Date())
      const validUntilDate = fmtDate(quote.valid_until || new Date(Date.now() + 30 * 86400000))

      const {
        grossSubtotal,
        totalDiscount,
        taxableSubtotal,
        totalAmount,
        halfRate,
        cgst,
        sgst
      } = calculatePdfKitAmounts(items, quote, bill)

      const W = 535
      const X = 30
      let curY = 30

      // ── Outer Page Card Border ──
      doc.roundedRect(X, curY, W, 782, 8).strokeColor('#cbd5e1').lineWidth(1).stroke()

      // ── Banner Header (Blue Gradient Style) ──
      doc.save()
      doc.roundedRect(X + 1, curY + 1, W - 2, 80, 7).fill('#2563eb')
      
      // Banner Content - Left
      doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(companyName, X + 18, curY + 16)
      doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica')
      const metaLine1 = [companyPhone && `Phone: ${companyPhone}`, companyGstin && `GSTIN: ${companyGstin.toUpperCase()}`].filter(Boolean).join('  ·  ')
      if (metaLine1) {
        doc.text(metaLine1, X + 18, curY + 38, { opacity: 0.9 })
      }
      if (companyAddress) {
        doc.fontSize(7.5).text(companyAddress, X + 18, curY + 52, { width: 280, opacity: 0.85 })
      }

      // Banner Content - Right
      doc.fontSize(9.5).fillColor('#ffffff').font('Helvetica-Bold').text(bannerLabel, X + W - 180, curY + 14, { width: 162, align: 'right', opacity: 0.85 })
      doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(docId, X + W - 180, curY + 28, { width: 162, align: 'right' })
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica')
      doc.text(`Date: ${issueDate}`, X + W - 180, curY + 50, { width: 162, align: 'right', opacity: 0.9 })
      if (isQuote) {
        doc.text(`Valid Until: ${validUntilDate}`, X + W - 180, curY + 62, { width: 162, align: 'right', opacity: 0.9 })
      }
      doc.restore()

      curY += 92

      // ── Section 1: Details ──
      doc.fontSize(8.5).fillColor('#475569').font('Helvetica-Bold').text(sectionTitle1, X + 14, curY)
      curY += 14

      doc.roundedRect(X + 14, curY, W - 28, 48, 4).fillAndStroke('#f8fafc', '#e2e8f0')
      const colW4 = (W - 28) / 4

      // Col 1: Doc No
      doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text(isQuote ? 'QUOTATION NO' : 'INVOICE NO', X + 22, curY + 10)
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(docId, X + 22, curY + 22)

      // Col 2: Order No / Type
      if (orderId) {
        doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text('ORDER NO', X + 22 + colW4, curY + 10)
        doc.fontSize(9).fillColor('#2563eb').font('Helvetica-Bold').text(orderId, X + 22 + colW4, curY + 22)
      } else {
        doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text('DOCUMENT TYPE', X + 22 + colW4, curY + 10)
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(docTypeTitle, X + 22 + colW4, curY + 22)
      }

      // Col 3: Generated Date
      doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text('GENERATED DATE', X + 22 + colW4 * 2, curY + 10)
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(issueDate, X + 22 + colW4 * 2, curY + 22)

      // Col 4: Valid Until / GSTIN
      if (isQuote) {
        doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text('VALID UNTIL', X + 22 + colW4 * 3, curY + 10)
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(validUntilDate, X + 22 + colW4 * 3, curY + 22)
      } else {
        doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold').text('DOCUMENT TYPE', X + 22 + colW4 * 3, curY + 10)
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(docTypeTitle, X + 22 + colW4 * 3, curY + 22)
      }

      curY += 60

      // ── Section 2: Address Details ──
      doc.fontSize(8.5).fillColor('#475569').font('Helvetica-Bold').text('2. ADDRESS DETAILS', X + 14, curY)
      curY += 14

      const cardW = (W - 38) / 2
      const cardH = 76

      // Card 1: FROM (SUPPLIER)
      doc.roundedRect(X + 14, curY, cardW, cardH, 4).fillAndStroke('#ffffff', '#cbd5e1')
      doc.fontSize(7.5).fillColor('#475569').font('Helvetica-Bold').text('FROM (SUPPLIER)', X + 24, curY + 8)
      doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(X + 24, curY + 20).lineTo(X + 14 + cardW - 10, curY + 20).stroke()
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(companyName, X + 24, curY + 26)
      doc.fontSize(8).fillColor('#475569').font('Helvetica')
      let fromY = curY + 40
      if (companyGstin) {
        doc.text(`GSTIN: ${companyGstin.toUpperCase()}`, X + 24, fromY)
        fromY += 12
      }
      if (companyPhone) {
        doc.text(`Phone: ${companyPhone}`, X + 24, fromY)
      }

      // Card 2: TO (BUYER)
      doc.roundedRect(X + 24 + cardW, curY, cardW, cardH, 4).fillAndStroke('#ffffff', '#cbd5e1')
      doc.fontSize(7.5).fillColor('#475569').font('Helvetica-Bold').text('TO (BUYER)', X + 34 + cardW, curY + 8)
      doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(X + 34 + cardW, curY + 20).lineTo(X + 24 + cardW * 2 - 10, curY + 20).stroke()
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(customerName, X + 34 + cardW, curY + 26)
      doc.fontSize(8).fillColor('#475569').font('Helvetica')
      let toY = curY + 40
      if (customerCompany) {
        doc.text(customerCompany, X + 34 + cardW, toY)
        toY += 12
      }
      if (customerPhone) {
        doc.text(`Phone: ${customerPhone}`, X + 34 + cardW, toY)
      } else if (customerAddress) {
        doc.text(customerAddress, X + 34 + cardW, toY, { width: cardW - 20 })
      }

      curY += cardH + 16

      // ── Section 3: Goods Details ──
      doc.fontSize(8.5).fillColor('#475569').font('Helvetica-Bold').text('3. GOODS DETAILS', X + 14, curY)
      curY += 14

      const tableX = X + 14
      const tableW = W - 28
      const colG = { hsn: tableX + 8, name: tableX + 72, qty: tableX + 205, gross: tableX + 270, disc: tableX + 348, tax: tableX + 418 }
      const colGW = { hsn: 60, name: 130, qty: 60, gross: 75, disc: 66, tax: 84 }

      // Table Header Row
      doc.rect(tableX, curY, tableW, 28).fill('#f8fafc')
      doc.strokeColor('#cbd5e1').lineWidth(0.75).rect(tableX, curY, tableW, 28).stroke()
      doc.fontSize(7).fillColor('#475569').font('Helvetica-Bold')
      doc.text('HSN CODE', colG.hsn, curY + 10)
      doc.text('PRODUCT NAME & DESC.', colG.name, curY + 10)
      doc.text('QUANTITY', colG.qty, curY + 10, { width: colGW.qty, align: 'center' })
      doc.text('GROSS SUBTOTAL', colG.gross, curY + 10, { width: colGW.gross, align: 'right' })
      doc.text('DISCOUNT', colG.disc, curY + 10, { width: colGW.disc, align: 'right' })
      doc.text('TAX RATE (C+S+I)', colG.tax, curY + 10, { width: colGW.tax, align: 'right' })

      curY += 28

      // Table Item Rows
      items.forEach((it, idx) => {
        const rowH = 34
        doc.rect(tableX, curY, tableW, rowH).fill('#ffffff')
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(tableX, curY, tableW, rowH).stroke()

        const name = it.product_name || it.name || `Item ${idx + 1}`
        const hsn = it.hsn_code || '70534921'
        const unit = it.unit || 'Bag'
        const qty = Number.parseFloat(it.quantity || 1)
        const rate = Number.parseFloat(it.price || it.rate || 0)
        const gross = qty * rate
        const disc = getExplicitLineDiscount(it)
        const packSubtext = it.subtext || (it.bag_weight ? `${it.bag_weight}kg ${unit}` : '')

        doc.fontSize(7.5).fillColor('#334155').font('Helvetica').text(hsn, colG.hsn, curY + 12)
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold').text(name, colG.name, curY + 8)
        if (packSubtext) {
          doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(packSubtext, colG.name, curY + 20)
        }

        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold').text(`${qty} ${unit}`, colG.qty, curY + 12, { width: colGW.qty, align: 'center' })
        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold').text(INR(gross), colG.gross, curY + 12, { width: colGW.gross, align: 'right' })
        
        if (disc > 0) {
          doc.fontSize(8).fillColor('#dc2626').font('Helvetica-Bold').text(`-${INR(disc)}`, colG.disc, curY + 12, { width: colGW.disc, align: 'right' })
        } else {
          doc.fontSize(8).fillColor('#64748b').font('Helvetica').text('—', colG.disc, curY + 12, { width: colGW.disc, align: 'right' })
        }

        doc.fontSize(7).fillColor('#475569').font('Helvetica').text(`CGST (${halfRate}%) + SGST (${halfRate}%)`, colG.tax, curY + 12, { width: colGW.tax, align: 'right' })

        curY += rowH
      })

      curY += 8

      // ── 6-Box Summary Grid Row ──
      const sumBoxCount = totalDiscount > 0 ? 6 : 5
      const sumBoxW = tableW / sumBoxCount
      const sumBoxH = 38

      doc.rect(tableX, curY, tableW, sumBoxH).fill('#f8fafc')
      doc.strokeColor('#cbd5e1').lineWidth(0.75).rect(tableX, curY, tableW, sumBoxH).stroke()

      let bX = tableX

      // Box 1: Gross Subtotal
      doc.fontSize(6.5).fillColor('#64748b').font('Helvetica-Bold').text('GROSS SUBTOTAL', bX, curY + 7, { width: sumBoxW, align: 'center' })
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(INR(grossSubtotal), bX, curY + 20, { width: sumBoxW, align: 'center' })
      bX += sumBoxW
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(bX, curY).lineTo(bX, curY + sumBoxH).stroke()

      // Box 2: Total Discount (if discount > 0)
      if (totalDiscount > 0) {
        doc.rect(bX, curY, sumBoxW, sumBoxH).fill('#fef2f2')
        doc.fontSize(6.5).fillColor('#991b1b').font('Helvetica-Bold').text('TOTAL DISCOUNT', bX, curY + 7, { width: sumBoxW, align: 'center' })
        doc.fontSize(9).fillColor('#dc2626').font('Helvetica-Bold').text(`- ${INR(totalDiscount)}`, bX, curY + 20, { width: sumBoxW, align: 'center' })
        bX += sumBoxW
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(bX, curY).lineTo(bX, curY + sumBoxH).stroke()
      }

      // Box 3: Taxable Subtotal
      doc.fontSize(6.5).fillColor('#64748b').font('Helvetica-Bold').text("TOT. TAX'BLE AMT", bX, curY + 7, { width: sumBoxW, align: 'center' })
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(INR(taxableSubtotal), bX, curY + 20, { width: sumBoxW, align: 'center' })
      bX += sumBoxW
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(bX, curY).lineTo(bX, curY + sumBoxH).stroke()

      // Box 4: CGST
      doc.fontSize(6.5).fillColor('#64748b').font('Helvetica-Bold').text('CGST AMT', bX, curY + 7, { width: sumBoxW, align: 'center' })
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(INR(cgst), bX, curY + 20, { width: sumBoxW, align: 'center' })
      bX += sumBoxW
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(bX, curY).lineTo(bX, curY + sumBoxH).stroke()

      // Box 5: SGST
      doc.fontSize(6.5).fillColor('#64748b').font('Helvetica-Bold').text('SGST AMT', bX, curY + 7, { width: sumBoxW, align: 'center' })
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(INR(sgst), bX, curY + 20, { width: sumBoxW, align: 'center' })
      bX += sumBoxW
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(bX, curY).lineTo(bX, curY + sumBoxH).stroke()

      // Box 6: Final Total Box (Solid Dark Navy)
      doc.rect(bX, curY, sumBoxW, sumBoxH).fill('#0f172a')
      doc.fontSize(6.5).fillColor('#94a3b8').font('Helvetica-Bold').text(isQuote ? 'TOTAL QUOTE.AMT' : 'TOTAL INVOICE AMT', bX, curY + 7, { width: sumBoxW, align: 'center' })
      doc.fontSize(9.5).fillColor('#ffffff').font('Helvetica-Bold').text(INR(totalAmount), bX, curY + 20, { width: sumBoxW, align: 'center' })

      curY += sumBoxH + 18

      // ── Centered Barcode ──
      const barcodeX = X + (W - 160) / 2
      const barcodePart = String(docId).replace(/\D/g, '') || '793358'
      
      doc.rect(barcodeX, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 4, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 11, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 16, curY, 5, 22).fill('#000000')
      doc.rect(barcodeX + 24, curY, 1, 22).fill('#000000')
      doc.rect(barcodeX + 28, curY, 3, 22).fill('#000000')
      doc.rect(barcodeX + 34, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 41, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 46, curY, 5, 22).fill('#000000')
      doc.rect(barcodeX + 54, curY, 1, 22).fill('#000000')
      doc.rect(barcodeX + 58, curY, 3, 22).fill('#000000')
      doc.rect(barcodeX + 64, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 71, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 76, curY, 5, 22).fill('#000000')
      doc.rect(barcodeX + 84, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 89, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 96, curY, 1, 22).fill('#000000')
      doc.rect(barcodeX + 100, curY, 5, 22).fill('#000000')
      doc.rect(barcodeX + 108, curY, 3, 22).fill('#000000')
      doc.rect(barcodeX + 114, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 119, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 126, curY, 2, 22).fill('#000000')
      doc.rect(barcodeX + 131, curY, 5, 22).fill('#000000')
      doc.rect(barcodeX + 139, curY, 1, 22).fill('#000000')
      doc.rect(barcodeX + 143, curY, 3, 22).fill('#000000')
      doc.rect(barcodeX + 149, curY, 4, 22).fill('#000000')
      doc.rect(barcodeX + 156, curY, 2, 22).fill('#000000')

      doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(barcodePart, barcodeX, curY + 25, { width: 160, align: 'center' })

      // ── Footer Line ──
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(tableX, curY + 40).lineTo(tableX + tableW, curY + 40).stroke()
      doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica').text(`Official ${docTypeTitle} generated by Workshop · ${issueDate}`, tableX, curY + 48, { width: tableW, align: 'center' })

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
export async function generateInvoicePdfBuffer({ quote = {}, bill = {}, billItems = [], shop = {}, type = '', preferFast = false } = {}) {
  // If explicitly requested, running in Serverless (Vercel / Lambda), or fast workflow path, use instant PDFKit generator (15ms)
  if (preferFast || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return generatePdfKitFallback({ quote, bill, billItems, shop, type })
  }

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
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 3500 })
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