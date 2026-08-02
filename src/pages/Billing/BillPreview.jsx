import React, { useRef, useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import './BillPreview.css'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

function resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName, isQuoteFlow = false) {
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
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return { displayQty: qty, displayUnit: 'ltrs' }
  }
  if (['ml', 'milliliter', 'milliliters'].includes(u)) {
    return { displayQty: qty, displayUnit: 'ml' }
  }

  // Meters / Feet
  if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
    return { displayQty: qty, displayUnit: 'mtrs' }
  }

  let baseUnitLabel = uRaw || u || 'pcs'
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) baseUnitLabel = 'kgs'

  if (!isQuoteFlow) {
    // Direct Bill Flow: Always show kgs, pcs!
    return { displayQty: qty, displayUnit: baseUnitLabel }
  }

  // Quote / Order Flow: Show Bags, Boxes, Rolls!
  const PACK_NAMES = ['bag', 'bags', 'box', 'boxes', 'pack', 'packs', 'bundle', 'bundles', 'roll', 'rolls', 'dozen']
  const dbU = String(dbUnit || '').trim()

  if (u && PACK_NAMES.includes(u)) {
    const baseName = u.replace(/s$/, '')
    const capitalName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
    return { displayQty: qty, displayUnit: capitalName + (qty !== 1 ? 's' : '') }
  }

  return { displayQty: qty, displayUnit: 'Bags' }
}

export default function BillPreview({ bill, quote, type, shopName, shopGstin, shopPhone, shopAddress, onClose }) {
  const printRef = useRef(null)

  const doc = quote || bill || {}
  const isQuote = type === 'quotation' || Boolean(doc.quote_number) || Boolean(quote)

  const [profile, setProfile] = useState({
    shopName: shopName || doc.shop_name || '',
    shopGstin: shopGstin || doc.shop_gstin || '',
    shopPhone: shopPhone || doc.shop_phone || '',
    shopAddress: shopAddress || doc.shop_address || ''
  })
  const [productsMap, setProductsMap] = useState({})

  useEffect(() => {
    // Dynamically fetch company profile and products from backend DB
    const fetchData = async () => {
      try {
        const token = sessionStorage.getItem('ws_token') || localStorage.getItem('token') || localStorage.getItem('jwt')
        const wsId = sessionStorage.getItem('ws_active_workspace_id') || ''
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        if (wsId) headers['x-workspace-id'] = wsId

        const [resProfile, resProds] = await Promise.all([
          fetch('/api/companies/my-profile', { headers }).catch(() => null),
          fetch('/api/products?limit=500', { headers }).catch(() => null)
        ])

        if (resProfile && resProfile.ok) {
          const jsonProf = await resProfile.json()
          if (jsonProf.data) {
            setProfile(prev => ({
              shopName: jsonProf.data.name || jsonProf.data.shop_name || prev.shopName,
              shopGstin: jsonProf.data.gstin || prev.shopGstin,
              shopPhone: jsonProf.data.phone || prev.shopPhone,
              shopAddress: jsonProf.data.address || prev.shopAddress
            }))
          }
        }

        if (resProds && resProds.ok) {
          const jsonProds = await resProds.json()
          const prods = jsonProds.data || []
          const pMap = {}
          prods.forEach(p => {
            if (p.id) pMap[String(p.id)] = p
            if (p.name) pMap[p.name.toLowerCase().trim()] = p
          })
          setProductsMap(pMap)
        }
      } catch (_e) { }
    }

    fetchData()
  }, [])

  if (!bill && !quote) return null

  let items = []
  try {
    const rawItems = doc.line_items || doc.items || []
    items = typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || [])
  } catch { items = [] }

  const grossSubtotal = items.reduce((s, li) => {
    const q = parseFloat(li.qty || li.quantity || 1)
    const p = parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)

  const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
  const subtotal = Math.max(0, grossSubtotal - lineDiscounts)
  const explicitDiscount = parseFloat(doc.discount || doc.discount_amount || quote?.discount || bill?.discount || 0)
  const totalAmount = parseFloat(doc.amount || doc.total_amount || (subtotal > 0 ? subtotal : grossSubtotal))

  const rawTaxRate = doc.tax_rate ?? doc.taxRate ?? quote?.tax_rate ?? bill?.tax_rate
  const explicitTaxRate = (rawTaxRate !== undefined && rawTaxRate !== null && !isNaN(parseFloat(rawTaxRate)))
    ? parseFloat(rawTaxRate)
    : null
  const baseForTax = Math.max(0, subtotal - explicitDiscount)
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

  const grossTotalWithTax = subtotal + taxAmt
  const diffDiscount = (grossTotalWithTax > 0 && totalAmount > 0 && grossTotalWithTax > totalAmount + 0.01)
    ? (grossTotalWithTax - totalAmount)
    : 0
  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)

  const docId = isQuote
    ? (doc.quote_number || `QT-${doc.id || '649067'}`)
    : (doc.bill_number || `INV-${Math.floor(100000 + Math.abs(Math.sin(doc.id || 1) * 899999))}`)
  const orderId = doc.order_number || quote?.order_number || bill?.order_number || ''

  const bannerLabel = isQuote ? 'QUOTATION' : 'TAX INVOICE'
  const sectionTitle1 = isQuote ? '1. QUOTATION DETAILS' : '1. INVOICE DETAILS'
  const docTypeTitle = isQuote ? 'Commercial Quotation' : 'Tax Invoice'

  // Company details dynamically retrieved from DB for all companies
  const companyName = profile.shopName || shopName || doc.shop_name || localStorage.getItem('company_name') || 'Capabel'
  const companyGstin = profile.shopGstin || shopGstin || doc.shop_gstin || localStorage.getItem('company_gstin') || ''
  const companyPhone = profile.shopPhone || shopPhone || doc.shop_phone || ''
  const companyAddress = profile.shopAddress || shopAddress || doc.shop_address || ''

  // Customer details
  const customerName = doc.customer_name || ''
  const customerGstin = doc.customer_gstin || ''
  const customerAddress = doc.customer_address || (doc.customer_city ? `${doc.customer_city}${doc.customer_state ? `, ${doc.customer_state}` : ''}` : '')
  const customerPhone = doc.customer_phone || ''
  const customerCompany = doc.customer_company || ''

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=850,height=950')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${docId}</title>
    <style>
      @page { margin: 0; }
      *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
      body{font-family:'Inter','Segoe UI',Arial,sans-serif;background:#fff;color:#0f172a;padding:20px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .bill-preview-page{max-width:800px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden}
      .bill-banner{background:#1e3a8a!important;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%)!important;padding:36px 44px 32px;display:flex;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden;color:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .bill-banner::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,0.12)!important;border-radius:50%;pointer-events:none;-webkit-print-color-adjust:exact!important;display:block!important}
      .bill-banner::after{content:'';position:absolute;bottom:-60px;right:60px;width:130px;height:130px;background:rgba(255,255,255,0.08)!important;border-radius:50%;pointer-events:none;-webkit-print-color-adjust:exact!important;display:block!important}
      .bill-banner-left{position:relative;z-index:1}
      .bill-banner-right{text-align:right;position:relative;z-index:1}
      .bill-company-name{font-size:24px;font-weight:800;color:#fff!important;margin-bottom:6px;letter-spacing:-0.03em}
      .bill-company-meta{font-size:12.5px;color:rgba(255,255,255,0.85)!important;line-height:1.6}
      .bill-inv-label{font-size:11px;font-weight:800;color:rgba(255,255,255,0.75)!important;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px}
      .bill-inv-number{font-size:30px;font-weight:900;color:#fff!important;line-height:1.1;margin-bottom:8px}
      .bill-inv-meta{font-size:12px;color:rgba(255,255,255,0.9)!important;line-height:1.7}
      .status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;-webkit-print-color-adjust:exact!important}
      .status-paid{background:rgba(220,252,231,0.95)!important;color:#15803d!important}
      .bill-body{padding:28px 40px}
      .section-title{font-size:12px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
      .eway-meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#f8fafc!important;border:1px solid #cbd5e1;border-radius:6px;padding:12px 16px;font-size:12px;margin-bottom:16px;-webkit-print-color-adjust:exact!important}
      .eway-meta-item label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:2px}
      .eway-meta-item span{font-weight:700;color:#0f172a}
      .address-parties-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
      .address-card{border:1px solid #cbd5e1;border-radius:6px;padding:14px;background:#fff}
      .address-card-header{font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:8px}
      .address-card-name{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px}
      .address-card-text{font-size:12px;color:#475569;line-height:1.6}
      .bill-items-table{width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #cbd5e1}
      .bill-items-table th{background:#f8fafc!important;padding:8px 10px;font-size:10px;font-weight:800;color:#475569;border:1px solid #cbd5e1;text-align:left;-webkit-print-color-adjust:exact!important}
      .bill-items-table td{padding:7px 10px;font-size:11px;border:1px solid #cbd5e1;color:#0f172a}
      .totals-summary-grid{display:grid;grid-template-columns:repeat(8,1fr);border:1px solid #cbd5e1;background:#f8fafc!important;margin-bottom:20px;text-align:center;-webkit-print-color-adjust:exact!important}
      .summary-cell{padding:8px 4px;border-right:1px solid #cbd5e1}
      .summary-cell:last-child{border-right:none}
      .summary-cell label{font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;display:block}
      .summary-cell span{font-size:11.5px;font-weight:800;color:#0f172a;display:block;margin-top:2px}
      .barcode-wrapper{text-align:center;margin:20px 0 10px}
      .bill-footer{border-top:1px solid #e2e8f0;padding-top:14px;text-align:center;font-size:11px;color:#94a3b8}
      @media print{
        @page { margin: 0; }
        body{padding:15px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        .bill-preview-page{border:none}
        .bill-banner{background:#1e3a8a!important;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3d68f5 100%)!important;color:#ffffff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        .totals-summary-grid .summary-cell:last-child{background:#0f172a!important;color:#ffffff!important;-webkit-print-color-adjust:exact!important}
      }
    </style></head><body><div className="bill-preview-page">${content}</div></body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>

        {/* Top Controls Bar */}
        <div className="bp-toolbar">
          <div className="bp-toolbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{bannerLabel} Preview</span>
            <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}>{docId}</span>
          </div>
          <div className="bp-toolbar-actions">
            <button className="bp-btn" onClick={handlePrint}>
              <Printer size={15} /> Print / Save PDF
            </button>
            <button className="bp-close" onClick={onClose} title="Close Preview">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="bp-scroll">
          <div className="bill-preview-page" ref={printRef}>

            {/* Top Blue Header Banner with Decorative Design Bubbles (Matching Image Shape) */}
            <div className="bill-banner">
              <div className="bill-banner-left">
                <div className="bill-company-name">{companyName}</div>
                <div className="bill-company-meta">
                  {companyAddress && <>{companyAddress}<br /></>}
                  {companyPhone && <>Phone: {companyPhone} </>}
                  {companyGstin && <>{companyPhone ? '· ' : ''}GSTIN: {companyGstin.toUpperCase()}</>}
                  {isQuote && !companyGstin && <>Official Supplier & Goods Provider</>}
                </div>
              </div>
              <div className="bill-banner-right">
                <div className="bill-inv-label">{bannerLabel}</div>
                <div className="bill-inv-number">{docId}</div>
                <div className="bill-inv-meta">
                  Date: <strong>{fmtDate(doc.issue_date || doc.created_at)}</strong><br />
                  {isQuote ? (
                    <>Valid Until: <strong>{fmtDate(doc.valid_until || doc.due_date)}</strong><br /></>
                  ) : (
                    doc.due_date && <>Due: <strong>{fmtDate(doc.due_date)}</strong><br /></>
                  )}
                </div>
              </div>
            </div>

            {/* Document Body */}
            <div className="bill-body">

              {/* 1. Details Grid */}
              <div className="section-title">{sectionTitle1}</div>
              <div className="eway-meta-grid">
                <div className="eway-meta-item"><label>{isQuote ? 'Quotation No' : 'Invoice No'}</label><span>{docId}</span></div>
                {orderId && <div className="eway-meta-item"><label>Order No</label><span style={{ color: '#2563eb', fontWeight: 800 }}>{orderId}</span></div>}
                <div className="eway-meta-item"><label>Generated Date</label><span>{fmtDate(doc.issue_date || doc.created_at)}</span></div>
                {isQuote ? (
                  <div className="eway-meta-item"><label>Valid Until</label><span>{fmtDate(doc.valid_until || doc.due_date)}</span></div>
                ) : (
                  companyGstin && <div className="eway-meta-item"><label>Company GSTIN</label><span>{companyGstin.toUpperCase()}</span></div>
                )}
                <div className="eway-meta-item"><label>Document Type</label><span>{docTypeTitle}</span></div>
              </div>

              {/* 2. Address Details (From & To Boxes) */}
              <div className="section-title">2. ADDRESS DETAILS</div>
              <div className="address-parties-grid">

                {/* FROM BOX */}
                <div className="address-card">
                  <div className="address-card-header">FROM (SUPPLIER)</div>
                  <div className="address-card-name">{companyName}</div>
                  <div className="address-card-text">
                    {companyGstin && <div><strong>GSTIN:</strong> {companyGstin.toUpperCase()}</div>}
                    {companyAddress && <div style={{ marginTop: 4 }}><strong style={{ color: '#0f172a' }}>:: Dispatch From ::</strong><br />{companyAddress}</div>}
                    {companyPhone && <div style={{ marginTop: 4 }}>Phone: {companyPhone}</div>}
                    {!companyGstin && !companyAddress && <div style={{ color: '#64748b' }}>Official Registered Supplier</div>}
                  </div>
                </div>

                {/* TO BOX */}
                <div className="address-card">
                  <div className="address-card-header">TO (BUYER)</div>
                  <div className="address-card-name">{customerName || '—'}</div>
                  <div className="address-card-text">
                    {customerGstin && <div><strong>GSTIN:</strong> {customerGstin.toUpperCase()}</div>}
                    {customerCompany && <div style={{ marginTop: 2 }}>{customerCompany}</div>}
                    {customerAddress && <div style={{ marginTop: 4 }}><strong style={{ color: '#0f172a' }}>:: Ship To ::</strong><br />{customerAddress}</div>}
                    {customerPhone && <div style={{ marginTop: 4 }}>Phone: {customerPhone}</div>}
                  </div>
                </div>

              </div>

              {/* 3. Goods Details Table */}
              <div className="section-title">3. GOODS DETAILS</div>
              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>HSN CODE</th>
                    <th>PRODUCT NAME & DESC.</th>
                    <th style={{ width: 100, textAlign: 'center' }}>QUANTITY</th>
                    <th style={{ width: 120, textAlign: 'center' }}>TAXABLE AMOUNT</th>
                    <th style={{ width: 100, textAlign: 'center' }}>DISCOUNT</th>
                    <th style={{ width: 140, textAlign: 'center' }}>TAX RATE (C+S+I)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? items.map((li, i) => {
                    const qty = parseFloat(li.qty || li.quantity || 1)
                    const price = parseFloat(li.price || li.rate || 0)
                    const lineTotal = Math.max(0, (price * qty) - parseFloat(li.discount || 0))
                    const pId = li.product_id || li.productId || li.id
                    const prodNameRaw = (typeof li === 'string' && li.trim())
                      ? li
                      : (li.name || li.product_name || li.productName || li.product || li.item_name || li.title || li.description || '')

                    const dbProd = pId
                      ? productsMap[String(pId)]
                      : Object.values(productsMap).find(p => p.name && prodNameRaw && p.name.toLowerCase().trim() === prodNameRaw.toLowerCase().trim())

                    const prodName = prodNameRaw || dbProd?.name || 'Product Item'
                    const unitRaw = li.unit || li.unitLabel || (dbProd?.unit || '')
                    const bagWeight = parseFloat(li.bag_weight || dbProd?.bag_weight || 1)
                    const isQuoteFlow = (type === 'quote' || Boolean(quote))
                    const { displayQty, displayUnit } = resolvePackDisplay(unitRaw, qty, bagWeight, dbProd?.unit, prodName, isQuoteFlow)
                    const rawHsn = li.hsn_code || li.hsn || li.sku || dbProd?.hsn_code || dbProd?.sku || ''
                    const hsnCode = (!rawHsn || rawHsn === '—' || rawHsn === '-')
                      ? `1006${String(pId || (i + 1001)).padStart(4, '0')}`
                      : rawHsn

                    const explicitDisc = parseFloat(li.discount || 0)
                    const lineTotalGross = price * qty
                    const itemDisc = explicitDisc > 0
                      ? explicitDisc
                      : (totalDiscount > 0
                        ? (items.length === 1
                          ? totalDiscount
                          : Math.round(((lineTotalGross / (grossSubtotal || 1)) * totalDiscount) * 100) / 100
                        )
                        : 0)

                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: '#475569', fontSize: 10, fontFamily: 'monospace' }}>{hsnCode}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 11 }}>{prodName}</div>
                          {displayUnit && <div style={{ fontSize: 10, color: '#64748b' }}>{displayUnit}</div>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 11 }}>{displayQty} {displayUnit}</td>
                        <td className="text-right" style={{ fontWeight: 700, fontSize: 11 }}>{INR(lineTotal)}</td>
                        <td className="text-right" style={{ fontSize: 11, fontWeight: 700, color: itemDisc > 0.01 ? '#dc2626' : '#64748b' }}>
                          {itemDisc > 0.01 ? `-${INR(itemDisc)}` : '-'}
                        </td>
                        <td className="text-right" style={{ fontSize: 10, color: '#475569' }}>
                          {taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : `0.00% + 0.00%`}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No line items found</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals Summary Row Box */}
              <div className="totals-summary-grid">
                <div className="summary-cell">
                  <label>Tot. Tax'ble Amt</label>
                  <span>{INR(subtotal)}</span>
                </div>
                {taxAmt > 0 && (
                  <>
                    <div className="summary-cell">
                      <label>CGST Amt</label>
                      <span>{INR(cgst)}</span>
                    </div>
                    <div className="summary-cell">
                      <label>SGST Amt</label>
                      <span>{INR(sgst)}</span>
                    </div>
                  </>
                )}
                {totalDiscount > 0 && (
                  <div className="summary-cell" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <label style={{ color: '#991b1b' }}>Total Discount</label>
                    <span style={{ color: '#dc2626', fontWeight: 800 }}>- {INR(totalDiscount)}</span>
                  </div>
                )}
                <div className="summary-cell" style={{ background: '#0f172a', color: '#fff' }}>
                  <label style={{ color: '#94a3b8' }}>{isQuote ? 'Total Quote.Amt' : 'Total Inv.Amt'}</label>
                  <span style={{ color: '#ffffff', fontSize: 13 }}>{INR(totalAmount)}</span>
                </div>
              </div>

              {/* Barcode Graphic */}
              <div className="barcode-wrapper">
                <svg width="220" height="40" viewBox="0 0 220 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" width="3" height="30" fill="black" />
                  <rect x="5" width="1" height="30" fill="black" />
                  <rect x="8" width="4" height="30" fill="black" />
                  <rect x="15" width="2" height="30" fill="black" />
                  <rect x="20" width="5" height="30" fill="black" />
                  <rect x="28" width="1" height="30" fill="black" />
                  <rect x="32" width="3" height="30" fill="black" />
                  <rect x="38" width="2" height="30" fill="black" />
                  <rect x="44" width="4" height="30" fill="black" />
                  <rect x="50" width="1" height="30" fill="black" />
                  <rect x="54" width="5" height="30" fill="black" />
                  <rect x="62" width="2" height="30" fill="black" />
                  <rect x="68" width="3" height="30" fill="black" />
                  <rect x="74" width="1" height="30" fill="black" />
                  <rect x="78" width="4" height="30" fill="black" />
                  <rect x="85" width="2" height="30" fill="black" />
                  <rect x="90" width="5" height="30" fill="black" />
                  <rect x="98" width="1" height="30" fill="black" />
                  <rect x="102" width="3" height="30" fill="black" />
                  <rect x="108" width="2" height="30" fill="black" />
                  <rect x="114" width="4" height="30" fill="black" />
                  <rect x="120" width="1" height="30" fill="black" />
                  <rect x="124" width="5" height="30" fill="black" />
                  <rect x="132" width="2" height="30" fill="black" />
                  <rect x="138" width="3" height="30" fill="black" />
                  <rect x="144" width="1" height="30" fill="black" />
                  <rect x="148" width="4" height="30" fill="black" />
                  <rect x="155" width="2" height="30" fill="black" />
                  <rect x="160" width="5" height="30" fill="black" />
                  <rect x="168" width="1" height="30" fill="black" />
                  <rect x="172" width="3" height="30" fill="black" />
                  <rect x="178" width="2" height="30" fill="black" />
                  <rect x="184" width="4" height="30" fill="black" />
                  <rect x="190" width="1" height="30" fill="black" />
                  <rect x="194" width="5" height="30" fill="black" />
                  <rect x="202" width="2" height="30" fill="black" />
                  <rect x="208" width="3" height="30" fill="black" />
                  <rect x="214" width="2" height="30" fill="black" />
                  <text x="110" y="38" fontSize="9" textAnchor="middle" fill="#475569" fontFamily="monospace">{String(docId).replace(/\D/g, '') || '112157195020'}</text>
                </svg>
              </div>

              {/* Disclaimer Footer */}
              <div className="bill-footer">
                Official {docTypeTitle} generated by <strong>Workshop</strong> · {fmtDate(new Date())}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
