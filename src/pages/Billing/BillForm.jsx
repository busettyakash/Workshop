import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info, Plus, Trash2, Search, UserPlus, AlertCircle, X, Check, ChevronDown } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

const S = {
  input: {
    width: '100%', boxSizing: 'border-box', height: '40px', padding: '0 12px',
    border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem',
    color: '#111827', background: '#fff', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputFocus: { borderColor: '#3d68f5', boxShadow: '0 0 0 3px rgba(61,104,245,0.1)' },
  inputError: { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.08)' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' },
  error: { color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' },
}

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v || 0)

function QuickAddPersonModal({ onClose, onSaved }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ name: '', email: '', phone: '', persona: 'Customer', status: 'active', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { dispatch(addToast({ message: 'Name is required', type: 'error' })); return }
    setSaving(true)
    try {
      const res = await api.post('/people', form)
      dispatch(addToast({ message: 'Person added!', type: 'success' }))
      onSaved(res.data)
      onClose()
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to add person', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ws-modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="ws-modal-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h3 className="ws-modal-title">Quick Add Person</h3>
          <button type="button" className="ws-modal-close-x" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="ws-field-group">
              <label className="ws-field-label">Full Name *</label>
              <input className="ws-field-input" type="text" placeholder="e.g. Akash Busetty" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="ws-field-group">
              <label className="ws-field-label">Email Address</label>
              <input className="ws-field-input" type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="ws-field-group">
              <label className="ws-field-label">Phone Number</label>
              <input className="ws-field-input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="ws-field-group">
              <label className="ws-field-label">Persona</label>
              <select className="ws-field-input" value={form.persona} onChange={e => set('persona', e.target.value)}>
                <option value="Customer">Customer</option>
                <option value="Lead">Lead</option>
                <option value="Prospect">Prospect</option>
                <option value="Partner">Partner</option>
                <option value="Vendor">Vendor</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="ws-modal-footer">
            <button type="button" className="ws-modal-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ws-modal-btn ws-modal-btn--primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="ws-chat-loader-spin" /> : null}
              {saving ? 'Saving…' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BillForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loadingCusts, setLoadingCusts] = useState(true)
  const [loadingProds, setLoadingProds] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)
  
  // Product Search State
  const [productSearch, setProductSearch] = useState('')
  
  // Inline Quick Add Person Modal State
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Customer Search and Dropdown State
  const [custSearch, setCustSearch] = useState('')
  const [showCustDropdown, setShowCustDropdown] = useState(false)

  // Line items added to the bill
  const [lineItems, setLineItems] = useState([])

  const [form, setForm] = useState({
    customer_id: '',
    discount: 0,
    status: 'unpaid',
    tax_rate: 18, // GST rate percentage (default 18%)
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    dispatch(setActiveNav('Billing'))
    Promise.all([fetchCustomers(), fetchProducts()])
  }, [dispatch])

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/people')
      const custs = res.data?.data || []
      setCustomers(custs)
      if (custs.length > 0) setForm(prev => ({ ...prev, customer_id: custs[0].id }))
    } catch {
      dispatch(addToast({ message: 'Failed to load people', type: 'error' }))
    } finally {
      setLoadingCusts(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products')
      setProducts(res.data?.data || [])
    } catch {
      console.error('Failed to load products')
    } finally {
      setLoadingProds(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'discount' ? (value === '' ? 0 : parseFloat(value)) : value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  // Line item helpers
  const addLineItem = (product) => {
    setLineItems(prev => {
      const existing = prev.find(li => li.product_id === product.id)
      if (existing) {
        const newQty = existing.qty + 1
        if (newQty > product.stock) {
          dispatch(addToast({ message: `Cannot add more. Only ${product.stock} units available in stock.`, type: 'warning' }))
          return prev
        }
        return prev.map(li => li.product_id === product.id ? { ...li, qty: newQty } : li)
      }
      if (product.stock <= 0) {
        dispatch(addToast({ message: 'Product is out of stock', type: 'error' }))
        return prev
      }
      return [...prev, { product_id: product.id, name: product.name, price: parseFloat(product.price), qty: 1, unit: product.unit || 'pcs', discount: 0 }]
    })
  }

  const updateLineItem = (idx, field, value) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li))
  }

  const removeLineItem = (idx) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Calculations
  const grossSubtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.price) * parseFloat(li.qty || 1)), 0)
  const lineDiscounts = lineItems.reduce((sum, li) => sum + parseFloat(li.discount || 0), 0)
  const subtotal = Math.max(0, grossSubtotal - lineDiscounts)

  const discountAmt = Math.min(parseFloat(form.discount || 0), subtotal)
  const taxableValue = Math.max(0, subtotal - discountAmt)
  
  // GST Tax Calculation
  const taxRate = parseFloat(form.tax_rate || 0)
  const taxAmt = taxableValue * (taxRate / 100)
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2
  const total = taxableValue + taxAmt
  const totalDiscount = lineDiscounts + discountAmt

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.customer_id) err.customer_id = 'Please select a customer'
    if (lineItems.length === 0) err.items = 'Add at least one product'
    if (form.status === 'unpaid' && !form.due_date) err.due_date = 'Select a due date'
    if (Object.keys(err).length) { setErrors(err); return }

    // Check if any line item exceeds stock
    let stockError = false
    for (const li of lineItems) {
      const productObj = products.find(p => p.id === li.product_id)
      if (productObj && parseFloat(li.qty) > productObj.stock) {
        stockError = true
        dispatch(addToast({ message: `Quantity for ${li.name} exceeds available stock (${productObj.stock})`, type: 'error' }))
      }
    }
    if (stockError) return

    setSaving(true)
    try {
      await api.post('/billing', {
        customer_id: parseInt(form.customer_id),
        amount: total,
        due_date: form.status === 'unpaid' ? form.due_date : null,
        notes: form.notes,
        status: form.status,
        items: lineItems.map(li => {
          const itemPrice = parseFloat(li.price)
          const itemQty = parseFloat(li.qty || 1)
          const itemDiscount = parseFloat(li.discount || 0)
          const itemTaxable = Math.max(0, (itemPrice * itemQty) - itemDiscount)
          const globalDiscountShare = subtotal > 0 ? (discountAmt * (itemTaxable / subtotal)) : 0
          const finalTaxable = Math.max(0, itemTaxable - globalDiscountShare)
          const itemTaxAmt = finalTaxable * (taxRate / 100)
          return {
            ...li,
            tax_rate: taxRate,
            tax_amount: itemTaxAmt
          }
        }),
        discount: totalDiscount,
      })
      dispatch(addToast({ message: 'Bill created successfully!', type: 'success' }))
      navigate('/billing')
    } catch {
      dispatch(addToast({ message: 'Failed to create bill', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  const selectedCustomer = customers.find(c => String(c.id) === String(form.customer_id))

  // Filter products by search term
  const filteredProducts = products.filter(p => 
    p.status === 'active' && 
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
     (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
  )

  const handleQuickAddSaved = (newPerson) => {
    setCustomers(prev => [newPerson, ...prev])
    setForm(prev => ({ ...prev, customer_id: newPerson.id }))
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <button
              onClick={() => navigate('/billing')}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>New Bill</h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>Billing / New Invoice</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Customer & Status */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Bill Details</p>
                </div>
                <div style={{ padding: '20px' }}>
                  {/* Customer */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Customer <span style={{ color: '#dc2626' }}>*</span></label>
                    {loadingCusts ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, color: '#9ca3af', fontSize: '0.875rem' }}>
                        <Loader2 size={14} className="ws-chat-loader-spin" /> Loading...
                      </div>
                    ) : customers.length === 0 ? (
                      <div style={{ padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.8125rem', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>No people found.</span>
                        <button type="button" onClick={() => navigate('/people/add')} style={{ color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline', fontSize: 'inherit' }}>
                          Add Person
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          {showCustDropdown && (
                            <div
                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                              onClick={() => setShowCustDropdown(false)}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowCustDropdown(!showCustDropdown)}
                            style={{
                              ...inp('customer_id'),
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#fff'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedCustomer
                                ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                                : 'Select customer...'}
                            </span>
                            <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                          </button>

                          {showCustDropdown && (
                            <div style={{
                              position: 'absolute',
                              top: '44px',
                              left: 0,
                              right: 0,
                              background: '#fff',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              zIndex: 50,
                              padding: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f3f4f6', paddingBottom: 6, marginBottom: 6 }}>
                                <Search size={13} color="#9ca3af" />
                                <input
                                  type="text"
                                  placeholder="Search by name, email, phone..."
                                  value={custSearch}
                                  onChange={e => setCustSearch(e.target.value)}
                                  style={{ border: 'none', outline: 'none', fontSize: '0.8125rem', width: '100%', padding: '4px' }}
                                  onClick={e => e.stopPropagation()}
                                  autoFocus
                                />
                              </div>

                              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {customers.filter(c => 
                                  c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                                  (c.email && c.email.toLowerCase().includes(custSearch.toLowerCase())) ||
                                  (c.phone && c.phone.includes(custSearch))
                                ).length === 0 ? (
                                  <div style={{ padding: '8px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>No matches found</div>
                                ) : (
                                  customers.filter(c => 
                                    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                                    (c.email && c.email.toLowerCase().includes(custSearch.toLowerCase())) ||
                                    (c.phone && c.phone.includes(custSearch))
                                  ).map(c => {
                                    const isSelected = String(c.id) === String(form.customer_id)
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          setForm(prev => ({ ...prev, customer_id: c.id }))
                                          setShowCustDropdown(false)
                                          setCustSearch('')
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          border: 'none',
                                          background: isSelected ? '#eff6ff' : 'transparent',
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 2
                                        }}
                                        onMouseEnter={e => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                        onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{c.name}</span>
                                          <span style={{ fontSize: '0.7rem', color: '#3b82f6', background: '#eff6ff', padding: '1px 5px', borderRadius: '10px' }}>{c.persona}</span>
                                        </div>
                                        {(c.email || c.phone) && (
                                          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                                            {c.email || ''}{c.email && c.phone ? ' • ' : ''}{c.phone || ''}
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/people/add')}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#2563eb',
                            flexShrink: 0,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                          onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                          title="Add Person"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    )}
                    {errors.customer_id && <span style={S.error}>{errors.customer_id}</span>}
                  </div>

                  {/* Status toggle */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Payment Status</label>
                    <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
                      {['unpaid', 'paid'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, status: s }))}
                          style={{
                            flex: 1, height: 38, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
                            background: form.status === s ? (s === 'paid' ? '#dcfce7' : '#fef3c7') : '#fff',
                            color: form.status === s ? (s === 'paid' ? '#15803d' : '#92400e') : '#6b7280',
                          }}
                        >
                          {s === 'paid' ? 'Paid' : 'Unpaid / Pending'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* GST Selector */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>GST Tax Rate</label>
                    <select
                      name="tax_rate"
                      value={form.tax_rate}
                      onChange={e => setForm(prev => ({ ...prev, tax_rate: parseInt(e.target.value) }))}
                      style={S.input}
                    >
                      <option value="0">0% (GST Exempt / Nil Rated)</option>
                      <option value="5">5% GST (CGST 2.5%, SGST 2.5%)</option>
                      <option value="12">12% GST (CGST 6%, SGST 6%)</option>
                      <option value="18">18% GST (CGST 9%, SGST 9%)</option>
                      <option value="28">28% GST (CGST 14%, SGST 14%)</option>
                    </select>
                  </div>

                  {/* Due date — only for unpaid */}
                  {form.status === 'unpaid' && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={S.label}>Due Date <span style={{ color: '#dc2626' }}>*</span></label>
                      <input name="due_date" type="date" value={form.due_date} onChange={handleChange} style={inp('due_date')} onFocus={() => setFocus('due_date')} onBlur={() => setFocus(null)} />
                      {errors.due_date && <span style={S.error}>{errors.due_date}</span>}
                    </div>
                  )}

                  {/* Discount */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Discount (₹) <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem' }}>optional</span></label>
                    <input name="discount" type="number" min="0" value={form.discount === 0 ? '' : form.discount} onChange={handleChange} placeholder="0" style={inp('discount')} onFocus={() => setFocus('discount')} onBlur={() => setFocus(null)} />
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={S.label}>Notes <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem' }}>optional</span></label>
                    <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Payment instructions, terms, etc." rows={3} style={{ ...inp('notes'), height: 'auto', padding: '10px 12px', resize: 'vertical' }} onFocus={() => setFocus('notes')} onBlur={() => setFocus(null)} />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Products / Line Items</p>
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '2px 0 0' }}>Click products from the right sidebar to add them</p>
                  </div>
                  {errors.items && <span style={{ ...S.error, margin: 0 }}>{errors.items}</span>}
                </div>

                {lineItems.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                    No products added yet — use the product list on the right to add items
                  </div>
                ) : (
                  <div style={{ padding: '0 20px' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 80px 100px 32px', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Product</span>
                      <span>Qty / Unit</span>
                      <span>Unit Price</span>
                      <span>Discount (₹)</span>
                      <span style={{ textAlign: 'right' }}>Total</span>
                      <span></span>
                    </div>
                    {lineItems.map((li, idx) => {
                      const productObj = products.find(p => p.id === li.product_id)
                      const stockAvailable = productObj ? productObj.stock : 999999
                      const exceedsStock = parseFloat(li.qty) > stockAvailable

                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 80px 100px 32px', gap: 10, padding: '12px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{li.name}</span>
                            {exceedsStock && (
                              <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                <AlertCircle size={10} /> Max available: {stockAvailable}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={li.qty}
                              onChange={e => updateLineItem(idx, 'qty', e.target.value)}
                              style={{ ...S.input, width: 60, height: 32, padding: '0 6px', fontSize: '0.8125rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{li.unit}</span>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={li.price}
                              onChange={e => updateLineItem(idx, 'price', e.target.value)}
                              style={{ ...S.input, height: 32, padding: '0 8px', fontSize: '0.8125rem' }}
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={li.discount === 0 ? '' : li.discount}
                              onChange={e => updateLineItem(idx, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              style={{ ...S.input, height: 32, padding: '0 8px', fontSize: '0.8125rem' }}
                              placeholder="0"
                            />
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                            {INR(Math.max(0, (parseFloat(li.price) * parseFloat(li.qty || 1)) - parseFloat(li.discount || 0)))}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
                    })}

                    {/* Totals */}
                    <div style={{ padding: '14px 0', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                        <span>Subtotal</span>
                        <span>{INR(grossSubtotal)}</span>
                      </div>
                      {lineDiscounts > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a' }}>
                          <span>Product Discounts</span>
                          <span>- {INR(lineDiscounts)}</span>
                        </div>
                      )}
                      {discountAmt > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a' }}>
                          <span>Additional Discount</span>
                          <span>- {INR(discountAmt)}</span>
                        </div>
                      )}
                      {form.tax_rate > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280' }}>
                            <span>CGST ({form.tax_rate / 2}%)</span>
                            <span>{INR(cgst)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280' }}>
                            <span>SGST ({form.tax_rate / 2}%)</span>
                            <span>{INR(sgst)}</span>
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: '#111827', borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                        <span>Total (GST Incl.)</span>
                        <span>{INR(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

              {/* Bill Summary */}
              {selectedCustomer && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Summary</p>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#6b7280' }}>Customer</span>
                      <span style={{ color: '#111827', fontWeight: 500 }}>{selectedCustomer.name}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#6b7280' }}>Email</span>
                        <span style={{ color: '#4b5563', fontWeight: 450 }}>{selectedCustomer.email}</span>
                      </div>
                    )}
                    {selectedCustomer.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#6b7280' }}>Phone</span>
                        <span style={{ color: '#4b5563', fontWeight: 450 }}>{selectedCustomer.phone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#6b7280' }}>Items</span>
                      <span style={{ color: '#111827', fontWeight: 500 }}>{lineItems.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#6b7280' }}>GST Rate</span>
                      <span style={{ color: '#111827', fontWeight: 500 }}>{form.tax_rate}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#6b7280' }}>Total</span>
                      <span style={{ color: '#111827', fontWeight: 700 }}>{INR(total)}</span>
                    </div>
                    {form.status === 'unpaid' && form.due_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#6b7280' }}>Due Date</span>
                        <span style={{ color: '#92400e', fontWeight: 500 }}>
                          {new Date(form.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, marginTop: 2 }}>
                      <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: form.status === 'paid' ? '#dcfce7' : '#fef3c7', color: form.status === 'paid' ? '#15803d' : '#92400e', borderRadius: '20px', fontWeight: 600 }}>
                        {form.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Product List with Search Filter */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Products</p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0' }}>Click to add to bill</p>
                </div>
                
                {/* Product Search Box */}
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.8125rem', color: '#111827', width: '100%', padding: '4px 0' }}
                  />
                  {productSearch && (
                    <button type="button" onClick={() => setProductSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto', padding: '8px 0' }}>
                  {loadingProds ? (
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                      <Loader2 size={18} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
                      {productSearch ? 'No products match search' : 'No active products found'}
                    </div>
                  ) : (
                    filteredProducts.map(p => {
                      const lineItem = lineItems.find(li => li.product_id === p.id)
                      const qtyAdded = lineItem ? parseFloat(lineItem.qty || 0) : 0
                      const remainingStock = p.stock - qtyAdded
                      const alreadyAdded = qtyAdded > 0
                      
                      const hasNoStock = p.stock <= 0
                      const isStockDepleted = remainingStock <= 0
                      const isLowStock = remainingStock > 0 && remainingStock < 5

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (hasNoStock || isStockDepleted) {
                              if (!alreadyAdded) {
                                dispatch(addToast({ message: 'Product is out of stock', type: 'error' }))
                              }
                              return
                            }
                            addLineItem(p)
                          }}
                          disabled={hasNoStock || (isStockDepleted && !alreadyAdded)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '9px 16px', border: 'none', 
                            background: alreadyAdded ? '#f0fdf4' : '#fff',
                            cursor: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 'not-allowed' : 'pointer', 
                            textAlign: 'left', transition: 'background 0.1s', gap: 8,
                            opacity: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 0.55 : 1
                          }}
                          onMouseEnter={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#fff')}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{INR(p.price)} / {p.unit || 'pcs'}</span>
                              {hasNoStock || isStockDepleted ? (
                                <span style={{ color: '#b91c1c', fontWeight: 600, background: '#fee2e2', padding: '1px 4px', borderRadius: 3, fontSize: '0.65rem' }}>
                                  No Stock
                                </span>
                              ) : isLowStock ? (
                                <span style={{ color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '1px 4px', borderRadius: 3, fontSize: '0.65rem' }}>
                                  Stock: {remainingStock}
                                </span>
                              ) : (
                                <span style={{ color: '#6b7280', background: '#f3f4f6', padding: '1px 4px', borderRadius: 3, fontSize: '0.65rem' }}>
                                  Stock: {remainingStock}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {alreadyAdded ? (
                              <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>Added</span>
                            ) : (
                              <Plus size={14} color="#9ca3af" />
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="submit"
                  disabled={saving || customers.length === 0}
                  style={{ width: '100%', height: 40, border: 'none', borderRadius: '8px', background: (saving || customers.length === 0) ? '#9ca3af' : '#111827', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: (saving || customers.length === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving && <Loader2 size={14} className="ws-chat-loader-spin" />}
                  {saving ? 'Creating...' : 'Create Bill'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/billing')}
                  style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>

      {/* Quick Add Person Modal */}
      {showQuickAdd && (
        <QuickAddPersonModal
          onClose={() => setShowQuickAdd(false)}
          onSaved={handleQuickAddSaved}
        />
      )}
    </div>
  )
}
