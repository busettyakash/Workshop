function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const getInvoiceEmailTemplate = ({ quote, bill, billItems = [], shop = {} }) => {
  const sellerName = shop.shop_name || quote?.shop_name || bill?.shop_name || ''
  const sellerPhone = shop.phone || bill?.shop_phone || ''
  const sellerGstin = shop.gstin || bill?.shop_gstin || ''
  const sellerAddress = shop.address || bill?.shop_address || ''

  const customerName = quote?.customer_name || bill?.customer_name || ''
  const customerGstin = quote?.customer_gstin || bill?.customer_gstin || ''
  const customerAddress = quote?.customer_address || bill?.customer_address || ''
  const customerPhone = quote?.customer_phone || bill?.customer_phone || ''
  const customerCompany = quote?.customer_company || bill?.customer_company || ''

  const invNum = bill?.bill_number || `INV-${String(bill?.id || 1).padStart(4, '0')}`
  const totalAmount = parseFloat(bill?.amount || bill?.total_amount || quote?.total_amount || 0)
  const taxAmt = parseFloat(quote?.tax_amount || 0)
  const subtotal = Math.max(0, taxAmt > 0 ? totalAmount - taxAmt : totalAmount)
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  const dateStr = bill?.created_at
    ? new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  
  const dueDateObj = bill?.due_date ? new Date(bill.due_date) : new Date(Date.now() + 15 * 86400000)
  const dueDateStr = dueDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const items = (billItems && billItems.length > 0) ? billItems : (quote?.line_items || [])
  const itemsList = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : [])

  const rowsHtml = itemsList.length > 0 ? itemsList.map(item => {
    const qty = parseFloat(item.quantity || item.qty || 1)
    const rate = parseFloat(item.price || item.rate || 0)
    const disc = parseFloat(item.discount || 0)
    const lineTotal = Math.max(0, (qty * rate) - disc)
    const bw = parseFloat(item.bag_weight || 1)
    const unitStr = (bw > 1) 
      ? `Bag (${bw}kg)` 
      : (item.unitLabel || item.subtext || item.unit || '')
    const rawHsn = item.hsn_code || item.hsn || item.sku || ''
    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-') 
      ? `1006${String(item.product_id || item.id || 1001).padStart(4, '0')}`
      : rawHsn
    const prodName = item.product_name || item.name || item.productName || 'Product Item'

    const qtyMain = unitStr ? `${qty} ${unitStr.split('(')[0].trim()}` : `${qty}`
    const qtySub = unitStr.includes('(') ? `(${unitStr.split('(')[1]}` : ''

    return `
      <tr>
        <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; border:1px solid #cbd5e1; font-family:monospace;">${escapeHtml(hsnCode)}</td>
        <td style="padding:10px 12px; font-size:12.5px; border:1px solid #cbd5e1;">
          <div style="font-weight:700; color:#0f172a;">${escapeHtml(prodName)}</div>
          ${unitStr ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(unitStr)}</div>` : ''}
        </td>
        <td align="center" style="padding:10px 12px; font-size:12px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:center;">
          <div>${escapeHtml(qtyMain)}</div>
          ${qtySub ? `<div style="font-size:11px; color:#475569; font-weight:600; margin-top:1px;">${escapeHtml(qtySub)}</div>` : ''}
        </td>
        <td align="right" style="padding:10px 12px; font-size:12.5px; font-weight:700; color:#0f172a; border:1px solid #cbd5e1; text-align:right;">₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td align="right" style="padding:10px 12px; font-size:11.5px; color:#475569; border:1px solid #cbd5e1; text-align:right;">${taxAmt > 0 ? 'CGST (9%) + SGST (9%)' : '0.00% + 0.00%'}</td>
      </tr>
    `
  }).join('') : `
    <tr>
      <td colspan="5" align="center" style="padding:20px; text-align:center; color:#94a3b8; border:1px solid #cbd5e1;">No line items found</td>
    </tr>
  `

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tax Invoice #${escapeHtml(invNum)}</title>
      </head>
      <body style="margin:0; padding:0; background:#f1f5f9; font-family:'Inter','Segoe UI',Arial,sans-serif; color:#0f172a;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:20px 10px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:800px; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; text-align:left;">
                
                <!-- ── TOP BLUE GRADIENT BANNER (MATCHING IMAGE 1, 2, 3 & 4) ── -->
                <tr>
                  <td style="background-color:#2563eb; background: radial-gradient(circle at 100% 0%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 130px, transparent 131px), radial-gradient(circle at 75% 100%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 80px, transparent 81px), linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%); padding:32px 36px; color:#ffffff; position:relative; overflow:hidden;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="position:relative; z-index:2;">
                      <tr>
                        <td align="left" valign="top">
                          <div style="font-size:24px; font-weight:800; color:#ffffff; margin-bottom:4px; letter-spacing:-0.03em;">${escapeHtml(sellerName)}</div>
                          <div style="font-size:12.5px; color:rgba(255,255,255,0.8); line-height:1.5;">
                            ${sellerPhone ? `Phone: ${escapeHtml(sellerPhone)} ` : ''}
                            ${sellerGstin ? `${sellerPhone ? '· ' : ''}GSTIN: ${escapeHtml(sellerGstin).toUpperCase()}` : ''}
                          </div>
                        </td>
                        <td align="right" valign="top" style="text-align:right;">
                          <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.7); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:4px;">TAX INVOICE</div>
                          <div style="font-size:28px; font-weight:900; color:#ffffff; line-height:1.1; margin-bottom:6px;">${escapeHtml(invNum)}</div>
                          <div style="font-size:12px; color:rgba(255,255,255,0.85); line-height:1.6;">
                            Date: <strong>${escapeHtml(dateStr)}</strong><br />
                            Due: <strong>${escapeHtml(dueDateStr)}</strong><br />
                            ${bill?.status === 'paid' ? `
                              <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:800; text-transform:uppercase; background:#dcfce7; color:#15803d; margin-top:4px;">PAID</span>
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

                    <!-- 1. INVOICE DETAILS -->
                    <div style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">1. INVOICE DETAILS</div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:20px; border-collapse:collapse;">
                      <tr>
                        <td width="33%" style="padding:10px 14px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">INVOICE NO</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${escapeHtml(invNum)}</div>
                        </td>
                        <td width="33%" style="padding:10px 14px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">GENERATED DATE</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${escapeHtml(dateStr)}</div>
                        </td>
                        <td width="34%" style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">COMPANY GSTIN</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${sellerGstin ? escapeHtml(sellerGstin).toUpperCase() : '—'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="3" style="padding:10px 14px;">
                          <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:2px;">DOCUMENT TYPE</div>
                          <div style="font-size:12.5px; font-weight:700; color:#0f172a;">Tax Invoice</div>
                        </td>
                      </tr>
                    </table>

                    <!-- 2. ADDRESS DETAILS -->
                    <div style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">2. ADDRESS DETAILS</div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px; border-collapse:collapse;">
                      <tr>
                        <td width="49%" valign="top" style="border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#ffffff;">
                          <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px;">FROM (SUPPLIER)</div>
                          <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(sellerName)}</div>
                          ${sellerGstin ? `<div style="font-size:12px; color:#475569;">GSTIN: ${escapeHtml(sellerGstin).toUpperCase()}</div>` : ''}
                          ${sellerPhone ? `<div style="font-size:12px; color:#475569; margin-top:2px;">Phone: ${escapeHtml(sellerPhone)}</div>` : ''}
                        </td>
                        <td width="2%">&nbsp;</td>
                        <td width="49%" valign="top" style="border:1px solid #cbd5e1; border-radius:6px; padding:14px; background:#ffffff;">
                          <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; border-bottom:1px solid #f1f5f9; padding-bottom:6px; margin-bottom:8px;">TO (BUYER)</div>
                          <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(customerName || '—')}</div>
                          ${customerCompany ? `<div style="font-size:12px; color:#475569;">${escapeHtml(customerCompany)}</div>` : ''}
                          ${customerPhone ? `<div style="font-size:12px; color:#475569; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</div>` : ''}
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
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:right; width:130px;">TAXABLE AMOUNT</th>
                          <th style="padding:10px 12px; font-size:11px; font-weight:800; color:#475569; border:1px solid #cbd5e1; text-align:right; width:150px;">TAX RATE (C+S+I)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>

                    <!-- ── TOTALS SUMMARY ROW GRID (EXACT IMAGE 2 MATCH) ── -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #cbd5e1; background:#f8fafc; margin-bottom:24px; text-align:center; border-collapse:collapse;">
                      <tr>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">TOT. TAX'BLE AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">CGST AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${cgst.toFixed(2)}</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">SGST AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹${sgst.toFixed(2)}</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">IGST AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹0.00</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">CESS AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹0.00</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">CESS NON-ADVOL</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹0.00</div>
                        </td>
                        <td style="padding:8px 4px; border-right:1px solid #cbd5e1;">
                          <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">OTHER AMT</div>
                          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">₹0.00</div>
                        </td>
                        <td style="padding:8px 4px; background:#0f172a; color:#ffffff;">
                          <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">TOTAL INV.AMT</div>
                          <div style="font-size:12.5px; font-weight:900; color:#ffffff; margin-top:2px;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                      </tr>
                    </table>

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
                      <div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:2px;">${escapeHtml(invNum.replace(/\D/g, '') || '112157195020')}</div>
                    </div>

                    <!-- Footer Disclaimer -->
                    <div style="border-top:1px solid #e2e8f0; padding-top:14px; text-align:center; font-size:11px; color:#94a3b8;">
                      Official GST Tax Invoice generated by <strong>Workshop</strong>
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
