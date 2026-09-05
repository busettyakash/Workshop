function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getExplicitLineDiscount(li) {
  const explicit = Number.parseFloat(li.discount ?? li.discount_amount ?? li.discountAmount ?? li.disc ?? NaN)
  if (!Number.isNaN(explicit) && explicit >= 0) return explicit
  const qty = Number.parseFloat(li.quantity || li.qty || 1)
  const rate = Number.parseFloat(li.rate || li.price || 0)
  const lineGross = qty * rate
  const lineAmt = Number.parseFloat(li.amount ?? li.line_total ?? NaN)
  if (!Number.isNaN(lineAmt) && lineGross > lineAmt + 0.01) {
    return Math.round((lineGross - lineAmt) * 100) / 100
  }
  return 0
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

function resolvePackDisplay(rawUnit, qty, bagWeight) {
  const bw = Number.parseFloat(bagWeight || 1)
  const uRaw = normalizeUnitRaw(rawUnit)
  const u = uRaw.toLowerCase().trim()

  // 1. Box / Pack / Cartons
  if (['box', 'boxes', 'carton', 'cartons', 'pkt', 'pack', 'packs'].includes(u)) {
    let unitName = 'Pack'
    if (u === 'box' || u === 'boxes') {
      unitName = qty === 1 ? 'Box' : 'Boxes'
    }
    const sub = bw > 1 ? `${bw} pcs/${unitName}` : unitName
    return { displayQty: qty, displayUnit: unitName, subtext: sub }
  }

  // 2. Count / Pieces / Dozen / Set
  if (['pcs', 'pc', 'piece', 'pieces'].includes(u)) {
    return { displayQty: qty, displayUnit: 'pcs', subtext: 'pcs' }
  }
  if (['doz', 'dozen'].includes(u)) {
    return { displayQty: qty, displayUnit: 'doz', subtext: 'Dozen' }
  }
  if (['set', 'sets'].includes(u)) {
    return { displayQty: qty, displayUnit: 'set', subtext: 'Set' }
  }

  // 3. Length / Meters / Feet
  if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
    const sub = bw > 1 ? `${bw}m Roll` : 'mtrs'
    return { displayQty: qty, displayUnit: 'mtrs', subtext: sub }
  }
  if (['ft', 'feet', 'foot'].includes(u)) {
    const sub = bw > 1 ? `${bw}ft Bundle` : 'ft'
    return { displayQty: qty, displayUnit: 'ft', subtext: sub }
  }

  // 4. Volume / Liters / Milliliters
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    const sub = bw > 1 ? `${bw}L Drum` : 'ltrs'
    return { displayQty: qty, displayUnit: 'ltrs', subtext: sub }
  }
  if (['ml', 'milliliter', 'milliliters'].includes(u)) {
    return { displayQty: qty, displayUnit: 'ml', subtext: 'ml' }
  }

  // 5. Weight / Kilograms / Bags
  if (['bag', 'bags', 'kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) {
    const sub = bw > 1 ? `${bw}kg Bag` : 'Bag'
    return { displayQty: qty, displayUnit: 'Bag', subtext: sub }
  }

  return {
    displayQty: qty,
    displayUnit: uRaw || 'unit',
    subtext: uRaw || 'unit'
  }
}

export const getQuoteEmailTemplate = ({ quote, _itemsHtml, acceptUrl, declineUrl, issueDateFmt, validUntilFmt, catalogMap = {} }) => {
  let items = []
  if (Array.isArray(quote.line_items)) {
    items = quote.line_items
  } else if (typeof quote.line_items === 'string') {
    try { items = JSON.parse(quote.line_items) } catch { }
  }

  const grossSubtotal = items.reduce((s, li) => {
    const q = Number.parseFloat(li.quantity || li.qty || 1)
    const p = Number.parseFloat(li.rate || li.price || 0)
    return s + (p * q)
  }, 0)

  const lineDiscounts = items.reduce((s, li) => s + getExplicitLineDiscount(li), 0)
  const subtotal = Math.max(0, grossSubtotal - lineDiscounts)
  const totalAmount = Number.parseFloat(quote.total_amount || grossSubtotal || 0)
  const taxAmt = Number.parseFloat(quote.tax_amount || 0)
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const grossTotalWithTax = subtotal + taxAmt
  const explicitDiscount = Number.parseFloat(quote.discount || quote.discount_amount || 0)
  const diffDiscount = (grossTotalWithTax > 0 && totalAmount > 0 && grossTotalWithTax > totalAmount + 0.01) ? (grossTotalWithTax - totalAmount) : 0
  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)

  const quoteId = quote.quote_number || `QT-${quote.id}`

  const companyName = quote.shop_name || ''
  const customerName = quote.customer_name || ''

  const explicitTaxRate = (quote?.tax_rate !== undefined && quote?.tax_rate !== null && quote?.tax_rate !== '')
    ? Number.parseFloat(quote.tax_rate)
    : null

  let effectiveTaxRate = 0
  if (explicitTaxRate !== null && !Number.isNaN(explicitTaxRate) && explicitTaxRate >= 0) {
    effectiveTaxRate = explicitTaxRate
  } else if (taxAmt > 0 && subtotal > 0) {
    effectiveTaxRate = Math.round((taxAmt / subtotal) * 100)
  }

  const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '0'

  // Generate table rows matching PDF layout
  const rowsHtml = items.length > 0 ? items.map(li => {
    const qty = Number.parseFloat(li.quantity || li.qty || 1)
    const rate = Number.parseFloat(li.rate || li.price || 0)
    const disc = getExplicitLineDiscount(li)
    const lineTotalGross = rate * qty
    let itemDisc = disc
    if (itemDisc === 0 && lineDiscounts === 0 && totalDiscount > 0) {
      itemDisc = items.length === 1
        ? totalDiscount
        : Math.round(((lineTotalGross / (grossSubtotal || 1)) * totalDiscount) * 100) / 100
    }
    const prodName = li.name || li.product_name || li.productName || 'Product Item'
    const catMap = catalogMap || {}
    const catProd = (li.product_id && catMap[String(li.product_id)])
      || (li.id && catMap[String(li.id)])
      || (prodName && catMap[prodName.toLowerCase().trim()])
    const bw = Number.parseFloat(li.bag_weight ?? li.bagWeight ?? li.pack_weight ?? catProd?.bag_weight ?? 1)
    const rawUnit = li.unit || li.unitLabel || ''
    const { displayQty, displayUnit, subtext } = resolvePackDisplay(rawUnit, qty, bw)

    const rawHsn = li.hsn_code || li.hsn || li.sku || ''
    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
      ? `1006${String(li.product_id || li.id || 1001).padStart(4, '0')}`
      : rawHsn

    return `
      <tr>
        <td style="padding:10px 12px; font-size:10.5px; font-weight:600; color:#475569; border:1px solid #cbd5e1; font-family:monospace; line-height:1.4;">${escapeHtml(hsnCode)}</td>
        <td style="padding:10px 12px; font-size:11.5px; border:1px solid #cbd5e1; line-height:1.4;">
          <div style="font-weight:700; color:#0f172a;">${escapeHtml(prodName)}</div>
          ${subtext ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px;">${escapeHtml(subtext)}</div>` : ''}
        </td>
        <td align="center" style="padding:10px 12px; font-size:11.5px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:center; line-height:1.4;">
          ${displayQty ? `${displayQty} ${displayUnit}` : displayUnit}
        </td>
        <td align="right" style="padding:10px 12px; font-size:11.5px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:right; line-height:1.4;">₹${lineTotalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td align="right" style="padding:10px 12px; font-size:11.5px; font-weight:700; color:${itemDisc > 0.01 ? '#dc2626' : '#64748b'}; border:1px solid #cbd5e1; text-align:right; line-height:1.4;">
          ${itemDisc > 0.01 ? `-₹${itemDisc.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
        </td>
        <td align="right" style="padding:10px 12px; font-size:10.5px; color:#475569; border:1px solid #cbd5e1; text-align:right; line-height:1.4;">${taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : '0.00% + 0.00%'}</td>
      </tr>
    `
  }).join('') : `
    <tr>
      <td colspan="6" align="center" style="padding:20px; text-align:center; color:#94a3b8; border:1px solid #cbd5e1;">No line items found</td>
    </tr>
  `

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Quotation #${escapeHtml(quoteId)}</title>
      </head>
      <body style="margin:0; padding:0; background:#f1f5f9; font-family:'Inter','Segoe UI',Arial,sans-serif; color:#0f172a;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:20px 10px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:800px; margin:0 auto; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; text-align:left;">
                
                <!-- ── TOP BLUE BANNER (MATCHING PDF & IMAGE 3/4 DESIGN) ── -->
                <tr>
                  <td style="background-color:#2563eb; background: radial-gradient(circle at 100% 0%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 130px, transparent 131px), radial-gradient(circle at 75% 100%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 80px, transparent 81px), linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%); padding:32px 36px; color:#ffffff; position:relative; overflow:hidden;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="position:relative; z-index:2;">
                      <tr>
                        <td align="left" valign="top">
                          <div style="font-size:24px; font-weight:800; color:#ffffff; margin-bottom:4px; letter-spacing:-0.03em;">${escapeHtml(companyName)}</div>
                          <div style="font-size:12.5px; color:rgba(255,255,255,0.8); line-height:1.5;">
                            Official Supplier & Goods Provider
                          </div>
                        </td>
                        <td align="right" valign="top" style="text-align:right;">
                          <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.7); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:4px;">QUOTATION</div>
                          <div style="font-size:28px; font-weight:900; color:#ffffff; line-height:1.1; margin-bottom:6px;">${escapeHtml(quoteId)}</div>
                          <div style="font-size:12px; color:rgba(255,255,255,0.85); line-height:1.6;">
                            Date: <strong>${escapeHtml(issueDateFmt)}</strong><br />
                            Valid Until: <strong>${escapeHtml(validUntilFmt)}</strong><br />
                            ${quote.status === 'Accepted' ? `
                              <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:800; text-transform:uppercase; background:#dcfce7; color:#15803d; margin-top:4px;">ACCEPTED</span>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ── DOCUMENT BODY ── -->
                <tr>
                  <td style="padding:28px 36px;">

                    <!-- 1. QUOTATION DETAILS -->
                    <div style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">1. QUOTATION DETAILS</div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:20px; border-collapse:collapse;">
                      <tr>
                        <td width="50%" style="padding:10px 14px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">QUOTATION NO</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${escapeHtml(quoteId)}</div>
                        </td>
                        <td width="50%" style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">GENERATED DATE</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${escapeHtml(issueDateFmt)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding:10px 14px; border-right:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">VALID UNTIL</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${escapeHtml(validUntilFmt)}</div>
                        </td>
                        <td width="50%" style="padding:10px 14px;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">DOCUMENT TYPE</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">Commercial Quotation</div>
                        </td>
                      </tr>
                    </table>

                    <!-- 2. ADDRESS DETAILS -->
                    <div style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">2. ADDRESS DETAILS</div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px; border-collapse:collapse;">
                      <tr>
                        <td width="49%" valign="top" style="border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#ffffff;">
                          <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px;">FROM (SUPPLIER)</div>
                          <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(companyName)}</div>
                          <div style="font-size:12px; color:#475569; line-height:1.5;">Official Registered Supplier</div>
                        </td>
                        <td width="2%">&nbsp;</td>
                        <td width="49%" valign="top" style="border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#ffffff;">
                          <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px;">TO (BUYER)</div>
                          <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(customerName)}</div>
                          ${quote.customer_company ? `<div style="font-size:12px; color:#475569;">${escapeHtml(quote.customer_company)}</div>` : ''}
                          ${quote.customer_phone ? `<div style="font-size:12px; color:#475569; margin-top:2px;">Phone: ${escapeHtml(quote.customer_phone)}</div>` : ''}
                        </td>
                      </tr>
                    </table>

                    <!-- 3. GOODS DETAILS TABLE -->
                    <div style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">3. GOODS DETAILS</div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border:1px solid #cbd5e1; margin-bottom:16px;">
                      <thead>
                        <tr style="background:#f8fafc;">
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:left; width:90px;">HSN CODE</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:left;">PRODUCT NAME & DESC.</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:center; width:100px;">QUANTITY</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:right; width:120px;">GROSS SUBTOTAL</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:right; width:100px;">DISCOUNT</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:right; width:140px;">TAX RATE (C+S+I)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>

                    <!-- ── TOTALS SUMMARY ROW GRID (EXACT) ── -->
                    ${(() => {
      const hasTax = taxAmt > 0
      const hasDisc = totalDiscount > 0
      let w = '50%'
      if (hasTax && hasDisc) w = '16.66%'
      else if (hasTax) w = '25%'
      else if (hasDisc) w = '33.33%'

      return `
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #cbd5e1; background:#f8fafc; margin-bottom:24px; text-align:center; border-collapse:collapse; table-layout:fixed;">
                        <tr>
                          ${hasDisc ? `
                          <td width="${w}" style="padding:10px 4px; border-right:1px solid #cbd5e1;">
                            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase; white-space:nowrap; overflow:hidden;">GROSS SUBTOTAL</div>
                            <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px; white-space:nowrap; overflow:hidden;">₹${grossSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </td>
                          <td width="${w}" style="padding:10px 4px; border-right:1px solid #cbd5e1; background:#fef2f2;">
                            <div style="font-size:9px; font-weight:800; color:#991b1b; text-transform:uppercase; white-space:nowrap; overflow:hidden;">TOTAL DISCOUNT</div>
                            <div style="font-size:11.5px; font-weight:800; color:#dc2626; margin-top:2px; white-space:nowrap; overflow:hidden">- ₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </td>
                          ` : ''}
                          <td width="${w}" style="padding:10px 4px; border-right:1px solid #cbd5e1;">
                            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase; white-space:nowrap; overflow:hidden;">TOT. TAX'BLE AMT</div>
                            <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px; white-space:nowrap; overflow:hidden;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </td>
                          ${hasTax ? `
                          <td width="${w}" style="padding:10px 4px; border-right:1px solid #cbd5e1;">
                            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase; white-space:nowrap; overflow:hidden;">CGST AMT</div>
                            <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px; white-space:nowrap; overflow:hidden;">₹${cgst.toFixed(2)}</div>
                          </td>
                          <td width="${w}" style="padding:10px 4px; border-right:1px solid #cbd5e1;">
                            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase; white-space:nowrap; overflow:hidden;">SGST AMT</div>
                            <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px; white-space:nowrap; overflow:hidden;">₹${sgst.toFixed(2)}</div>
                          </td>
                          ` : ''}
                          <td width="${w}" style="padding:10px 4px; background:#0f172a; color:#ffffff;">
                            <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase; white-space:nowrap; overflow:hidden;">TOTAL QUOTE.AMT</div>
                            <div style="font-size:12.5px; font-weight:900; color:#ffffff; margin-top:2px; white-space:nowrap; overflow:hidden;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </td>
                        </tr>
                      </table>
                      `
    })()}

                    <!-- ── INTERACTIVE ACCEPT & REJECT BUTTONS ── -->
                    <div style="text-align:center; padding:16px 0; margin-bottom:20px;">
                      <p style="font-size:13.5px; font-weight:700; color:#0f172a; margin:0 0 14px; text-align:center;">Respond to this quotation with one click:</p>
                      <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                        <tr>
                          <td align="center" style="padding:0 8px;">
                            <a href="${escapeHtml(acceptUrl)}" target="_blank" style="background:#16a34a; color:#ffffff; text-decoration:none; padding:12px 26px; border-radius:6px; font-weight:800; font-size:13.5px; display:inline-block; line-height:20px; box-shadow:0 3px 10px rgba(22,163,74,0.25);">
                              ✓ Accept Quotation
                            </a>
                          </td>
                          <td align="center" style="padding:0 8px;">
                            <a href="${escapeHtml(declineUrl)}" target="_blank" style="background:#dc2626; color:#ffffff; text-decoration:none; padding:12px 26px; border-radius:6px; font-weight:800; font-size:13.5px; display:inline-block; line-height:20px; box-shadow:0 3px 10px rgba(220,38,38,0.25);">
                              ✕ Reject Quotation
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${quote.notes ? `<div style="background:#fafafa; border-left:3px solid #2563eb; border-radius:6px; padding:12px 16px; font-size:12.5px; color:#475467; line-height:1.5; margin-bottom:20px;"><strong style="color:#1e293b;">Notes:</strong> ${escapeHtml(quote.notes)}</div>` : ''}

                    <!-- BARCODE AT BOTTOM (MATCHING IMAGE 2) -->
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
                      <div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:2px;">${escapeHtml(quoteId.replace(/\D/g, '') || '112157195020')}</div>
                    </div>

                    <!-- Disclaimer Footer -->
                    <div style="border-top:1px solid #e2e8f0; padding-top:14px; text-align:center; font-size:11px; color:#94a3b8;">
                      Official Commercial Quotation generated by <strong>Workshop</strong>
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
}
