import React, { useRef, useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import './BillPreview.css'

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

function resolvePackDisplay(rawUnit, qty, bagWeight, dbUnit, prodName = '', isQuoteFlow = false) {
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

  // In Quotation flow (isQuoteFlow === true) OR explicitly specified Bag unit:
  // Quantity = 10 means 10 Bags (e.g. 10 Bag, subtext "50kg Bag")
  if (isQuoteFlow || isBagUnit) {
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

  // Direct Invoice Flow (isQuoteFlow === false):
  // Quantity = 10 means 10 kgs (loose kgs, no bag subtext)
  let baseUnitLabel = uRaw || u || 'kgs'
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) baseUnitLabel = 'kgs'
  else if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) baseUnitLabel = 'ltrs'
  else if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) baseUnitLabel = 'mtrs'

  return {
    displayQty: qty,
    displayUnit: baseUnitLabel,
    subtext: ''
  }
}

export default function BillPreview({ bill, quote, type, shopName, shopGstin, shopPhone, shopAddress, onClose }) {
  const printRef = useRef(null)

  const doc = bill || quote || {}
  const isQuote = type === 'quotation' || (type !== 'invoice' && !bill && Boolean(quote || doc.quote_number)) || Boolean(doc.quote_number || doc.quote_id)

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
            if (p.name) {
              const clean = p.name.toLowerCase().trim()
              const norm = clean.replace(/[-_]/g, ' ')
              pMap[clean] = p
              pMap[norm] = p
            }
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
  const subtotal = Math.max(0, grossSubtotal - totalDiscount)
  const totalAmount = explicitTotalAmount > 0 ? explicitTotalAmount : (subtotal + taxAmt)

  let effectiveTaxRate = 0
  if (taxAmt > 0 && subtotal > 0) {
    effectiveTaxRate = Math.round((taxAmt / subtotal) * 100)
  } else if (explicitTaxRate > 0) {
    effectiveTaxRate = explicitTaxRate
  }

  const halfTaxRate = effectiveTaxRate > 0 ? (effectiveTaxRate / 2).toFixed(2).replace(/\.00$/, '') : '0'
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2

  let quoteNumFound = quote?.quote_number || bill?.quote_number || doc.quote_number || ''
  if (!quoteNumFound && (doc.quote_id || quote?.quote_id || bill?.quote_id)) {
    const qid = doc.quote_id || quote?.quote_id || bill?.quote_id
    quoteNumFound = String(qid).startsWith('QT-') ? String(qid) : `QT-${qid}`
  }
  if (!quoteNumFound && (doc.notes || quote?.notes || bill?.notes)) {
    const notesStr = String(doc.notes || quote?.notes || bill?.notes || '')
    const match = notesStr.match(/QT-[A-Z0-9]+/i)
    if (match) quoteNumFound = match[0].toUpperCase()
  }
  if (!quoteNumFound && isQuote) {
    if (doc.id) {
      const dStr = String(doc.id)
      quoteNumFound = dStr.startsWith('QT-') ? dStr : `QT-${dStr}`
    } else {
      quoteNumFound = 'QT-820332'
    }
  }

  let invNumFound = bill?.bill_number || doc.bill_number || ''
  if (!invNumFound && (bill?.id || doc.id) && !isQuote) {
    const bId = bill?.id || doc.id
    invNumFound = `INV-${String(bId).padStart(5, '0')}`
  }

  const docId = isQuote
    ? (quoteNumFound || `QT-${doc.id || '820332'}`)
    : (invNumFound || `INV-${Math.floor(100000 + Math.abs(Math.sin(doc.id || 1) * 899999))}`)
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
                    <th style={{ width: 120, textAlign: 'center' }}>GROSS SUBTOTAL</th>
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

                    const normSearch = prodNameRaw ? prodNameRaw.toLowerCase().replace(/[-_]/g, ' ').trim() : ''

                    const dbProd = (pId && productsMap[String(pId)])
                      || (prodNameRaw && productsMap[prodNameRaw.toLowerCase().trim()])
                      || (normSearch && productsMap[normSearch])
                      || Object.values(productsMap).find(p => {
                           if (!p.name) return false
                           const pNorm = p.name.toLowerCase().replace(/[-_]/g, ' ').trim()
                           return pNorm === normSearch || pNorm.includes(normSearch) || normSearch.includes(pNorm)
                         })

                    const prodName = prodNameRaw || dbProd?.name || 'Product Item'
                    const unitRaw = li.unit || li.unitLabel || (dbProd?.unit || '')

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

                    const { displayQty, displayUnit, subtext } = resolvePackDisplay(unitRaw, qty, bagWeight, dbProd?.unit, prodName, isQuote)
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
                          {subtext && <div style={{ fontSize: 10, color: '#64748b' }}>{subtext}</div>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 11 }}>{displayQty} {displayUnit}</td>
                        <td className="text-right" style={{ fontWeight: 700, fontSize: 11 }}>{INR(lineTotalGross)}</td>
                        <td className="text-right" style={{ fontSize: 11, fontWeight: 700, color: itemDisc > 0.01 ? '#dc2626' : '#64748b' }}>
                          {itemDisc > 0.01 ? `-${INR(itemDisc)}` : '-'}
                        </td>
                        <td className="text-right" style={{ fontSize: 10, color: '#475569' }}>
                          {taxAmt > 0 ? `CGST (${halfTaxRate}%) + SGST (${halfTaxRate}%)` : `-`}
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
                {totalDiscount > 0 && (
                  <>
                    <div className="summary-cell">
                      <label>Gross Subtotal</label>
                      <span>{INR(grossSubtotal)}</span>
                    </div>
                    <div className="summary-cell" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                      <label style={{ color: '#991b1b' }}>Total Discount</label>
                      <span style={{ color: '#dc2626', fontWeight: 800 }}>- {INR(totalDiscount)}</span>
                    </div>
                  </>
                )}
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