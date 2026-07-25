import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Plus, Trash2, Search, UserPlus, AlertCircle, X, ChevronDown, PackagePlus, ArrowRight, Check } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails, ALL_UOM_OPTIONS } from '../../utils/unitHelpers'
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

const INR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)

function QuickAddPersonModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', persona: 'customer' })
  const [saving, setSaving] = useState(false)
  const dispatch = useAppDispatch()
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/people', form)
      dispatch(addToast({ message: 'Person added', type: 'success' }))
      onSaved(res.data)
      onClose()
    } catch {
      dispatch(addToast({ message: 'Failed to add person', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 600 }}>Quick Add Person</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={S.input} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 36, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-blue" style={{ flex: 1, height: 36, justifyContent: 'center', background: saving || !form.name.trim() ? '#9ca3af' : undefined, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Person'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuickAddProductModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', sku: '', category: '', price: '', stock: 0, unit: 'pcs', description: '', bag_weight: 100 })
  const [saving, setSaving] = useState(false)
  const [uomOptions, setUomOptions] = useState(ALL_UOM_OPTIONS)
  const dispatch = useAppDispatch()

  useEffect(() => {
    api.get('/uoms').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setUomOptions(res.data.map(u => ({ value: u.code, label: `${u.name} (${u.code})`, category: u.category })))
      }
    }).catch(() => { })
  }, [])

  const generateSKU = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let rand = ''
    for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length))
    setForm(prev => ({ ...prev, sku: `SKU-${rand}` }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    try {
      const res = await api.post('/products', form)
      dispatch(addToast({ message: 'Product added', type: 'success' }))
      onSaved(res.data)
      onClose()
    } catch {
      dispatch(addToast({ message: 'Failed to add product', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const bulkUnit = getBulkUnitDetails(form.unit)

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 600 }}>Quick Add Product</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Product Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>SKU</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={{ ...S.input, flex: 1 }} placeholder="e.g. SKU-1234" />
                <button type="button" onClick={generateSKU} style={{ padding: '0 8px', height: 40, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Gen</button>
              </div>
            </div>
            <div>
              <label style={S.label}>Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.input} placeholder="e.g. Electronics" />
            </div>
            <div>
              <label style={S.label}>Unit of Measure</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={S.input}>
                {uomOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            {bulkUnit ? (
              <div>
                <label style={S.label}>100{bulkUnit.short} Benchmark Rate (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={form.price_100 ?? ''}
                  onChange={e => {
                    const val = e.target.value
                    const bw = parseFloat(form.bag_weight || 100)
                    const packPrice = val ? ((parseFloat(val) / 100) * bw).toFixed(2) : ''
                    setForm(prev => ({ ...prev, price_100: val, price: packPrice }))
                  }}
                  placeholder={`Rate for 100${bulkUnit.short}`}
                  style={S.input}
                />
              </div>
            ) : (
              <div>
                <label style={S.label}>Price (₹) *</label>
                <input type="number" step="any" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={S.input} />
              </div>
            )}
            {bulkUnit && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Package / Bag Weight ({bulkUnit.short})</label>
                <input
                  type="number"
                  step="any"
                  value={form.bag_weight}
                  onChange={e => {
                    const bw = parseFloat(e.target.value || 1)
                    const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                    const packPrice = p100 ? ((p100 / 100) * bw).toFixed(2) : form.price
                    setForm(prev => ({ ...prev, bag_weight: e.target.value, price: packPrice }))
                  }}
                  placeholder="e.g. 25, 50, 75, 100"
                  style={S.input}
                />
                {bulkUnit.quickSizes && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {bulkUnit.quickSizes.map(size => {
                      const isSelected = Number(form.bag_weight) === size
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                            const calculatedPrice = p100 ? ((p100 / 100) * size).toFixed(2) : form.price
                            setForm(prev => ({ ...prev, bag_weight: size, price: calculatedPrice }))
                          }}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            border: isSelected ? '1px solid #3d68f5' : '1px solid #e5e7eb',
                            background: isSelected ? '#eff6ff' : '#f9fafb',
                            color: isSelected ? '#3d68f5' : '#4b5563',
                            fontSize: '0.72rem',
                            fontWeight: isSelected ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.12s'
                          }}
                        >
                          {size}{bulkUnit.short}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {bulkUnit && (
              <div>
                <label style={S.label}>Calculated Pack Price (₹)</label>
                <input
                  type="text"
                  readOnly
                  value={
                    (() => {
                      const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                      const bw = parseFloat(form.bag_weight || 100)
                      return p100 > 0 ? `₹${((p100 / 100) * bw).toFixed(2)}` : '₹0.00'
                    })()
                  }
                  style={{ ...S.input, background: '#f8fafc', color: '#10b981', fontWeight: 700 }}
                />
              </div>
            )}
            <div>
              <label style={S.label}>
                {bulkUnit && parseFloat(form.bag_weight) > 1
                  ? `Stock Quantity (${bulkUnit.pluralName})`
                  : `Stock Quantity (${bulkUnit?.short || form.unit || 'pcs'})`}
              </label>
              <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={S.input} />
            </div>
          </div>
          {bulkUnit && (form.price_100 || form.price) && form.bag_weight && (
            <div style={{ marginTop: 12, fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>
              Calculated Unit Rate: ₹{(parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100).toFixed(2)} / {bulkUnit.short}
              • {form.bag_weight}{bulkUnit.short} {bulkUnit.name} Price: ₹{((parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100) * parseFloat(form.bag_weight)).toFixed(2)}
            </div>
          )}
        </form>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 36, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim() || !form.price} className="btn-blue" style={{ flex: 1, height: 36, justifyContent: 'center', background: saving || !form.name.trim() || !form.price ? '#9ca3af' : undefined, cursor: saving || !form.name.trim() || !form.price ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Product'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BillForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const createdPersonId = searchParams.get('createdPersonId')
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [step, setStep] = useState(1) // 1: Cart & Products, 2: Checkout Details & Summary

  const [form, setForm] = useState({
    customer_id: createdPersonId || '',
    status: 'unpaid',
    due_date: '',
    discount: 0,
    tax_rate: 0,
    notes: ''
  })
  const [lineItems, setLineItems] = useState([])

  const [customers, setCustomers] = useState([])
  const [loadingCusts, setLoadingCusts] = useState(true)
  const [showCustDropdown, setShowCustDropdown] = useState(false)
  const [custSearch, setCustSearch] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false)

  const [products, setProducts] = useState([])
  const [loadingProds, setLoadingProds] = useState(true)
  const [productSearch, setProductSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  useEffect(() => {
    dispatch(setActiveNav('Billing'))
    fetchData()
  }, [dispatch])

  const fetchData = async () => {
    try {
      const [resCust, resProd] = await Promise.all([
        api.get('/people?limit=100'),
        api.get('/products?status=active&limit=500')
      ])
      const custs = resCust.data?.data || []
      setCustomers(custs)
      setProducts(resProd.data?.data || [])

      if (createdPersonId) {
        const found = custs.find(c => String(c.id) === String(createdPersonId))
        if (found) {
          setForm(prev => ({ ...prev, customer_id: found.id }))
        }
      }

      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 7)
      setForm(prev => ({ ...prev, due_date: defaultDate.toISOString().split('T')[0] }))
    } catch {
      dispatch(addToast({ message: 'Failed to load data', type: 'error' }))
    } finally {
      setLoadingCusts(false)
      setLoadingProds(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const addLineItem = (prod) => {
    const bulkUnit = getBulkUnitDetails(prod.unit)
    const effectivePrice = prod.updated_price ? parseFloat(prod.updated_price) : parseFloat(prod.price || 0)
    const priceToUse = bulkUnit ? (effectivePrice / (parseFloat(prod.bag_weight) || 1)).toFixed(2) : effectivePrice
    setLineItems(prev => [...prev, {
      product_id: prod.id,
      name: prod.name,
      price: priceToUse,
      qty: 1,
      discount: 0,
      unit: prod.unit || 'pcs'
    }])
    if (errors.items) setErrors(prev => ({ ...prev, items: '' }))
  }

  const removeLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleQuickAddSaved = (person) => {
    setCustomers(prev => [person, ...prev])
    setForm(prev => ({ ...prev, customer_id: person.id }))
  }

  const handleQuickAddProductSaved = (product) => {
    setProducts(prev => [product, ...prev])
    addLineItem(product)
  }

  const handleNextStep = () => {
    const err = {}
    if (lineItems.length === 0) err.items = 'Add at least one product'
    if (Object.keys(err).length) {
      setErrors(err)
      return
    }
    setStep(2)
  }

  // Calculations
  const grossSubtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.price || 0) * parseFloat(li.qty || 1)), 0)
  const lineDiscounts = lineItems.reduce((sum, li) => sum + parseFloat(li.discount || 0), 0)
  const discountAmt = parseFloat(form.discount || 0)
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscounts - discountAmt)

  const taxRate = parseFloat(form.tax_rate || 0)
  const taxAmount = netSubtotal * (taxRate / 100)
  const cgst = taxAmount / 2
  const sgst = taxAmount / 2

  const total = netSubtotal + taxAmount

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (form.status === 'unpaid' && !form.due_date) err.due_date = 'Due date is required'
    if (lineItems.length === 0) err.items = 'Add at least one product'
    if (Object.keys(err).length) { setErrors(err); return }

    setSaving(true)
    try {
      const payload = {
        customer_id: form.customer_id || null,
        amount: total,
        status: form.status,
        due_date: form.status === 'unpaid' ? form.due_date : null,
        discount: parseFloat(form.discount || 0),
        tax_rate: parseFloat(form.tax_rate || 0),
        notes: form.notes,
        items: lineItems.map(li => ({
          product_id: li.product_id,
          qty: parseFloat(li.qty || 1),
          price: parseFloat(li.price || 0),
          discount: parseFloat(li.discount || 0)
        }))
      }
      await api.post('/billing', payload)
      dispatch(addToast({ message: 'Invoice created successfully!', type: 'success' }))
      navigate('/billing')
    } catch {
      dispatch(addToast({ message: 'Failed to create invoice', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  const selectedCustomer = form.customer_id === null
    ? { name: 'Walk-in Customer', phone: '' }
    : customers.find(c => String(c.id) === String(form.customer_id))

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => step === 2 ? setStep(1) : navigate('/billing')}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '6px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              <ArrowLeft size={14} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', margin: 0 }}>
                {step === 1 ? 'Step 1: Add Products' : 'Step 2: Checkout Details'}
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '1px 0 0' }}>
                Billing / New Invoice / Step {step}
              </p>
            </div>
          </div>

          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 16, alignItems: 'start' }}>
              {/* ── LEFT COLUMN (Cart) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', margin: 0 }}>Current Cart</p>
                      <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '1px 0 0' }}>Add items from the product catalog on the right</p>
                    </div>
                    {errors.items && <span style={{ ...S.error, margin: 0 }}>{errors.items}</span>}
                  </div>

                  {lineItems.length === 0 ? (
                    <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
                      <div style={{ background: '#f9fafb', width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Search size={20} color="#d1d5db" />
                      </div>
                      No products added yet. Select items from the catalog.
                    </div>
                  ) : (
                    <div style={{ padding: '0 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 75px 90px 28px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.68rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        const bulkUnit = getBulkUnitDetails(li.unit)

                        return (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 80px 100px 32px', gap: 10, padding: '10px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#111827', display: 'block' }}>{li.name}</span>
                              {bulkUnit && productObj && productObj.bag_weight > 1 && (
                                <span style={{ fontSize: '0.69rem', color: '#059669', display: 'block', marginTop: 2, fontWeight: 500 }}>
                                  {bulkUnit.name}: {INR(parseFloat(li.price || 0) * productObj.bag_weight)} ({productObj.bag_weight}{bulkUnit.short})
                                </span>
                              )}
                              {exceedsStock && (
                                <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <AlertCircle size={10} /> Max available: {stockAvailable}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                step="any"
                                value={li.qty ?? ''}
                                onChange={e => updateLineItem(idx, 'qty', e.target.value)}
                                onFocus={e => e.target.select()}
                                style={{ ...S.input, width: 65, height: 28, padding: '0 6px', fontSize: '0.8125rem' }}
                              />
                              <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{li.unit}</span>
                            </div>
                            <div>
                              <input
                                type="text"
                                readOnly
                                value={`₹${parseFloat(li.price || 0).toFixed(2)}`}
                                style={{ ...S.input, height: 28, padding: '0 6px', fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563', background: '#f8fafc', cursor: 'not-allowed' }}
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={li.discount === 0 ? '' : li.discount}
                                onChange={e => updateLineItem(idx, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                style={{ ...S.input, height: 28, padding: '0 6px', fontSize: '0.8125rem' }}
                                placeholder="0"
                              />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                              {INR(Math.max(0, (parseFloat(li.price || 0) * parseFloat(li.qty || 0)) - parseFloat(li.discount || 0)))}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}

                      <div style={{ padding: '12px 0 12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                          Cart Subtotal: <span style={{ fontWeight: 700, color: '#111827' }}>{INR(Math.max(0, grossSubtotal - lineDiscounts))}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="btn-blue"
                        >
                          Next: Payment & GST <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN (Customer & Catalog) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Customer */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Select Customer</p>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    {loadingCusts ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, color: '#9ca3af', fontSize: '0.8125rem' }}>
                        <Loader2 size={14} className="ws-chat-loader-spin" /> Loading...
                      </div>
                    ) : (
                      <>
                        {/* Customer row: dropdown + action buttons */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>

                          {/* Dropdown trigger */}
                          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                            {/* Click-outside overlay */}
                            {showCustDropdown && (
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
                                onClick={() => { setShowCustDropdown(false); setCustSearch('') }}
                              />
                            )}

                            {/* Trigger button */}
                            <button
                              type="button"
                              onClick={() => setShowCustDropdown(v => !v)}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                height: 36, padding: '0 10px',
                                border: `1px solid ${errors.customer_id ? '#dc2626' : '#d1d5db'}`,
                                borderRadius: '8px', outline: 'none',
                                cursor: 'pointer', display: 'flex',
                                justifyContent: 'space-between', alignItems: 'center',
                                background: '#fff', fontFamily: 'inherit',
                                textTransform: 'none', letterSpacing: 'normal',
                              }}
                            >
                              <span style={{
                                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontSize: '0.8125rem',
                                fontWeight: selectedCustomer ? 600 : 400,
                                color: selectedCustomer ? '#111827' : '#9ca3af',
                                textTransform: 'none',
                              }}>
                                {selectedCustomer
                                  ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                                  : 'Select customer...'}
                              </span>
                              <ChevronDown size={13} color="#9ca3af" style={{ flexShrink: 0, marginLeft: 6 }} />
                            </button>

                            {/* Absolute-position dropdown */}
                            {showCustDropdown && (
                              <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                left: 0,
                                width: '100%',
                                minWidth: '240px',
                                background: '#fff',
                                border: '1px solid #d1d5db',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                zIndex: 9999,
                                padding: '6px',
                                boxSizing: 'border-box',
                              }}>
                                {/* Search inside dropdown */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: '#f9fafb', borderRadius: '6px', marginBottom: 6 }}>
                                  <Search size={13} color="#9ca3af" />
                                  <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    value={custSearch}
                                    onChange={e => setCustSearch(e.target.value)}
                                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.8125rem', width: '100%', fontFamily: 'inherit', color: '#111827' }}
                                    onClick={e => e.stopPropagation()}
                                    autoFocus
                                  />
                                  {custSearch && (
                                    <button type="button" onClick={() => setCustSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>

                                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                  {customers.filter(c =>
                                    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                                    (c.phone && c.phone.includes(custSearch))
                                  ).length === 0 ? (
                                    <div style={{ padding: '12px 8px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>No matches found</div>
                                  ) : (
                                    customers
                                      .filter(c =>
                                        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                                        (c.phone && c.phone.includes(custSearch))
                                      )
                                      .map(c => {
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
                                              width: '100%', padding: '8px 10px', border: 'none',
                                              background: isSelected ? '#eff6ff' : 'transparent',
                                              textAlign: 'left', cursor: 'pointer', borderRadius: '6px',
                                              display: 'flex', flexDirection: 'column', gap: 2,
                                              fontFamily: 'inherit',
                                            }}
                                            onMouseEnter={e => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                                            onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                          >
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', textTransform: 'none' }}>{c.name}</span>
                                            {c.phone && (
                                              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{c.phone}</span>
                                            )}
                                          </button>
                                        )
                                      })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick-add person icon button */}
                          <button
                            type="button"
                            onClick={() => navigate('/people/add?returnUrl=/billing/add')}
                            style={{
                              flexShrink: 0, width: 36, height: 36,
                              background: '#eff6ff', border: '1px solid #bfdbfe',
                              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#2563eb',
                            }}
                            title="Quick Add Customer"
                          >
                            <UserPlus size={15} />
                          </button>

                          {/* Walk-in button — always blue */}
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, customer_id: null }))}
                            className="btn-blue"
                            style={{ flexShrink: 0, padding: '0 14px', height: 36, whiteSpace: 'nowrap' }}
                            title="Walk-in Customer"
                          >
                            Walk-in
                          </button>
                        </div>

                        {/* Show selected or Walk-in badge */}
                        {(form.customer_id || form.customer_id === null) && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '3px 10px', borderRadius: '99px',
                              background: form.customer_id === null ? '#eff6ff' : '#f0fdf4',
                              border: `1px solid ${form.customer_id === null ? '#bfdbfe' : '#bbf7d0'}`,
                              fontSize: '0.75rem', fontWeight: 600,
                              color: form.customer_id === null ? '#1d4ed8' : '#15803d',
                            }}>
                              {form.customer_id === null ? '🚶 Walk-in Customer' : `✓ ${selectedCustomer?.name}`}
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, customer_id: '' }))}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', opacity: 0.6 }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        )}

                        {errors.customer_id && <span style={S.error}>{errors.customer_id}</span>}
                      </>
                    )}
                  </div>
                </div>

                {/* Product Catalog */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 360 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Product Catalog</p>
                  </div>

                  {/* Search */}
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb' }}>
                    <Search size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search catalog..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.8125rem', color: '#111827', width: '100%', padding: '2px 0' }}
                    />
                    {productSearch && (
                      <button type="button" onClick={() => setProductSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: '380px' }}>
                    {loadingProds ? (
                      <div style={{ padding: '30px 16px', display: 'flex', justifyContent: 'center' }}>
                        <Loader2 size={20} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ padding: '24px 14px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
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
                        const bulkUnit = getBulkUnitDetails(p.unit)

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (hasNoStock || isStockDepleted) {
                                if (!alreadyAdded) dispatch(addToast({ message: 'Product is out of stock', type: 'error' }))
                                return
                              }
                              addLineItem(p)
                            }}
                            disabled={hasNoStock || (isStockDepleted && !alreadyAdded)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f3f4f6',
                              background: alreadyAdded ? '#f0fdf4' : '#fff',
                              cursor: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 'not-allowed' : 'pointer',
                              textAlign: 'left', transition: 'background 0.1s', gap: 10,
                              opacity: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 0.55 : 1
                            }}
                            onMouseEnter={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#f9fafb')}
                            onMouseLeave={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#fff')}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#111827', marginBottom: 2 }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {(() => {
                                  const effectivePrice = p.updated_price ? parseFloat(p.updated_price) : parseFloat(p.price || 0)
                                  if (bulkUnit && p.bag_weight > 1) {
                                    return (
                                      <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                                        {bulkUnit.name}: {INR(effectivePrice)} ({p.bag_weight}{bulkUnit.short}) • {INR(effectivePrice / p.bag_weight)}/{bulkUnit.short}
                                        {p.updated_price && <span style={{ color: '#10b981', fontWeight: 600, marginLeft: 4 }}>(Updated)</span>}
                                      </span>
                                    )
                                  }
                                  return (
                                    <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                                      {INR(effectivePrice)} / {p.unit || 'pcs'}
                                      {p.updated_price && <span style={{ color: '#10b981', fontWeight: 600, marginLeft: 4 }}>(Updated)</span>}
                                    </span>
                                  )
                                })()}

                                <div style={{ marginTop: 1 }}>
                                  {hasNoStock || isStockDepleted ? (
                                    <span style={{ color: '#b91c1c', fontWeight: 600, background: '#fee2e2', padding: '1px 5px', borderRadius: 4, fontSize: '0.68rem' }}>Out of Stock</span>
                                  ) : isLowStock ? (
                                    <span style={{ color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '1px 5px', borderRadius: 4, fontSize: '0.68rem' }}>Stock: {remainingStock}</span>
                                  ) : (
                                    <span style={{ color: '#4b5563', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: '0.68rem' }}>Stock: {remainingStock}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {alreadyAdded ? (
                                <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Added</span>
                              ) : (
                                <div style={{ background: '#f3f4f6', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                                  <Plus size={13} />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 16, alignItems: 'start' }}>
              {/* ── LEFT COLUMN (Checkout Details) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Payment & Tax Details</p>
                    <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowLeft size={13} /> Back to Cart
                    </button>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Status toggle */}
                    <div>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Payment Status</label>
                      <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                        {['unpaid', 'paid'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, status: s }))}
                            style={{
                              flex: 1, height: 30, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.15s',
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
                    <div>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>GST Tax Rate</label>
                      <select
                        name="tax_rate"
                        value={form.tax_rate}
                        onChange={e => setForm(prev => ({ ...prev, tax_rate: parseInt(e.target.value) }))}
                        style={{ ...S.input, height: 30, padding: '0 8px', fontSize: '0.8125rem' }}
                      >
                        <option value="0">0% (GST Exempt / Nil Rated)</option>
                        <option value="5">5% GST (CGST 2.5%, SGST 2.5%)</option>
                        <option value="12">12% GST (CGST 6%, SGST 6%)</option>
                        <option value="18">18% GST (CGST 9%, SGST 9%)</option>
                        <option value="28">28% GST (CGST 14%, SGST 14%)</option>
                      </select>
                    </div>

                    {/* Due date */}
                    {form.status === 'unpaid' && (
                      <div>
                        <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Due Date <span style={{ color: '#dc2626' }}>*</span></label>
                        <input name="due_date" type="date" value={form.due_date} onChange={handleChange} style={{ ...inp('due_date'), height: 30, padding: '0 8px', fontSize: '0.8125rem' }} onFocus={() => setFocus('due_date')} onBlur={() => setFocus(null)} />
                        {errors.due_date && <span style={S.error}>{errors.due_date}</span>}
                      </div>
                    )}

                    {/* Discount */}
                    <div style={form.status === 'paid' ? { gridColumn: '1 / -1' } : {}}>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Global Discount (₹)</label>
                      <input name="discount" type="number" min="0" value={form.discount === 0 ? '' : form.discount} onChange={handleChange} placeholder="0" style={{ ...inp('discount'), height: 30, padding: '0 8px', fontSize: '0.8125rem' }} onFocus={() => setFocus('discount')} onBlur={() => setFocus(null)} />
                    </div>

                    {/* Notes */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Invoice Notes / Terms</label>
                      <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Payment instructions, terms, etc." rows={2} style={{ ...inp('notes'), height: 'auto', padding: '6px 8px', fontSize: '0.8125rem', resize: 'vertical' }} onFocus={() => setFocus('notes')} onBlur={() => setFocus(null)} />
                    </div>

                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN (Cart Summary & Checkout) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Invoice Summary</p>
                  </div>

                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: '0 0 4px' }}>Customer</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', margin: 0 }}>{selectedCustomer?.name}</p>
                    {selectedCustomer?.phone && <p style={{ fontSize: '0.72rem', color: '#4b5563', margin: '2px 0 0' }}>{selectedCustomer.phone}</p>}
                  </div>

                  {/* ── Cart Items Breakdown ── */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: '0 0 6px' }}>
                      Cart Items ({lineItems.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {lineItems.map((li, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
                            <span style={{ fontWeight: 500, color: '#111827', display: 'block' }}>{li.name}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{li.qty} {li.unit} × {INR(li.price)}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: '#111827', flexShrink: 0 }}>
                            {INR(Math.max(0, (parseFloat(li.price || 0) * parseFloat(li.qty || 1)) - parseFloat(li.discount || 0)))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#4b5563' }}>
                      <span>Items Count</span>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{lineItems.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#4b5563' }}>
                      <span>Subtotal</span>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{INR(grossSubtotal)}</span>
                    </div>
                    {lineDiscounts > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#059669' }}>
                        <span>Product Discounts</span>
                        <span>- {INR(lineDiscounts)}</span>
                      </div>
                    )}
                    {discountAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#059669' }}>
                        <span>Global Discount</span>
                        <span>- {INR(discountAmt)}</span>
                      </div>
                    )}
                    {form.tax_rate > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>CGST ({form.tax_rate / 2}%)</span>
                          <span>{INR(cgst)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>SGST ({form.tax_rate / 2}%)</span>
                          <span>{INR(sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ background: '#f9fafb', padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                      <span>Total Amount</span>
                      <span style={{ fontSize: '1.1rem', color: '#2563eb' }}>{INR(total)}</span>
                    </div>
                    <button
                      type="submit"
                      disabled={saving || lineItems.length === 0}
                      className="btn-blue"
                      style={{ width: '100%', justifyContent: 'center', background: (saving || lineItems.length === 0) ? '#9ca3af' : undefined, cursor: (saving || lineItems.length === 0) ? 'not-allowed' : 'pointer' }}
                    >
                      {saving && <Loader2 size={15} className="ws-chat-loader-spin" />}
                      {saving ? 'Creating Invoice...' : 'Create Invoice'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

        </main>
      </div>

      {showQuickAdd && (
        <QuickAddPersonModal
          onClose={() => setShowQuickAdd(false)}
          onSaved={handleQuickAddSaved}
        />
      )}

      {showQuickAddProduct && (
        <QuickAddProductModal
          onClose={() => setShowQuickAddProduct(false)}
          onSaved={handleQuickAddProductSaved}
        />
      )}
    </div>
  )
}
