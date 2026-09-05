function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeUnitRaw(rawUnit) {
  let uRaw = String(rawUnit || '').trim()
  if (uRaw.includes(':') || uRaw.includes('₹') || uRaw.includes('/')) {
    const lower = uRaw.toLowerCase()
    if (lower.includes('/ltr') || lower.includes('ltr')) return 'ltrs'
    if (lower.includes('/kg') || lower.includes('kg')) return 'kgs'
    if (lower.includes('/mtr') || lower.includes('mtr')) return 'mtrs'
    return uRaw.split(':')[0].trim()
  }
  return uRaw
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

function resolveWeightUnit(u, qty, bw, isQuoteFlow) {
  if (['bag', 'bags'].includes(u) || (isQuoteFlow && ['kgs', 'kg', 'kilogram', 'kilograms'].includes(u))) {
    return { displayQty: qty, displayUnit: 'Bag', subtext: bw > 1 ? `${bw}kg Bag` : 'Bag' }
  }
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) {
    return { displayQty: qty, displayUnit: 'kgs', subtext: bw > 1 ? `${bw}kg Bag` : 'kgs' }
  }
  return null
}

function resolvePackDisplay(rawUnit, qty, bagWeight, isQuoteFlow = false) {
  const bw = Number.parseFloat(bagWeight || 1)
  const uRaw = normalizeUnitRaw(rawUnit)
  const u = uRaw.toLowerCase().trim()

  return resolveBoxUnit(u, qty, bw) ||
    resolveCountUnit(u, qty) ||
    resolveLengthUnit(u, qty, bw) ||
    resolveVolumeUnit(u, qty, bw) ||
    resolveWeightUnit(u, qty, bw, isQuoteFlow) ||
    { displayQty: qty, displayUnit: uRaw || u || 'unit', subtext: uRaw || u || 'unit' }
}

function getExplicitLineDiscount(it) {
  const explicit = Number.parseFloat(it.discount ?? it.discount_amount ?? it.discountAmount ?? it.disc ?? Number.NaN)
  if (!Number.isNaN(explicit) && explicit >= 0) return explicit
  const qty = Number.parseFloat(it.quantity || it.qty || 1)
  const rate = Number.parseFloat(it.price || it.rate || 0)
  const lineGross = qty * rate
  const lineAmt = Number.parseFloat(it.amount ?? it.line_total ?? Number.NaN)
  if (!Number.isNaN(lineAmt) && lineGross > lineAmt + 0.01) {
    return Math.round((lineGross - lineAmt) * 100) / 100
  }
  return 0
}

function computeInvoiceTax({ grossSubtotalVal, totalDiscountVal, totalAmount, bill, quote }) {
  const netTaxableVal = Math.max(1, grossSubtotalVal - totalDiscountVal)
  const explicitTaxAmtVal = Number.parseFloat(bill?.tax_amount || quote?.tax_amount || 0)
  const inferredTaxVal = (totalAmount > netTaxableVal + 0.01) ? (totalAmount - netTaxableVal) : 0
  const realTaxAmt = explicitTaxAmtVal > 0 ? explicitTaxAmtVal : inferredTaxVal

  let effectiveRate = 0
  if (realTaxAmt > 0 && netTaxableVal > 0) {
    effectiveRate = Math.round((realTaxAmt / netTaxableVal) * 100)
  }
  const halfRate = effectiveRate > 0 ? (effectiveRate / 2).toFixed(2).replace(/\.00$/, '') : '9'

  return { netTaxableVal, realTaxAmt, halfRate }
}

export const getInvoiceEmailTemplate = ({ quote, bill, billItems = [], shop = {}, catalogMap = {} }) => {
  const sellerName = shop.shop_name || quote?.shop_name || bill?.shop_name || (shop.first_name ? `${shop.first_name}'s Store` : 'Store')
  const sellerPhone = shop.phone || bill?.shop_phone || ''
  const sellerGstin = shop.gstin || bill?.shop_gstin || ''
  const sellerAddress = shop.address || bill?.shop_address || ''

  const customerName = quote?.customer_name || bill?.customer_name || ''
  const customerGstin = quote?.customer_gstin || bill?.customer_gstin || ''
  const customerAddress = quote?.customer_address || bill?.customer_address || ''
  const customerPhone = quote?.customer_phone || bill?.customer_phone || ''
  const customerCompany = quote?.customer_company || bill?.customer_company || ''

  const invNum = bill?.bill_number || quote?.quote_number || `INV-${Math.floor(100000 + Math.abs(Math.sin(bill?.id || 1) * 899999))}`
  const orderNum = bill?.order_number || quote?.order_number || ''
  const totalAmount = Number.parseFloat(bill?.amount || bill?.total_amount || quote?.total_amount || 0)
  const taxAmt = Number.parseFloat(quote?.tax_amount || 0)

  const isQuoteFlow = Boolean(quote && (quote.quote_number || quote.id || !bill))

  const items = (billItems && billItems.length > 0) ? billItems : (quote?.line_items || [])
  let itemsList = []
  if (Array.isArray(items)) {
    itemsList = items
  } else if (typeof items === 'string') {
    try { itemsList = JSON.parse(items) } catch { }
  }

  const totalDiscountVal = Number.parseFloat(bill?.discount || bill?.discount_amount || quote?.discount || 0)
  const grossSubtotalVal = itemsList.reduce((s, it) => s + (Number.parseFloat(it.price || it.rate || 0) * Number.parseFloat(it.quantity || it.qty || 1)), 0)

  const { realTaxAmt, halfRate } = computeInvoiceTax({
    grossSubtotalVal,
    totalDiscountVal,
    totalAmount,
    bill,
    quote
  })

  const billDisc = !Number.isNaN(Number.parseFloat(bill?.discount)) ? Number.parseFloat(bill.discount) : 0
  const quoteDisc = !Number.isNaN(Number.parseFloat(quote?.discount)) ? Number.parseFloat(quote.discount) : 0
  const grossTotal = grossSubtotalVal
  const diffDisc = grossTotal > totalAmount ? (grossTotal - totalAmount) : 0
  const lineDiscountsVal = itemsList.reduce((s, it) => s + getExplicitLineDiscount(it), 0)

  const rowsHtml = itemsList.length > 0 ? itemsList.map(item => {
    const qty = Number.parseFloat(item.quantity || item.qty || 1)
    const rate = Number.parseFloat(item.price || item.rate || 0)
    const itemDisc = getExplicitLineDiscount(item)
    const lineTotalGross = rate * qty
    const prodName = item.product_name || item.name || item.productName || 'Product Item'
    
    const catMap = catalogMap || {}
    const catProd = (item.product_id && catMap[String(item.product_id)])
      || (item.id && catMap[String(item.id)])
      || (prodName && catMap[prodName.toLowerCase().trim()])
    const bw = Number.parseFloat(item.bag_weight ?? item.bagWeight ?? item.pack_weight ?? item.packWeight ?? catProd?.bag_weight ?? 1)

    const rawUnit = item.unit || item.unitLabel || ''
    const { displayQty, displayUnit, subtext } = resolvePackDisplay(rawUnit, qty, bw, isQuoteFlow)

    const rawHsn = item.hsn_code || item.hsn || item.sku || ''
    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
      ? `1006${String(item.product_id || item.id || 1001).padStart(4, '0')}`
      : rawHsn

    return `
      <tr>
        <td style="padding:10px 12px; font-size:11px; font-family:monospace; color:#475569; border:1px solid #cbd5e1;">${escapeHtml(hsnCode)}</td>
        <td style="padding:10px 12px; font-size:12.5px; border:1px solid #cbd5e1;">
          <div style="font-weight:700; color:#0f172a;">${escapeHtml(prodName)}</div>
          ${subtext ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(subtext)}</div>` : ''}
        </td>
        <td align="center" style="padding:10px 12px; font-size:12px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:center;">
          <div>${escapeHtml(displayQty ? `${displayQty} ${displayUnit}` : displayUnit)}</div>
        </td>
        <td align="right" style="padding:10px 12px; font-size:12.5px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:right;">₹${lineTotalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td align="right" style="padding:10px 12px; font-size:12px; font-weight:700; color:${itemDisc > 0.01 ? '#dc2626' : '#64748b'}; border:1px solid #cbd5e1; text-align:right;">
          ${itemDisc > 0.01 ? `-₹${itemDisc.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
        </td>
        <td align="right" style="padding:10px 12px; font-size:11.5px; color:#475569; border:1px solid #cbd5e1; text-align:right;">${realTaxAmt > 0 ? `CGST (${halfRate}%) + SGST (${halfRate}%)` : '0.00% + 0.00%'}</td>
      </tr>
    `
  }).join('') : `
    <tr>
      <td colspan="6" align="center" style="padding:20px; text-align:center; color:#94a3b8; border:1px solid #cbd5e1;">No line items found</td>
    </tr>
  `

  const discountAmt = Math.max(lineDiscountsVal, billDisc, quoteDisc, diffDisc)
  const subtotal = grossTotal > 0 ? grossTotal : (totalAmount + discountAmt - realTaxAmt)

  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const dateStr = bill?.created_at
    ? new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const dueDateObj = bill?.due_date ? new Date(bill.due_date) : new Date(Date.now() + 15 * 86400000)
  const dueDateStr = dueDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const docLabel = isQuoteFlow ? 'QUOTATION' : 'TAX INVOICE'
  const docNoLabel = isQuoteFlow ? 'QUOTATION NO' : 'INVOICE NO'

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(docLabel)} #${escapeHtml(invNum)}</title>
    <style>
      body { margin: 0; padding: 20px 10px; background: #f1f5f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; text-align: left; }
      .invoice-card { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; text-align: left; }
      .header-banner { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3d68f5 100%); padding: 28px 32px; color: #ffffff; }
      .sec-title { font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      .details-grid { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 20px; }
      .details-grid td { padding: 10px 14px; border-right: 1px solid #e2e8f0; vertical-align: top; }
      .lbl { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
      .val { font-size: 12.5px; font-weight: 700; color: #0f172a; }
      .val-blue { font-size: 12.5px; font-weight: 800; color: #2563eb; font-family: monospace; }
      .address-box { width: 49%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; background: #ffffff; vertical-align: top; }
      .goods-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 16px; }
      .goods-table th { background: #f8fafc; padding: 10px 12px; font-size: 10.5px; font-weight: 800; color: #475569; border: 1px solid #cbd5e1; text-transform: uppercase; }
      .goods-table td { padding: 10px 12px; font-size: 12px; border: 1px solid #cbd5e1; vertical-align: middle; }
      .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background: #f8fafc; margin-bottom: 20px; text-align: center; }
      .summary-table td { padding: 10px 8px; border-right: 1px solid #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="invoice-card">
      <!-- ── TOP BLUE GRADIENT BANNER ── -->
      <div class="header-banner">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left" valign="top">
              <div style="font-size:24px; font-weight:800; color:#ffffff; margin-bottom:4px; letter-spacing:-0.03em;">${escapeHtml(sellerName)}</div>
              <div style="font-size:12px; color:rgba(255,255,255,0.85); line-height:1.5;">
                Official Supplier & Goods Provider<br />
                ${sellerPhone ? `Phone: ${escapeHtml(sellerPhone)} ` : ''} ${sellerGstin ? `· GSTIN: ${escapeHtml(sellerGstin).toUpperCase()}` : ''}
              </div>
            </td>
            <td align="right" valign="top" style="text-align:right;">
              <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.7); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:2px;">${escapeHtml(docLabel)}</div>
              <div style="font-size:28px; font-weight:900; color:#ffffff; line-height:1.1; margin-bottom:6px;">${escapeHtml(invNum)}</div>
              <div style="font-size:12px; color:rgba(255,255,255,0.85); line-height:1.6;">
                Date: <strong>${escapeHtml(dateStr)}</strong><br />
                ${isQuoteFlow ? 'Valid Until' : 'Due'}: <strong>${escapeHtml(dueDateStr)}</strong>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- ── DOCUMENT BODY ── -->
      <div style="padding:28px 32px;">

        <!-- 1. DETAILS -->
        <div class="sec-title">1. ${escapeHtml(docLabel)} DETAILS</div>
        <table class="details-grid">
          <tr>
            <td width="${orderNum ? '25%' : '33%'}">
              <div class="lbl">${escapeHtml(docNoLabel)}</div>
              <div class="val">${escapeHtml(invNum)}</div>
            </td>
            ${orderNum ? `
            <td width="25%">
              <div class="lbl">ORDER NO</div>
              <div class="val-blue">${escapeHtml(orderNum)}</div>
            </td>
            ` : ''}
            <td width="${orderNum ? '25%' : '33%'}">
              <div class="lbl">GENERATED DATE</div>
              <div class="val">${escapeHtml(dateStr)}</div>
            </td>
            <td width="${orderNum ? '25%' : '34%'}" style="border-right:none;">
              <div class="lbl">${isQuoteFlow ? 'VALID UNTIL' : 'COMPANY GSTIN'}</div>
              <div class="val">${isQuoteFlow ? escapeHtml(dueDateStr) : escapeHtml(sellerGstin || '—').toUpperCase()}</div>
            </td>
          </tr>
        </table>

        <!-- 2. ADDRESS DETAILS -->
        <div class="sec-title">2. ADDRESS DETAILS</div>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px; border-collapse:collapse;">
          <tr>
            <td class="address-box">
              <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:8px;">FROM (SUPPLIER)</div>
              <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(sellerName)}</div>
              ${sellerGstin ? `<div style="font-size:12px; color:#475569;">GSTIN: ${escapeHtml(sellerGstin).toUpperCase()}</div>` : ''}
              ${sellerAddress ? `<div style="font-size:12px; color:#475569; margin-top:2px;">${escapeHtml(sellerAddress)}</div>` : ''}
              ${sellerPhone ? `<div style="font-size:12px; color:#475569; margin-top:2px;">Phone: ${escapeHtml(sellerPhone)}</div>` : ''}
            </td>
            <td width="2%">&nbsp;</td>
            <td class="address-box">
              <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:8px;">TO (BUYER)</div>
              <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(customerName || '—')}</div>
              ${customerCompany ? `<div style="font-size:12px; color:#475569;">${escapeHtml(customerCompany)}</div>` : ''}
              ${customerGstin ? `<div style="font-size:12px; color:#475569;">GSTIN: ${escapeHtml(customerGstin).toUpperCase()}</div>` : ''}
              ${customerAddress ? `<div style="font-size:12px; color:#475569; margin-top:2px;">${escapeHtml(customerAddress)}</div>` : ''}
              ${customerPhone ? `<div style="font-size:12px; color:#475569; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</div>` : ''}
            </td>
          </tr>
        </table>

        <!-- 3. GOODS DETAILS -->
        <div class="sec-title">3. GOODS DETAILS</div>
        <table class="goods-table">
          <thead>
            <tr>
              <th style="text-align:left; width:90px;">HSN CODE</th>
              <th style="text-align:left;">PRODUCT NAME & DESC.</th>
              <th style="text-align:center; width:100px;">QUANTITY</th>
              <th style="text-align:right; width:120px;">GROSS SUBTOTAL</th>
              <th style="text-align:right; width:100px;">DISCOUNT</th>
              <th style="text-align:right; width:140px;">TAX RATE (C+S+I)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- ── TOTALS SUMMARY ROW GRID ── -->
        ${(() => {
      const hasTax = taxAmt > 0
      const hasDisc = discountAmt > 0
      let w = '50%'
      if (hasTax && hasDisc) w = '20%'
      else if (hasTax || hasDisc) w = '33.33%'

      return `
          <table class="summary-table" style="table-layout:fixed;">
            <tr>
              <td width="${w}" style="padding:10px 8px;">
                <div style="font-size:9.5px; font-weight:800; color:#64748b; text-transform:uppercase;">TOT. TAX'BLE AMT</div>
                <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </td>
              ${hasTax ? `
              <td width="${w}" style="padding:10px 8px;">
                <div style="font-size:9.5px; font-weight:800; color:#64748b; text-transform:uppercase;">CGST AMT</div>
                <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${cgst.toFixed(2)}</div>
              </td>
              <td width="${w}" style="padding:10px 8px;">
                <div style="font-size:9.5px; font-weight:800; color:#64748b; text-transform:uppercase;">SGST AMT</div>
                <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${sgst.toFixed(2)}</div>
              </td>
              ` : ''}
              ${hasDisc ? `
              <td width="${w}" style="padding:10px 8px; background:#fef2f2;">
                <div style="font-size:9.5px; font-weight:800; color:#991b1b; text-transform:uppercase;">TOTAL DISCOUNT</div>
                <div style="font-size:12.5px; font-weight:800; color:#dc2626; margin-top:2px;">- ₹${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </td>
              ` : ''}
              <td width="${w}" style="padding:10px 8px; background:#0f172a; color:#ffffff; border-right:none;">
                <div style="font-size:9.5px; font-weight:800; color:#94a3b8; text-transform:uppercase;">TOTAL ${isQuoteFlow ? 'QUOTE' : 'INV'}.AMT</div>
                <div style="font-size:13px; font-weight:900; color:#ffffff; margin-top:2px;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </td>
            </tr>
          </table>
          `
    })()}

        <!-- BARCODE -->
        <div style="text-align:center; margin:20px 0 10px;">
          <svg width="220" height="40" viewBox="0 0 220 40">
            <rect x="0" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="5" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="10" y="0" width="4" height="30" fill="#0f172a" />
            <rect x="17" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="21" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="27" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="32" y="0" width="5" height="30" fill="#0f172a" />
            <rect x="40" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="45" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="51" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="55" y="0" width="4" height="30" fill="#0f172a" />
            <rect x="62" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="67" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="73" y="0" width="5" height="30" fill="#0f172a" />
            <rect x="81" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="85" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="91" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="96" y="0" width="4" height="30" fill="#0f172a" />
            <rect x="103" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="107" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="113" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="118" y="0" width="5" height="30" fill="#0f172a" />
            <rect x="126" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="131" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="137" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="141" y="0" width="4" height="30" fill="#0f172a" />
            <rect x="148" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="153" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="159" y="0" width="5" height="30" fill="#0f172a" />
            <rect x="167" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="171" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="177" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="182" y="0" width="4" height="30" fill="#0f172a" />
            <rect x="189" y="0" width="1" height="30" fill="#0f172a" />
            <rect x="193" y="0" width="3" height="30" fill="#0f172a" />
            <rect x="199" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="204" y="0" width="5" height="30" fill="#0f172a" />
            <rect x="212" y="0" width="2" height="30" fill="#0f172a" />
            <rect x="217" y="0" width="3" height="30" fill="#0f172a" />
          </svg>
          <div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:2px;">${escapeHtml(invNum.replace(/\D/g, '') || '112157195020')}</div>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:14px; margin-top:14px; text-align:center; font-size:11px; color:#94a3b8; font-weight:600;">
          Official GST ${isQuoteFlow ? 'Commercial Quotation' : 'Tax Invoice'} generated by <strong style="color:#64748b;">Workshop</strong> · ${escapeHtml(dateStr)}
        </div>
      </div>
    </div>
  </body>
</html>`
}