import puppeteer from 'puppeteer'
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

// Maps base UOM strings to their pack/container name for display
function resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName, isQuote = false) {
  const bw = parseFloat(bagWeight || 1)
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

  const u = (uRaw || String(dbUnit || '')).toLowerCase().trim()

  // Liquids (ltrs, ltr, litres, ml) ALWAYS show ltrs/ml (NEVER Drums!)
  if (['litres','litre','ltr','ltrs','liter','liters','l'].includes(u)) {
    return { displayQty: qty, displayUnit: 'ltrs' }
  }
  if (['ml','milliliter','milliliters'].includes(u)) {
    return { displayQty: qty, displayUnit: 'ml' }
  }

  // Meters / Feet
  if (['meters','meter','mtr','mtrs','m'].includes(u)) {
    return { displayQty: qty, displayUnit: 'mtrs' }
  }

  let baseUnitLabel = uRaw || u || 'pcs'
  if (['kgs','kg','kilogram','kilograms'].includes(u)) baseUnitLabel = 'kgs'

  if (!isQuote) {
    // Direct Bill Flow: Always show kgs, pcs!
    return { displayQty: qty, displayUnit: baseUnitLabel }
  }

  // Quote / Order Flow: Show Bags, Boxes, Rolls!
  const PACK_NAMES = ['bag','bags','box','boxes','pack','packs','bundle','bundles','roll','rolls','dozen']
  const dbU = String(dbUnit || '').trim()

  if (u && PACK_NAMES.includes(u)) {
    const baseName = u.replace(/s$/, '')
    const capitalName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
    return { displayQty: qty, displayUnit: capitalName + (qty !== 1 ? 's' : '') }
  }

  if (dbU && PACK_NAMES.includes(dbU.toLowerCase())) {
    const baseName = dbU.toLowerCase().replace(/s$/, '')
    const capitalName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
    return { displayQty: qty, displayUnit: capitalName + (qty !== 1 ? 's' : '') }
  }

  return { displayQty: qty, displayUnit: 'Bags' }
}

// ─────────────────────────────────────────────
// HTML Builder  (mirrors BillPreview.jsx exactly)
// ─────────────────────────────────────────────
function buildInvoiceHtml({ quote = {}, bill = {}, billItems = [], shop = {}, catalogMap = {} } = {}) {
  const isQuote = Boolean(!bill.id || quote.id || quote.quote_number || bill.quote_id || bill.order_number || bill.order_id)

  const docId = isQuote
    ? (quote.quote_number || `QT-${quote.id || '649067'}`)
    : (bill.bill_number || (bill.id ? `INV-${String(bill.id).padStart(5, '0')}` : 'INV-10001'))

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
  const customerAddress = quote.customer_address || bill.customer_address ||
    (quote.customer_city ? `${quote.customer_city}${quote.customer_state ? `, ${quote.customer_state}` : ''}` : '')

  const doc = { ...quote, ...bill }
  const items = parseItems(billItems.length ? billItems : (bill.items || quote.line_items || []))

  const grossSubtotal = items.reduce((s, li) => {
    const q = parseFloat(li.qty || li.quantity || 1)
    const p = parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)
  const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
  const taxableSubtotal = Math.max(0, grossSubtotal - lineDiscounts)
  const explicitDiscount = parseFloat(doc.discount || doc.discount_amount || quote?.discount || bill?.discount || 0)
  const totalAmount = parseFloat(doc.amount || doc.total_amount || (taxableSubtotal > 0 ? taxableSubtotal : grossSubtotal))

  const rawTaxRate = doc.tax_rate ?? doc.taxRate ?? quote?.tax_rate ?? bill?.tax_rate
  const explicitTaxRate = (rawTaxRate !== undefined && rawTaxRate !== null && !isNaN(parseFloat(rawTaxRate)))
    ? parseFloat(rawTaxRate)
    : null
  const baseForTax = Math.max(0, taxableSubtotal - explicitDiscount)
  const explicitTaxAmt = parseFloat(doc.tax_amount || doc.taxAmount || quote?.tax_amount || bill?.tax_amount || 0)
  const inferredTax = (totalAmount > baseForTax + 0.01) ? (totalAmount - baseForTax) : 0

  let taxAmt = 0
  if (explicitTaxAmt > 0) {
    taxAmt = explicitTaxAmt
  } else if (inferredTax > 0) {
    taxAmt = inferredTax
  } else if (explicitTaxRate > 0) {
    taxAmt = baseForTax * (explicitTaxRate / 100)
  }

  let effectiveTaxRate = 0
  if (explicitTaxRate === 0) {
    effectiveTaxRate = 0
  } else if (taxAmt > 0 && baseForTax > 0) {
    effectiveTaxRate = Math.round((taxAmt / baseForTax) * 100)
  } else if (explicitTaxRate > 0) {
    effectiveTaxRate = explicitTaxRate
  } else if (taxAmt > 0) {
    effectiveTaxRate = 18
  }

  const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '9'
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const grossTotalWithTax = taxableSubtotal + taxAmt
  const diffDiscount = (grossTotalWithTax > 0 && totalAmount > 0 && grossTotalWithTax > totalAmount + 0.01)
    ? (grossTotalWithTax - totalAmount)
    : 0
  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)

  const issueDate = fmtDate(doc.issue_date || doc.created_at)
  const dueDate = fmtDate(doc.valid_until || doc.due_date)

  // Build table rows
  const rowsHtml = items.length > 0 ? items.map((li, i) => {
    const qty = parseFloat(li.qty || li.quantity || 1)
    const price = parseFloat(li.price || li.rate || 0)
    const disc = parseFloat(li.discount || 0)
    const lineTotalGross = price * qty
    const itemDisc = disc > 0
      ? disc
      : (totalDiscount > 0
          ? (items.length === 1 
              ? totalDiscount 
              : Math.round(((lineTotalGross / (grossSubtotal || 1)) * totalDiscount) * 100) / 100
            )
          : 0)

    const lineTotal = Math.max(0, lineTotalGross - disc)
    const pId = li.product_id || li.productId || li.id
    const prodNameRaw = (typeof li === 'string' && li.trim())
      ? li
      : (li.name || li.product_name || li.productName || li.product || li.item_name || li.title || li.description || '')
    const dbProd = (pId && catalogMap[String(pId)]) || catalogMap[prodNameRaw.toLowerCase().trim()]

    const prodName = prodNameRaw || dbProd?.name || 'Product Item'
    const rawUnit = li.unit || li.unitLabel || dbProd?.unit || ''
    const dbUnit = dbProd?.unit || ''
    const bagWeight = parseFloat(li.bag_weight || dbProd?.bag_weight || 1)
    const { displayQty, displayUnit } = resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName, isQuote)
    const rawHsn = li.hsn_code || li.hsn || li.sku || dbProd?.hsn_code || dbProd?.sku || ''
    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
      ? `1006${String(pId || (i + 1001)).padStart(4, '0')}`
      : rawHsn

    return `<tr>
      <td style="font-weight:600;color:#475569;font-size:10px;font-family:monospace;padding:7px 10px;border:1px solid #cbd5e1">${hsnCode}</td>
      <td style="padding:7px 10px;border:1px solid #cbd5e1">
        <div style="font-weight:700;color:#0f172a;font-size:11px">${prodName}</div>
        ${displayUnit ? `<div style="font-size:10px;color:#64748b">${displayUnit}</div>` : ''}
      </td>
      <td style="text-align:center;font-weight:600;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px">${displayQty} ${displayUnit}</td>
      <td style="text-align:right;font-weight:700;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px">${INR(lineTotal)}</td>
      <td style="text-align:right;font-weight:700;padding:7px 10px;border:1px solid #cbd5e1;font-size:11px;color:${itemDisc > 0.01 ? '#dc2626' : '#64748b'}">
        ${itemDisc > 0.01 ? `-${INR(itemDisc)}` : '-'}
      </td>
      <td style="text-align:right;font-size:10px;color:#475569;padding:7px 10px;border:1px solid #cbd5e1">
        ${taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : '0.00% + 0.00%'}
      </td>
    </tr>`
  }).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No line items found</td></tr>`

  // Totals summary
  const totalsHtml = `
    <div style="display:flex;border:1px solid #cbd5e1;background:#f8fafc;margin-bottom:20px;text-align:center">
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
      ${totalDiscount > 0 ? `
      <div style="flex:1;padding:8px 4px;border-right:1px solid #cbd5e1;background:#fef2f2">
        <div style="font-size:9px;font-weight:800;color:#991b1b;text-transform:uppercase">Total Discount</div>
        <div style="font-size:11.5px;font-weight:800;color:#dc2626;margin-top:2px">- ${INR(totalDiscount)}</div>
      </div>
      ` : ''}
      <div style="flex:1;padding:8px 4px;background:#0f172a">
        <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase">${isQuote ? 'Total Quote.Amt' : 'Total Inv.Amt'}</div>
        <div style="font-size:13px;font-weight:800;color:#ffffff;margin-top:2px">${INR(totalAmount)}</div>
      </div>
    </div>
  `

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
    .bl { position:relative; z-index:1; }
    .br { text-align:right; position:relative; z-index:1; }
    .co-name { font-size:24px; font-weight:800; color:#fff; margin-bottom:6px; letter-spacing:-0.03em; }
    .co-meta  { font-size:12.5px; color:rgba(255,255,255,0.85); line-height:1.6; }
    .inv-lbl  { font-size:11px; font-weight:800; color:rgba(255,255,255,0.75); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:6px; }
    .inv-num  { font-size:30px; font-weight:900; color:#fff; line-height:1.1; margin-bottom:8px; }
    .inv-meta { font-size:12px; color:rgba(255,255,255,0.9); line-height:1.7; }
    .body { padding:28px 40px; }
    .sec { font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:20px 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
    .meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:12px 16px; font-size:12px; margin-bottom:16px; }
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
        ${companyGstin ? (companyPhone ? '· ' : '') + 'GSTIN: ' + companyGstin.toUpperCase() : ''}
        ${!companyGstin ? 'Official Supplier &amp; Goods Provider' : ''}
      </div>
    </div>
    <div class="br">
      <div class="inv-lbl">${bannerLabel}</div>
      <div class="inv-num">${docId}</div>
      <div class="inv-meta">
        Date: <strong>${issueDate}</strong><br/>
        ${isQuote
          ? `Valid Until: <strong>${dueDate}</strong><br/>`
          : (doc.due_date ? `Due: <strong>${fmtDate(doc.due_date)}</strong><br/>` : '')
        }
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
      ${isQuote
        ? `<div><span class="meta-lbl">Valid Until</span><span class="meta-val">${dueDate}</span></div>`
        : (companyGstin ? `<div><span class="meta-lbl">Company GSTIN</span><span class="meta-val">${companyGstin.toUpperCase()}</span></div>` : '')
      }
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
          <th style="width:120px;text-align:right">TAXABLE AMOUNT</th>
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

// ─────────────────────────────────────────────
// Main Export: puppeteer HTML → PDF Buffer
// ─────────────────────────────────────────────
export async function generateInvoicePdfBuffer({ quote = {}, bill = {}, billItems = [], shop = {} } = {}) {
  const catalogMap = await getProductHsnMap().catch(() => ({}))
  const html = buildInvoiceHtml({ quote, bill, billItems, shop, catalogMap })

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    })
    return pdfBuffer
  } finally {
    if (browser) await browser.close()
  }
}

export default generateInvoicePdfBuffer
