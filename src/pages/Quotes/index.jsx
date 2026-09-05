import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast, setSidebarOpen } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, X, Trash2, Loader2, Search, Eye, FileText, Calendar, Edit2, ArrowLeft, User, Package, Calculator, CheckCircle2, Send, Receipt, ArrowRight, ChevronDown, ArrowLeftRight } from 'lucide-react'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'
import { getBulkUnitDetails, formatStockDisplay } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'
import TablePagination from '../../components/ui/TablePagination'
import ConfirmModal from '../../components/ui/ConfirmModal'
import BillPreview from '../Billing/BillPreview'
import QuotePreviewModal from './QuotePreviewModal'
import { usePermissions, getFirstAccessibleRoute } from '../../utils/permissionUtils'

function useCloseOnOutsideClick(containerRef, setOpen) {
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [containerRef, setOpen])
}

function SearchableCustomerSelect({ people, value, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Filter ONLY Vendor details for the select vendor/customer dropdown
  const vendorsOnly = people.filter(p => {
    const persona = (p.persona || '').toLowerCase()
    return persona === 'vendor' || !p.persona
  })

  const selectedPerson = people.find(p => String(p.id) === String(value))

  useCloseOnOutsideClick(containerRef, setOpen)

  const filtered = vendorsOnly.filter(p => {
    const q = query.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.company_name && p.company_name.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    )
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(prev => !prev)}
        style={{
          width: '100%', height: 32, padding: '0 8px', borderRadius: 5,
          border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
        }}
      >
        <span style={{
          color: selectedPerson ? '#0f172a' : '#94a3b8', fontWeight: selectedPerson ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 'calc(100% - 20px)'
        }}>
          {selectedPerson
            ? `${selectedPerson.name} ${(selectedPerson.company || selectedPerson.company_name) ? `(${selectedPerson.company || selectedPerson.company_name})` : selectedPerson.phone ? `(${selectedPerson.phone})` : ''}`
            : 'Search vendor from People...'}
        </span>
        <Search size={12} style={{ color: '#64748b', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)', marginTop: 4, maxHeight: 200, overflowY: 'auto', padding: 4
        }}>
          <input
            type="text"
            placeholder="Type vendor name, company, phone or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', height: 30, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem', marginBottom: 4, outline: 'none' }}
            autoFocus
          />
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '0.78rem', color: '#94a3b8' }}>No vendors found</div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                  setQuery('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect(p.id); setOpen(false); setQuery('') } }}
                style={{
                  padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                  {(p.company || p.company_name) && (
                    <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>{p.company || p.company_name}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.phone || p.email || ''}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SearchableProductSelect({ products, value, onSelect, subtext }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedProd = products.find(p => String(p.id) === String(value))

  useCloseOnOutsideClick(containerRef, setOpen)

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(query.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 240 }}>
      {selectedProd && !open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(true)}
            style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Click to change product"
          >
            <span>{selectedProd.name}</span>
          </div>
          {subtext && (
            <span style={{ fontSize: '0.68rem', color: '#0d9488', fontWeight: 600 }}>
              {subtext}
            </span>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(prev => !prev)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(prev => !prev)}
          style={{
            width: '100%', height: 28, padding: '0 8px', borderRadius: 5,
            border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
          }}
        >
          <span style={{ color: selectedProd ? '#0f172a' : '#94a3b8', fontWeight: selectedProd ? 600 : 400, fontSize: '0.75rem' }}>
            {selectedProd ? selectedProd.name : 'Type to search product...'}
          </span>
          <Search size={12} style={{ color: '#64748b' }} />
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: 320, zIndex: 100,
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 220, overflowY: 'auto', padding: 6
        }}>
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', height: 28, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.75rem', marginBottom: 4, outline: 'none' }}
            autoFocus
          />
          {filtered.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: '0.75rem', color: '#94a3b8' }}>No products found</div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                  setQuery('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect(p.id)
                    setOpen(false)
                    setQuery('')
                  }
                }}
                style={{
                  padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Stock: {formatStockDisplay(p.stock, p.bag_weight, p.unit, p.loose_kg)}</span>
                </div>
                <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.78rem', flexShrink: 0 }}>
                  ₹{Number.parseFloat(p.updated_price || p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const calcMaxStock = (prod, itemUnit) => {
  if (!prod || prod.stock === undefined || prod.stock === null) return null
  const stockBags = Number.parseFloat(prod.stock) || 0
  const looseKg = Number.parseFloat(prod.loose_kg) || 0
  const bw = Number.parseFloat(prod.bag_weight) || 1
  const bulkUnit = getBulkUnitDetails(prod.unit)
  const unitStr = String(itemUnit || prod.unit || '').toLowerCase()

  const isBaseUnit = bulkUnit && (
    unitStr === bulkUnit.short?.toLowerCase() ||
    unitStr === 'kgs' || unitStr === 'kg' || unitStr === 'ltr' || unitStr === 'mtr'
  )

  if (isBaseUnit && bw > 1) {
    const maxBase = (stockBags * bw) + looseKg
    return {
      maxStock: maxBase,
      displayLabel: `${maxBase} ${bulkUnit.short || 'kg'} (${stockBags} ${bulkUnit.name || 'Bags'})`
    }
  } else {
    const label = (bulkUnit && bw > 1)
      ? `${bulkUnit.name || 'Bag'} (${bw}${bulkUnit.short || 'kg'})`
      : (prod.unit || 'pcs')
    return {
      maxStock: stockBags,
      displayLabel: looseKg > 0 ? `${stockBags} ${bulkUnit?.name || 'Bags'} ${looseKg} ${bulkUnit?.short || 'kgs'}` : `${stockBags} ${label}`
    }
  }
}

function FullPageQuoteStepper({ quote, onBack, onSaved }) {
  const [currentQuoteId, setCurrentQuoteId] = useState(quote?.id || null)
  const isEdit = Boolean(quote?.id || currentQuoteId)
  const dispatch = useAppDispatch()

  const [step, setStep] = useState(1) // Step 1: Customer, Step 2: Line Items, Step 3: Review & Send

  const [formData, setFormData] = useState({
    quote_number: quote?.quote_number || `QT-${Date.now().toString().slice(-6)}`,
    shop_name: quote?.shop_name || 'Workshop Store',
    customer_company: quote?.customer_company || '',
    person_id: quote?.person_id || '',
    customer_name: quote?.customer_name || '',
    customer_phone: quote?.customer_phone || '',
    customer_email: quote?.customer_email || '',
    total_amount: quote?.total_amount || 0,
    tax_amount: quote?.tax_amount || 0,
    status: quote?.status || 'Draft',
    issue_date: quote?.issue_date ? String(quote.issue_date).split('T')[0] : new Date().toISOString().split('T')[0],
    valid_until: quote?.valid_until ? String(quote.valid_until).split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: quote?.notes || 'Validity: 30 days. Payment terms: Net 15 days.'
  })

  // Line items state
  const [lineItems, setLineItems] = useState(() => {
    if (quote?.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) {
      return quote.line_items
    }
    return [{ id: 1, product_id: '', name: '', quantity: 1, rate: 0, amount: 0 }]
  })

  const [people, setPeople] = useState([])
  const [products, setProducts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    api.get('/people?limit=200')
      .then(res => setPeople(res.data?.data || []))
      .catch(() => { })

    api.get('/products?limit=200')
      .then(res => setProducts(res.data?.data || []))
      .catch(() => { })

    if (!quote?.shop_name || quote.shop_name === 'Workshop Store') {
      api.get('/auth/workspaces')
        .then(res => {
          const workspaces = Array.isArray(res.data) ? res.data : res.data?.workspaces || []
          const ownWs = workspaces.find(w => w.isOwner) || workspaces[0]
          if (ownWs?.shopName) {
            setFormData(prev => ({ ...prev, shop_name: ownWs.shopName }))
          }
        })
        .catch(() => { })
    }
  }, [])

  const [gstRate, setGstRate] = useState(() => {
    if (quote?.tax_rate !== undefined && quote?.tax_rate !== null && !Number.isNaN(Number.parseFloat(quote.tax_rate))) {
      return Number.parseFloat(quote.tax_rate)
    }
    const taxAmt = Number.parseFloat(quote?.tax_amount || 0)
    const subtotal = (quote?.line_items && Array.isArray(quote.line_items))
      ? quote.line_items.reduce((s, it) => s + (Number.parseFloat(it.amount) || 0), 0)
      : 0
    if (taxAmt > 0 && subtotal > 0) {
      return Math.round((taxAmt / subtotal) * 100)
    }
    return 18 // Default 18% GST as requested
  })

  // Calculate totals whenever items or GST rate change
  useEffect(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + (Number.parseFloat(item.amount) || 0), 0)
    let tax = 0
    if (gstRate > 0) {
      tax = subtotal * (gstRate / 100)
    }
    const finalTotal = subtotal + tax
    setFormData(prev => ({
      ...prev,
      tax_rate: gstRate,
      tax_amount: tax.toFixed(2),
      total_amount: finalTotal.toFixed(2)
    }))
  }, [lineItems, gstRate])

  const handlePersonSelect = (personId) => {
    if (!personId) return
    const p = people.find(item => String(item.id) === String(personId))
    if (p) {
      const companyVal = p.company || p.company_name || p.shop_name || ''
      setFormData(prev => ({
        ...prev,
        person_id: p.id,
        customer_name: p.name,
        customer_company: companyVal,
        customer_phone: p.phone || '',
        customer_email: p.email || ''
      }))
    }
  }

  function calcProductPrices(prod) {
    if (!prod) return { perUnitRate: 0, perKgRate: 0, perPackPrice: 0 }

    const bw = Number.parseFloat(prod?.bag_weight) || 1
    const rawP = Number.parseFloat(prod?.price || 0)
    const rawUP = Number.parseFloat(prod?.updated_price || 0)

    // updated_price and price are both stored as 1-bag price (per bag_weight kg)
    // So to get per-kg rate: divide by bag_weight
    let perKgRate = 0
    if (rawUP > 0) {
      perKgRate = rawUP / bw
    } else if (rawP > 0) {
      perKgRate = rawP / bw
    }

    const perPackPrice = perKgRate * bw
    const perUnitRate = perKgRate

    return {
      perUnitRate: Number.parseFloat(perUnitRate.toFixed(2)),
      perKgRate: Number.parseFloat(perKgRate.toFixed(2)),
      perPackPrice: Number.parseFloat(perPackPrice.toFixed(2))
    }
  }

  const handleProductSelect = (index, productId) => {
    const prod = products.find(p => String(p.id) === String(productId))
    if (!prod) return

    const prices = calcProductPrices(prod)
    const bulkUnit = getBulkUnitDetails(prod.unit)
    const bagWeight = Number.parseFloat(prod.bag_weight || 1)

    const isPack = bulkUnit && bagWeight > 1
    const unitLabel = isPack ? (bulkUnit.name || prod.unit || 'Bag') : (prod.unit || 'pcs')
    const itemRate = isPack ? prices.perPackPrice : (prices.perUnitRate > 0 ? prices.perUnitRate : (prod.price || 0))

    let subtext = ''
    if (bulkUnit && bagWeight > 1) {
      subtext = `${bulkUnit.name || 'Pack'}: ₹${prices.perPackPrice.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bagWeight}${bulkUnit.short})`
    } else if (prod.unit) {
      subtext = `${prod.unit}: ₹${(Number.parseFloat(prod.updated_price || prod.price || 0)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    setLineItems(prev => prev.map((item, i) => {
      if (i === index) {
        const stockInfo = calcMaxStock(prod, unitLabel)
        let qty = Number.parseFloat(item.quantity) || 1
        if (stockInfo && stockInfo.maxStock >= 0 && qty > stockInfo.maxStock) {
          qty = stockInfo.maxStock || 1
          dispatch(addToast({
            message: `We have only ${stockInfo.displayLabel} available in stock for ${prod.name}.`,
            type: 'warning'
          }))
        }
        const amt = qty * itemRate
        return {
          ...item,
          product_id: prod.id,
          name: prod.name,
          unit: unitLabel,
          bag_weight: bagWeight,
          subtext: subtext,
          quantity: qty,
          rate: itemRate,
          amount: amt
        }
      }
      return item
    }))
  }

  const handleQtyChange = (index, qty) => {
    const numQty = Number.parseFloat(qty) || 0
    const targetItem = lineItems[index]
    const selectedProd = products.find(p => String(p.id) === String(targetItem?.product_id))
    const stockInfo = calcMaxStock(selectedProd, targetItem?.unit)

    if (stockInfo && stockInfo.maxStock >= 0 && numQty > stockInfo.maxStock) {
      dispatch(addToast({
        message: `We have only ${stockInfo.displayLabel} available in stock for ${selectedProd?.name || 'this product'}.`,
        type: 'warning'
      }))

      setLineItems(prev => prev.map((item, i) => {
        if (i === index) {
          const rate = Number.parseFloat(item.rate) || 0
          const disc = Number.parseFloat(item.discount) || 0
          return { ...item, quantity: stockInfo.maxStock, amount: Math.max(0, (stockInfo.maxStock * rate) - disc) }
        }
        return item
      }))
      return
    }

    setLineItems(prev => prev.map((item, i) => {
      if (i === index) {
        const rate = Number.parseFloat(item.rate) || 0
        const disc = Number.parseFloat(item.discount) || 0
        return { ...item, quantity: qty, amount: Math.max(0, (numQty * rate) - disc) }
      }
      return item
    }))
  }

  const handleDiscountChange = (index, disc) => {
    const numDisc = Number.parseFloat(disc) || 0
    setLineItems(prev => prev.map((item, i) => {
      if (i === index) {
        const qty = Number.parseFloat(item.quantity) || 0
        const rate = Number.parseFloat(item.rate) || 0
        return { ...item, discount: disc, discount_amount: numDisc, amount: Math.max(0, (qty * rate) - numDisc) }
      }
      return item
    }))
  }

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: Date.now(), product_id: '', name: '', quantity: 1, rate: 0, discount: 0, discount_amount: 0, amount: 0 }])
  }

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter((_, i) => i !== index))
    } else {
      setLineItems([{ id: Date.now(), product_id: '', name: '', quantity: 1, rate: 0, discount: 0, discount_amount: 0, amount: 0 }])
      dispatch(addToast({ message: 'Line item cleared', type: 'info' }))
    }
  }

  const saveQuoteAsync = async (overrideStatus = null) => {
    const custName = formData.customer_name?.trim() || 'Draft Customer'
    const newStatus = overrideStatus || formData.status || 'Draft'
    const payload = {
      ...formData,
      customer_name: custName,
      status: newStatus,
      line_items: lineItems.map(it => ({
        ...it,
        discount: Number.parseFloat(it.discount || 0),
        discount_amount: Number.parseFloat(it.discount || 0)
      }))
    }
    const targetId = currentQuoteId || quote?.id
    if (targetId) {
      const res = await api.put(`/quotes/${targetId}`, payload)
      if (res.data?.id) setCurrentQuoteId(res.data.id)
      setFormData(prev => ({ ...prev, status: newStatus }))
      return res.data
    } else {
      const res = await api.post('/quotes', payload)
      if (res.data?.id) setCurrentQuoteId(res.data.id)
      setFormData(prev => ({ ...prev, status: newStatus }))
      return res.data
    }
  }

  const handleSaveDraft = async () => {
    setSubmitting(true)
    try {
      const saved = await saveQuoteAsync('Draft')
      onSaved(saved)
    } catch {
      dispatch(addToast({ message: 'Failed to save quote', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendEmail = async () => {
    if (!formData.customer_name?.trim() || !formData.customer_email?.trim()) {
      dispatch(addToast({ message: 'Please provide customer email in Step 1 to send quotation', type: 'error' }))
      setStep(1)
      return
    }
    setSendingEmail(true)
    try {
      const saved = await saveQuoteAsync('Sent')
      await api.post(`/quotes/${saved.id}/send-email`)
      dispatch(addToast({ message: `Quotation email sent to ${formData.customer_email} with Accept/Reject links!`, type: 'success' }))
      onSaved(saved)
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to send email', type: 'error' }))
    } finally {
      setSendingEmail(false)
    }
  }

  const handleBackToQuotes = async () => {
    const hasData = Boolean(formData.customer_name?.trim() || lineItems.some(it => it.name || it.product_id))
    // Only auto-save as Draft if it has data and hasn't already been sent/accepted
    if (hasData && (!formData.status || formData.status === 'Draft') && !currentQuoteId) {
      try {
        const saved = await saveQuoteAsync('Draft')
        if (onSaved) await onSaved(saved)
        dispatch(addToast({ message: 'Quotation saved as Draft', type: 'info' }))
      } catch (err) {
        console.error(err)
      }
    }
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top Header Bar */}
      <div className="ws-unified-page-header" style={{ margin: '8px 0 0', padding: '6px 4px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingLeft: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            {isEdit ? `Edit Quote (${formData.quote_number})` : 'Create New Quote'}
          </h2>
          <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>
            {formData.status}
          </span>
        </div>

        <div className="ws-unified-header-actions">
          {step === 3 && (
            <button
              type="button"
              className="attio-btn attio-btn-secondary"
              onClick={() => setStep(2)}
              disabled={submitting || sendingEmail}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 10px' }}
            >
              <ArrowLeft size={13} /> Back to Step 2
            </button>
          )}
          <button
            type="button"
            className="attio-btn attio-btn-primary"
            onClick={handleBackToQuotes}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 12px' }}
          >
            <ArrowLeft size={13} /> Back to Quotes
          </button>
        </div>
      </div>

      {/* Stepper Navigation Bar (Increased box sizes by 2%) */}
      <div className="attio-table-card" style={{ padding: '8px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 700, margin: '0 auto', boxSizing: 'border-box', flexWrap: 'nowrap', gap: 10 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStep(1)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStep(1)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
            background: step === 1 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 1 ? '#2563eb' : '#e2e8f0'}`
          }}
        >
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 1 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>1</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 1 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
            Step 1: Customer Details
          </div>
        </div>

        <ArrowRight size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />

        <div
          role="button"
          tabIndex={0}
          onClick={() => setStep(2)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStep(2)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
            background: step === 2 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 2 ? '#2563eb' : '#e2e8f0'}`
          }}
        >
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 2 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>2</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 2 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
            Step 2: Products & Line Items
          </div>
        </div>

        <ArrowRight size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />

        <div
          role="button"
          tabIndex={0}
          onClick={() => setStep(3)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStep(3)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
            background: step === 3 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 3 ? '#2563eb' : '#e2e8f0'}`
          }}
        >
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 3 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>3</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 3 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
            Step 3: Review, Send & Bill
          </div>
        </div>
      </div>

      {/* STEP 1: Customer Details */}
      {step === 1 && (
        <div className="attio-table-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                My Shop / Company Name (Sender) *
              </label>
              <input
                type="text"
                placeholder="Shop / Company Name"
                value={formData.shop_name}
                onChange={(e) => setFormData(p => ({ ...p, shop_name: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                Search & Select Vendor / Customer
              </label>
              <SearchableCustomerSelect
                people={people}
                value={formData.person_id}
                onSelect={handlePersonSelect}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                Customer Shop / Company Name
              </label>
              <input
                type="text"
                placeholder="Customer Shop / Company Name"
                value={formData.customer_company}
                onChange={(e) => setFormData(p => ({ ...p, customer_company: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Customer Name *</label>
              <input
                type="text"
                placeholder="Customer Name"
                value={formData.customer_name}
                onChange={(e) => setFormData(p => ({ ...p, customer_name: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Phone Number</label>
              <input
                type="text"
                placeholder="Phone Number"
                value={formData.customer_phone}
                onChange={(e) => setFormData(p => ({ ...p, customer_phone: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Email Address *</label>
              <input
                type="email"
                placeholder="Email Address"
                value={formData.customer_email}
                onChange={(e) => setFormData(p => ({ ...p, customer_email: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Quote #</label>
              <input
                type="text"
                value={formData.quote_number}
                onChange={(e) => setFormData(p => ({ ...p, quote_number: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Issue Date</label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData(p => ({ ...p, issue_date: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Valid Until</label>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(p => ({ ...p, valid_until: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Quote Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                style={{ width: '100%', height: 32, padding: '0 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#fff' }}
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Declined">Declined</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="button"
              className="attio-btn attio-btn-primary"
              onClick={() => {
                if (!formData.customer_name?.trim()) {
                  dispatch(addToast({ message: 'Please enter customer name', type: 'error' }))
                  return
                }
                setStep(2)
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 6, height: 34
              }}
            >
              Next: Products & Line Items <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Products & Line Items */}
      {step === 2 && (
        <div className="attio-table-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="button"
              className="attio-btn attio-btn-secondary"
              onClick={addLineItem}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', height: 28, padding: '0 10px' }}
            >
              <Plus size={12} /> Add Line Item
            </button>
          </div>

          <table className="attio-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: '0.65rem', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', width: '40%', textTransform: 'uppercase', fontWeight: 700 }}>PRODUCT</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', width: '25%', textTransform: 'uppercase', fontWeight: 700 }}>QTY / UNIT</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', width: '20%', textTransform: 'uppercase', fontWeight: 700 }}>UNIT PRICE</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: '15%', textTransform: 'uppercase', fontWeight: 700 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => {
                const selectedProd = products.find(p => String(p.id) === String(item.product_id))
                const bw = Number.parseFloat(selectedProd?.bag_weight || item.bag_weight || 1)
                const rawUnit = item.unit || selectedProd?.unit || 'pcs'
                const bulkUnit = getBulkUnitDetails(selectedProd?.unit || rawUnit)
                const unitLabel = item.unit || (bw > 1
                  ? `${bulkUnit?.name || 'Bag'} (${bw}${bulkUnit?.short || 'kg'})`
                  : (selectedProd?.unit || rawUnit))

                const maxStock = selectedProd && selectedProd.stock !== undefined && selectedProd.stock !== null ? Number.parseFloat(selectedProd.stock) : null
                const isExceeded = maxStock !== null && maxStock >= 0 && (Number.parseFloat(item.quantity) || 0) > maxStock

                const baseSubtext = item.subtext || (selectedProd && bw > 1 && bulkUnit
                  ? `${bulkUnit.name || 'Bag'}: ₹${(Number.parseFloat(selectedProd.updated_price || selectedProd.price || 0)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })} (${bw}${bulkUnit.short})`
                  : (selectedProd ? `${selectedProd.unit || 'Unit'}: ₹${(Number.parseFloat(selectedProd?.updated_price || selectedProd?.price || 0)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}` : ''))

                const stockSubtext = selectedProd ? `Available Stock: ${formatStockDisplay(selectedProd.stock, selectedProd.bag_weight, selectedProd.unit, selectedProd.loose_kg)}` : ''
                const fullSubtext = [baseSubtext, stockSubtext].filter(Boolean).join(' • ')

                return (
                  <tr key={item.id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                      <SearchableProductSelect
                        products={products}
                        value={item.product_id}
                        onSelect={(prodId) => handleProductSelect(index, prodId)}
                        subtext={fullSubtext}
                      />
                    </td>

                    <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <input
                            type="number"
                            min="1"
                            max={maxStock !== null ? maxStock : undefined}
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(index, e.target.value)}
                            style={{
                              width: 40, height: 26, padding: '0 3px', borderRadius: 4,
                              border: `1px solid ${isExceeded ? '#dc2626' : '#cbd5e1'}`, fontSize: '0.75rem', textAlign: 'center',
                              fontWeight: 600, fontFamily: 'inherit', color: isExceeded ? '#dc2626' : '#0f172a', background: isExceeded ? '#fef2f2' : '#fff'
                            }}
                          />
                          <span style={{
                            fontSize: '0.7rem', color: '#475467', fontWeight: 600,
                            whiteSpace: 'nowrap', userSelect: 'none', background: '#f8fafc',
                            padding: '2px 5px', borderRadius: 4, border: '1px solid #e2e8f0', height: 26, display: 'inline-flex', alignItems: 'center'
                          }}>
                            {unitLabel}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={item.rate ? `₹${(Number.parseFloat(item.rate) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                          style={{
                            width: 85, height: 26, padding: '0 4px', borderRadius: 4,
                            border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700,
                            color: '#334155', textAlign: 'center', fontFamily: 'inherit', background: '#f8fafc',
                            cursor: 'not-allowed'
                          }}
                          title="Price is fixed from catalog"
                        />
                      </div>
                    </td>

                    <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                          ₹{(Number.parseFloat(item.amount) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center' }}
                          title="Remove item"
                          onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 }}>
            <button
              type="button"
              className="attio-btn attio-btn-primary"
              onClick={() => {
                for (const item of lineItems) {
                  const selectedProd = products.find(p => String(p.id) === String(item.product_id))
                  const maxStock = selectedProd && selectedProd.stock !== undefined && selectedProd.stock !== null ? Number.parseFloat(selectedProd.stock) : null
                  const qty = Number.parseFloat(item.quantity) || 0
                  if (maxStock !== null && maxStock >= 0 && qty > maxStock) {
                    const bulkUnit = getBulkUnitDetails(item.unit || selectedProd?.unit)
                    const bw = Number.parseFloat(selectedProd?.bag_weight || item.bag_weight || 1)
                    const unitLabel = (selectedProd && bw > 1)
                      ? `${bulkUnit?.name || 'Bag'} (${bw}${bulkUnit?.short || 'kg'})`
                      : (item.unit || selectedProd?.unit || 'pcs')

                    dispatch(addToast({
                      message: `Cannot proceed: We have only ${maxStock} ${unitLabel} available in stock for ${selectedProd?.name || 'this product'}.`,
                      type: 'error'
                    }))
                    return
                  }
                }
                setStep(3)
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 22px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 6, height: 36, cursor: 'pointer'
              }}
            >
              Next: Review, Send & Bill <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review, Send & Bill */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary Card */}
          <div className="attio-table-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Customer</span>
                <p style={{ margin: '1px 0 0', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{formData.customer_name}</p>
                <p style={{ margin: '1px 0 0', fontSize: '0.75rem', color: '#475467' }}>{formData.customer_phone || 'No phone'} • {formData.customer_email || 'No email'}</p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Quotation Amount</span>
                <p style={{ margin: '1px 0 0', fontWeight: 800, color: '#15803d', fontSize: '1.1rem' }}>
                  ₹{(Number.parseFloat(formData.total_amount) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#64748b' }}>Quote #{formData.quote_number} • Valid till {formData.valid_until}</p>
              </div>
            </div>

            {/* GST Calculation Selection Panel in Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 2, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Tax / GST Selection:</span>
                {[
                  { rate: 18, label: '18% GST' },
                  { rate: 12, label: '12% GST' },
                  { rate: 5, label: '5% GST' },
                  { rate: 0, label: 'Without GST (0%)' }
                ].map(opt => (
                  <label key={opt.rate} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, color: gstRate === opt.rate ? '#15803d' : '#475467' }}>
                    <input
                      type="radio"
                      name="gstRateOption"
                      value={opt.rate}
                      checked={gstRate === opt.rate}
                      onChange={() => setGstRate(opt.rate)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748b' }}>Subtotal: ₹{lineItems.reduce((acc, item) => acc + (Number.parseFloat(item.amount) || 0), 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}</span>
                <span style={{ margin: '0 5px', color: '#cbd5e1' }}>|</span>
                <span style={{ color: gstRate > 0 ? '#15803d' : '#94a3b8', fontWeight: 600 }}>GST ({gstRate}%): ₹{(Number.parseFloat(formData.tax_amount) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}</span>
                <span style={{ margin: '0 5px', color: '#cbd5e1' }}>|</span>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                  Final Total: ₹{(Number.parseFloat(formData.total_amount) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Line Items Summary List */}
            <div>
              <h4 style={{ margin: '0 0 5px', fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Items Breakdown</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                {lineItems.map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', borderBottom: idx < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem' }}>{item.name || 'Selected Item'}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0' }}>Qty: {item.quantity} {item.unit || ''}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>DISCOUNT (₹):</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.discount === 0 ? '' : item.discount}
                          onChange={(e) => handleDiscountChange(idx, e.target.value === '' ? 0 : e.target.value)}
                          style={{
                            width: 65, height: 26, padding: '0 5px', borderRadius: 4,
                            border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600,
                            color: '#0f172a', textAlign: 'center', fontFamily: 'inherit', background: '#fff'
                          }}
                        />
                      </div>

                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', minWidth: 80, textAlign: 'right' }}>
                        ₹{(Number.parseFloat(item.amount) || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms & Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 2 }}>Terms & Conditions / Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
              />
            </div>
          </div>

          {/* Workflow Action Panel */}
          <div className="attio-table-card" style={{ padding: 14, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', fontWeight: 700, color: '#6b21a8' }}>Quotation Workflow & Billing Automation</h4>

            {/* Status Banner — shown after email response */}
            {formData.status === 'Accepted' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: '#dcfce7', border: '1px solid #86efac', color: '#166534' }}>
                <CheckCircle2 size={16} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Customer <strong>Accepted</strong> via email. Invoice auto-generated in Billing. ✅
                </span>
              </div>
            )}
            {formData.status === 'Declined' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' }}>
                <X size={16} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Customer <strong>Declined</strong> this quotation via email.
                </span>
              </div>
            )}
            {formData.status === 'Sent' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                <Send size={15} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Quotation sent to <strong>{formData.customer_email}</strong>. Waiting for customer response…
                </span>
              </div>
            )}

            {formData.status !== 'Accepted' && formData.status !== 'Declined' && (
              <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#7e22ce', lineHeight: 1.5 }}>
                Send this quotation to <strong>{formData.customer_email || 'customer'}</strong> via email. The customer will receive Accept / Reject links. When they <strong>Accept</strong>, the system automatically updates the status and generates a billing invoice — no manual action needed.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Save Draft / Save Quote */}
                <button
                  type="button"
                  className="attio-btn attio-btn-secondary"
                  onClick={handleSaveDraft}
                  disabled={submitting || sendingEmail}
                  title="Save Quote Changes"
                  style={{
                    height: 32, fontSize: '0.78rem', padding: '0 12px', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Draft'}
                </button>

                {/* Send / Resend Email */}
                <button
                  type="button"
                  className="attio-btn"
                  onClick={handleSendEmail}
                  disabled={submitting || sendingEmail}
                  style={{
                    height: 32, fontSize: '0.78rem', padding: '0 14px',
                    background: '#2563eb',
                    color: '#fff',
                    borderColor: '#2563eb',
                    fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
                    cursor: 'pointer'
                  }}
                >
                  {sendingEmail ? <Loader2 size={14} className="ws-chat-loader-spin" /> : <Send size={14} />}
                  {sendingEmail ? 'Sending…' : (isEdit || formData.status === 'Sent' || formData.status === 'Declined' ? 'Resend Quotation to Customer' : 'Save & Send Email')}
                </button>

                {/* Accept & Convert to Bill — disabled: only triggers via customer email link */}
                <div style={{ position: 'relative', display: 'inline-flex' }} title="Billing invoices trigger automatically ONLY when the customer ACCEPTS the quotation. Rejected quotes do not generate bills.">
                  <button
                    type="button"
                    disabled
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '0 12px', height: 32, borderRadius: 5, border: '1px solid #cbd5e1',
                      background: '#f1f5f9', color: '#64748b',
                      fontWeight: 600, fontSize: '0.78rem', cursor: 'not-allowed',
                      opacity: 0.85
                    }}
                  >
                    <Receipt size={13} />
                    {formData.status === 'Accepted' ? 'Auto-Billed on Acceptance ✅' : formData.status === 'Declined' ? 'Quotation Declined (No Bill) ❌' : 'Auto-Billed on Acceptance ⚡'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function parseQuoteLineItems(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function QuoteComparisonModal({ quotes, onClose, onRemoveQuote, onClearAll }) {
  if (!quotes || quotes.length === 0) return null

  const quoteData = quotes.map(q => {
    const items = parseQuoteLineItems(q.line_items)
    const totalAmount = Number.parseFloat(q.total_amount || 0)
    const taxAmount = Number.parseFloat(q.tax_amount || 0)
    const subtotal = totalAmount - taxAmount
    return {
      ...q,
      items,
      totalAmount,
      taxAmount,
      subtotal
    }
  })

  const amounts = quoteData.map(q => q.totalAmount)
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)
  const hasAmountVariance = minAmount !== maxAmount

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card compare-modal-card" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ws-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                <ArrowLeftRight size={18} />
              </div>
              <div>
                <h3 className="ws-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Quotation Comparison
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Comparing {quotes.length} quotation{quotes.length > 1 ? 's' : ''} side-by-side
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {quotes.length > 0 && (
              <button
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Clear all
              </button>
            )}
            <button className="ws-modal-close-x" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="ws-modal-body" style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          {quotes.length < 2 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#475467' }}>
                <ArrowLeftRight size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#1e293b' }}>Select at least 2 quotes</h4>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: 360, marginInline: 'auto' }}>
                Please select at least 2 quotations from the list to compare their pricing, terms, line items, and validity side-by-side.
              </p>
            </div>
          ) : (
            <table className="compare-matrix-table">
              <thead>
                <tr>
                  <th className="attr-col">Quote Details</th>
                  {quoteData.map(q => (
                    <th key={q.id} className="product-col" style={{ background: '#ffffff', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="attio-avatar" style={{ background: getAvatarColor(q.customer_name), width: 26, height: 26, minWidth: 26, fontSize: '0.82rem' }}>
                            {getSingleLetter(q.customer_name)}
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', fontFamily: 'monospace', color: '#0f172a' }}>
                              {q.quote_number || `#${q.id}`}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 600 }}>
                              {q.customer_name}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemoveQuote(q.id)}
                          style={{
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          title="Remove from comparison"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div style={{ marginTop: 8, textAlign: 'left' }}>
                        {(() => {
                          const st = (q.status || 'Draft').toLowerCase()
                          let bg = '#f1f5f9', color = '#475569', border = '#e2e8f0'
                          if (st === 'accepted') { bg = '#dcfce7'; color = '#15803d'; border = '#bbf7d0' }
                          else if (st === 'declined' || st === 'rejected') { bg = '#fee2e2'; color = '#b91c1c'; border = '#fecaca' }
                          else if (st === 'sent' || st === 'pending') { bg = '#eff6ff'; color = '#2563eb'; border = '#bfdbfe' }
                          return (
                            <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 5, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-block' }}>
                              {q.status || 'Draft'}
                            </span>
                          )
                        })()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Total Value */}
                <tr>
                  <td className="attr-cell">Total Amount</td>
                  {quoteData.map(q => {
                    const isLowest = hasAmountVariance && q.totalAmount === minAmount
                    return (
                      <td key={q.id} className="product-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isLowest ? '#15803d' : '#0f172a' }}>
                            ₹{q.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {isLowest && (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                              Lowest Total
                            </span>
                          )}
                        </div>
                        {q.taxAmount > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                            Tax: ₹{q.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {/* Customer Details */}
                <tr>
                  <td className="attr-cell">Customer & Contact</td>
                  {quoteData.map(q => (
                    <td key={q.id} className="product-col">
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>{q.customer_name || '—'}</div>
                      {q.customer_company && <div style={{ fontSize: '0.75rem', color: '#475467' }}>{q.customer_company}</div>}
                      {q.customer_phone && <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 2 }}>📞 {q.customer_phone}</div>}
                      {q.customer_email && <div style={{ fontSize: '0.73rem', color: '#64748b' }}>✉️ {q.customer_email}</div>}
                    </td>
                  ))}
                </tr>

                {/* Timeline */}
                <tr>
                  <td className="attr-cell">Issue & Validity</td>
                  {quoteData.map(q => {
                    const issueStr = q.issue_date ? String(q.issue_date).split('T')[0] : '—'
                    const validStr = q.valid_until ? String(q.valid_until).split('T')[0] : '—'
                    return (
                      <td key={q.id} className="product-col">
                        <div style={{ fontSize: '0.78rem', color: '#1e293b' }}>
                          <span style={{ color: '#64748b' }}>Issued:</span> <strong>{issueStr}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#1e293b', marginTop: 3 }}>
                          <span style={{ color: '#64748b' }}>Valid Till:</span> <strong>{validStr}</strong>
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Converted Order */}
                <tr>
                  <td className="attr-cell">Order Conversion</td>
                  {quoteData.map(q => {
                    const orderNum = (q.status === 'Accepted')
                      ? (q.order_number || `ORD-${q.quote_number ? q.quote_number.replace(/^QT-?/i, '') : q.id}`)
                      : null
                    return (
                      <td key={q.id} className="product-col">
                        {orderNum ? (
                          <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                            {orderNum}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Not Converted</span>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {/* Line Items Overview */}
                <tr>
                  <td className="attr-cell">Line Items</td>
                  {quoteData.map(q => (
                    <td key={q.id} className="product-col">
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a', marginBottom: 6 }}>
                        {q.items.length} item{q.items.length === 1 ? '' : 's'} included
                      </div>
                      {q.items.length === 0 ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No items detailed</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {q.items.map((it, idx) => {
                            const qty = Number.parseFloat(it.quantity ?? it.qty ?? 1)
                            const rate = Number.parseFloat(it.rate ?? it.unit_price ?? it.price ?? 0)
                            const lineTotal = Number.parseFloat(it.amount ?? it.total ?? it.total_price ?? it.line_total ?? (qty * rate)) || 0
                            const unitLabel = it.unit || 'pcs'

                            return (
                              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '6px 10px', fontSize: '0.74rem' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{it.name || it.product_name || `Item ${idx + 1}`}</div>
                                <div style={{ color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                  <span>{qty} {unitLabel} × ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <strong style={{ color: '#0f172a', fontWeight: 700 }}>₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Notes */}
                <tr>
                  <td className="attr-cell">Notes & Terms</td>
                  {quoteData.map(q => (
                    <td key={q.id} className="product-col">
                      <div style={{ fontSize: '0.75rem', color: q.notes ? '#334155' : '#94a3b8', maxHeight: 80, overflowY: 'auto' }}>
                        {q.notes || '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="ws-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Tip: Click the <strong style={{ color: '#0f172a' }}>✕</strong> next to any quote to remove it from comparison.
          </span>
          <button className="ws-modal-btn ws-modal-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Quotes() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const { canRead, canCreate, canEdit, canDelete } = usePermissions('quotes')

  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState(null)
  const [viewingQuote, setViewingQuote] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, number: '' })

  const [selectedQuotes, setSelectedQuotes] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showFilterBar, setShowFilterBar] = useState(false)

  const totalPages = Math.ceil(total / limit) || 1
  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 2) {
        pages.push(1, 2, 3, '...', totalPages)
      } else if (page >= totalPages - 1) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
      }
    }
    return pages
  }

  const fetchQuotes = async (currentPage = page, isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await api.get(`/quotes?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&status=${filterStatus}`)
      setQuotes(res.data?.data || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      console.error(err)
      if (!isBackground) {
        dispatch(addToast({ message: 'Failed to load quotes', type: 'error' }))
      }
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    if (!canRead) {
      navigate(getFirstAccessibleRoute(), { replace: true })
      return
    }
    dispatch(setActiveNav('Quotes'))
    dispatch(setSidebarOpen(true))
    fetchQuotes(page)

    // Poll for quote acceptance/rejection from customer emails (only when tab is visible)
    const pollTimer = setInterval(() => {
      if (!document.hidden) {
        fetchQuotes(page, true)
      }
    }, 15000)

    const handleFocus = () => {
      if (!document.hidden) fetchQuotes(page, true)
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(pollTimer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [dispatch, page, search, filterStatus, canRead])

  const handleUpdateStatus = async (quoteId, newStatus) => {
    // Optimistic UI state update
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q))
    if (viewingQuote && viewingQuote.id === quoteId) {
      setViewingQuote(prev => prev ? { ...prev, status: newStatus } : null)
    }
    try {
      await api.patch(`/quotes/${quoteId}/status`, { status: newStatus })
      dispatch(addToast({ message: `Quote #${quoteId} marked as ${newStatus}`, type: 'success' }))
      fetchQuotes(page, true)
    } catch (err) {
      console.error(err)
      dispatch(addToast({ message: 'Failed to update quote status', type: 'error' }))
      fetchQuotes(page)
    }
  }

  const handleSaveQuote = (_savedQuote) => {
    setIsFormOpen(false)
    setEditingQuote(null)
    fetchQuotes(page)
  }

  const handleDelete = async () => {
    const { id, number } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, number: '' })
    try {
      await api.delete(`/quotes/${id}`)
      dispatch(addToast({ message: `Quote ${number} deleted`, type: 'success' }))
      fetchQuotes(page)
    } catch (err) {
      console.error(err)
      dispatch(addToast({ message: 'Failed to delete quote', type: 'error' }))
    }
  }

  const getStatusBadge = (status = 'Draft') => {
    const st = status.toLowerCase()
    if (st === 'accepted') {
      return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Accepted' }
    }
    if (st === 'sent') {
      return { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe', label: 'Sent' }
    }
    if (st === 'declined') {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', label: 'Declined' }
    }
    return { bg: '#f1f5f9', text: '#475467', border: '#cbd5e1', label: 'Draft' }
  }

  const allSelectedOnPage = quotes.length > 0 && quotes.every(q => selectedQuotes.some(sq => sq.id === q.id))

  const handleToggleSelectAll = () => {
    if (allSelectedOnPage) {
      const pageIds = new Set(quotes.map(q => q.id))
      setSelectedQuotes(prev => prev.filter(q => !pageIds.has(q.id)))
    } else {
      setSelectedQuotes(prev => {
        const map = new Map(prev.map(q => [q.id, q]))
        quotes.forEach(q => map.set(q.id, q))
        return Array.from(map.values())
      })
    }
  }

  const handleToggleSelectRow = (quote) => {
    setSelectedQuotes(prev => {
      const exists = prev.some(q => q.id === quote.id)
      if (exists) return prev.filter(q => q.id !== quote.id)
      return [...prev, quote]
    })
  }

  const handleRemoveFromCompare = (quoteId) => {
    setSelectedQuotes(prev => prev.filter(q => q.id !== quoteId))
  }

  const handleClearSelection = () => {
    setSelectedQuotes([])
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">
            {isFormOpen || editingQuote ? (
              <FullPageQuoteStepper
                quote={editingQuote}
                onBack={() => { setIsFormOpen(false); setEditingQuote(null); }}
                onSaved={handleSaveQuote}
              />
            ) : (
              <>
                {/* Top Toolbar */}
                <div className="ws-unified-page-header">
                  <div className="ws-unified-header-left">
                    <span className="ws-unified-header-title">Quotes</span>
                    <span className="ws-unified-header-badge">{total} quotes</span>
                  </div>
                  <div className="ws-unified-header-actions">
                    {/* Search box */}
                    <div className="attio-search-box">
                      <Search size={14} className="attio-search-icon" />
                      <input
                        type="text"
                        className="attio-input-search"
                        placeholder="Search quote # or customer..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      />
                    </div>

                    {/* Filter button */}
                    <button
                      className="attio-btn"
                      onClick={() => setShowFilterBar(prev => !prev)}
                      style={{
                        background: showFilterBar || filterStatus ? '#f1f5f9' : '#ffffff',
                        borderColor: showFilterBar || filterStatus ? '#0f172a' : '#cbd5e1',
                        fontWeight: showFilterBar || filterStatus ? 600 : 500
                      }}
                    >
                      <Filter size={13} /> Filter
                    </button>

                    {canCreate && (
                      <button
                        className="attio-btn attio-btn-primary"
                        onClick={() => setIsFormOpen(true)}
                      >
                        <Plus size={14} /> Create Quote
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Filter Box */}
                {showFilterBar && (
                  <div className="attio-filter-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                      <span>Status:</span>
                      <select
                        className="attio-select"
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      >
                        <option value="">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </div>

                    {filterStatus && (
                      <button
                        onClick={() => { setFilterStatus(''); setPage(1); }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                )}

                {/* CRM Table Card Box */}
                <div className="attio-table-card">
                  <div className="attio-table-wrap">
                    {loading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                        <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : quotes.length === 0 ? (
                      <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                        No quotes found. Click "+ Create Quote" to create your first quote.
                      </div>
                    ) : (
                      <table className="attio-table">
                        <thead>
                          <tr>
                            <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                checked={allSelectedOnPage}
                                onChange={handleToggleSelectAll}
                                title="Select all on this page"
                              />
                            </th>
                            <th>QUOTE #</th>
                            <th>CUSTOMER</th>
                            <th>SHOP / COMPANY</th>
                            <th>TOTAL AMOUNT</th>
                            <th>ISSUE DATE</th>
                            <th>VALID UNTIL</th>
                            <th>STATUS</th>
                            <th>DEAL CLOSED</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotes.map(row => {
                            const stBadge = getStatusBadge(row.status)
                            const issueStr = row.issue_date ? String(row.issue_date).split('T')[0] : '—'
                            const validStr = row.valid_until ? String(row.valid_until).split('T')[0] : '—'
                            const isClosed = row.status === 'Accepted' || row.status === 'Declined' || row.status === 'Rejected'
                            const isSelected = selectedQuotes.some(sq => sq.id === row.id)

                            return (
                              <tr key={row.id} style={{ background: isSelected ? '#f0f5ff' : undefined }}>
                                <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                                  <input 
                                    type="checkbox" 
                                    className="attio-chk" 
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectRow(row)}
                                    title="Select quote"
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>
                                      {row.quote_number}
                                    </span>
                                    {row.status === 'Accepted' && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>
                                        {row.order_number || `ORD-${row.quote_number ? row.quote_number.replace(/^QT-?/i, '') : row.id}`}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="attio-avatar" style={{ background: getAvatarColor(row.customer_name) }}>
                                      {getSingleLetter(row.customer_name)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.customer_name}</div>
                                      {row.customer_phone && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.customer_phone}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.8125rem' }}>
                                    <div style={{ fontWeight: 600, color: '#1e40af' }}>
                                      From: {row.shop_name || 'Workshop Store'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475467' }}>
                                      To: {row.customer_company || row.customer_name}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                    ₹{Number.parseFloat(row.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8125rem', color: '#475467' }}>
                                    {issueStr}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8125rem', color: '#475467' }}>
                                    {validStr}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    background: stBadge.bg,
                                    color: stBadge.text,
                                    border: `1px solid ${stBadge.border}`,
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    display: 'inline-block'
                                  }}>
                                    {stBadge.label}
                                  </span>
                                </td>
                                <td>
                                  {isClosed ? (
                                    <span style={{
                                      background: '#fee2e2',
                                      color: '#dc2626',
                                      border: '1px solid #fecaca',
                                      padding: '3px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}>
                                      ✓ Deal Closed
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>
                                      Open
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                      className="ws-table-btn ws-table-btn--secondary"
                                      style={{ padding: '3px 8px', gap: 4, display: 'inline-flex', alignItems: 'center' }}
                                      onClick={() => setViewingQuote(row)}
                                      title="View Quote Details"
                                    >
                                      <Eye size={12} /> View
                                    </button>
                                    {canEdit && row.status !== 'Accepted' && (
                                      <button
                                        className="ws-table-btn ws-table-btn--secondary"
                                        style={{ padding: '3px 8px', gap: 4, display: 'inline-flex', alignItems: 'center' }}
                                        onClick={() => setEditingQuote(row)}
                                        title="Edit & Resend Quote"
                                      >
                                        <Edit2 size={12} /> Edit
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        className="ws-table-btn ws-table-btn--danger"
                                        style={{ padding: '3px 8px', color: '#dc2626' }}
                                        onClick={() => setConfirmDelete({ isOpen: true, id: row.id, number: row.quote_number })}
                                        title="Delete Quote"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Table Footer */}
                  <TablePagination
                    page={page}
                    setPage={setPage}
                    total={total}
                    limit={limit}
                    getPageNumbers={getPageNumbers}
                    totalPages={totalPages}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* View Quote Modal — Dedicated Quotation Summary */}
      {viewingQuote && (
        <QuotePreviewModal
          quote={viewingQuote}
          onClose={() => setViewingQuote(null)}
          onEdit={() => {
            const q = viewingQuote
            setViewingQuote(null)
            setEditingQuote(q)
          }}
          onStatusChange={handleUpdateStatus}
        />
      )}

      {showCompareModal && (
        <QuoteComparisonModal
          quotes={selectedQuotes}
          onClose={() => setShowCompareModal(false)}
          onRemoveQuote={handleRemoveFromCompare}
          onClearAll={handleClearSelection}
        />
      )}

      {/* Floating Action Pill when quotes are selected */}
      {selectedQuotes.length > 0 && (
        <div className="product-compare-floating-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {selectedQuotes.length}
            </span>
            <span style={{ fontWeight: 500 }}>
              quote{selectedQuotes.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: '#334155' }} />

          {selectedQuotes.length >= 2 ? (
            <button
              onClick={() => setShowCompareModal(true)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.15s'
              }}
            >
              <ArrowLeftRight size={14} /> Compare Quotes
            </button>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Select 1 more quote to compare
            </span>
          )}

          <button
            onClick={handleClearSelection}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '2px 6px',
              textDecoration: 'underline'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
          >
            Deselect all
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Quote"
        message={`Are you sure you want to delete quote ${confirmDelete.number}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, number: '' })}
      />
    </div>
  )
}
