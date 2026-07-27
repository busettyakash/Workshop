import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info, Check, User, Package, DollarSign, FileText, ArrowRight } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails, ALL_UOM_OPTIONS } from '../../utils/unitHelpers'
import '../Dashboard/Dashboard.css'

const S = {
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: '32px',
    padding: '0 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    fontSize: '0.78rem',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputFocus: {
    borderColor: '#3d68f5',
    boxShadow: '0 0 0 3px rgba(61,104,245,0.1)',
  },
  inputError: {
    borderColor: '#dc2626',
    boxShadow: '0 0 0 3px rgba(220,38,38,0.08)',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '3px',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.72rem',
    marginTop: '2px',
    display: 'block',
  },
  field: { marginBottom: '12px' },
}

export default function ImportStockForm() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  const [form, setForm] = useState({
    buyer_name: '',
    buyer_phone: '',
    buyer_city: '',
    buyer_state: '',
    name: '',
    sku: '',
    category: '',
    buying_price: '',
    price_100: '',
    price: '',
    updated_price: '',
    updated_price_date: todayStr,
    stock: 0,
    status: 'pending',
    unit: 'kgs',
    description: '',
    bag_weight: 100
  })

  const [uomOptions, setUomOptions] = useState(ALL_UOM_OPTIONS)

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    if (id) fetchItem()

    api.get('/uoms').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const dbOptions = res.data
          .filter(u => u.code !== 'g' && u.code !== 'gm' && !u.name?.toLowerCase().includes('gram'))
          .map(u => ({
            value: u.code,
            label: `${u.name} (${u.code})`,
            category: u.category
          }))
        setUomOptions(dbOptions)
      }
    }).catch(() => { })
  }, [id, dispatch])

  const fetchItem = async () => {
    try {
      const res = await api.get(`/import-stock/${id}`)
      const item = res.data?.data
      if (item) {
        setForm({
          buyer_name: item.buyer_name || '',
          buyer_phone: item.buyer_phone || '',
          buyer_city: item.buyer_city || '',
          buyer_state: item.buyer_state || '',
          name: item.name || '',
          sku: item.sku || '',
          category: item.category || '',
          buying_price: item.buying_price || '',
          price: item.price || '',
          updated_price: item.updated_price || '',
          updated_price_date: item.updated_price_date ? String(item.updated_price_date).split('T')[0] : todayStr,
          stock: item.stock || 0,
          status: item.status || 'pending',
          unit: item.unit || 'kgs',
          description: item.description || '',
          bag_weight: item.bag_weight || 100
        })
      } else {
        dispatch(addToast({ message: 'Pending product not found', type: 'error' }))
        navigate('/import-stock')
      }
    } catch {
      dispatch(addToast({ message: 'Failed to load pending product', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const generateSKU = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let rand = ''
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `SKU-${rand}`
  }

  const handleGenerateMainSKU = () => {
    const code = generateSKU()
    setForm(prev => ({ ...prev, sku: code }))
    dispatch(addToast({ message: `Generated SKU: ${code}`, type: 'info' }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validateStep1 = () => {
    const err = {}
    if (form.buyer_phone && !/^[0-9+\-\s()]{7,15}$/.test(form.buyer_phone.trim())) {
      err.buyer_phone = 'Enter a valid phone number'
    }
    setErrors(err)
    return Object.keys(err).length === 0
  }

  const validateStep2 = () => {
    const err = {}
    const bulkUnit = getBulkUnitDetails(form.unit)
    if (!form.name.trim()) err.name = 'Product name is required'
    if (!form.price || isNaN(form.price) || parseFloat(form.price) <= 0) err.price = 'Enter a valid selling price'
    if (bulkUnit && (!form.bag_weight || isNaN(form.bag_weight) || parseFloat(form.bag_weight) <= 0)) {
      err.bag_weight = `Enter a valid ${bulkUnit.label.toLowerCase()} size (e.g. 25)`
    }
    setErrors(err)
    return Object.keys(err).length === 0
  }

  const handleNextStep1 = () => {
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handleNextStep2 = () => {
    if (validateStep2()) {
      setStep(3)
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!validateStep2()) {
      setStep(2)
      return
    }

    setSaving(true)
    try {
      if (id) {
        await api.put(`/import-stock/${id}`, form)
        dispatch(addToast({ message: 'Stock product updated successfully!', type: 'success' }))
      } else {
        await api.post('/import-stock', form)
        dispatch(addToast({ message: 'Stock product added successfully!', type: 'success' }))
      }
      navigate('/import-stock')
    } catch {
      dispatch(addToast({ message: 'Failed to save product', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  // Unit rate and margin calculations
  const bw = parseFloat(form.bag_weight || 100)
  const sell100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / bw) * 100) : 0))
  const buy100 = parseFloat(form.buying_price || 0)
  const sellRatePerUnit = sell100 > 0 ? (sell100 / 100).toFixed(2) : '0.00'
  const buyRatePerUnit = buy100 > 0 ? (buy100 / 100).toFixed(2) : '0.00'
  const profitMarginPer100 = buy100 > 0 && sell100 > 0 ? (sell100 - buy100).toFixed(2) : null
  const profitMarginPerUnit = buy100 > 0 && sell100 > 0 ? ((sell100 - buy100) / 100).toFixed(2) : null

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">

          {/* ── Top Bar Header (Quotes Style) ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {id ? 'Edit Import Stock Product' : 'Add Import Stock Product'}
              </h2>
              <span className="attio-badge attio-badge-blue" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                {form.status ? (form.status.charAt(0).toUpperCase() + form.status.slice(1)) : 'Draft'}
              </span>
            </div>

            <button
              type="button"
              className="attio-btn attio-btn-primary"
              onClick={() => navigate('/import-stock')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 12px' }}
            >
              <ArrowLeft size={13} /> Back to Import Stock
            </button>
          </div>

          {/* ── Stepper Navigation Bar (Increased box sizes by 2%) ── */}
          <div className="attio-table-card" style={{ padding: '8px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 700, margin: '0 auto 16px', boxSizing: 'border-box', flexWrap: 'nowrap', gap: 10 }}>
            <div
              onClick={() => setStep(1)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                background: step === 1 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 1 ? '#2563eb' : '#e2e8f0'}`
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 1 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>1</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 1 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
                Step 1: Supplier & Buyer Details
              </div>
            </div>

            <ArrowRight size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />

            <div
              onClick={() => { if (validateStep1()) setStep(2) }}
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
              onClick={() => { if (validateStep1() && validateStep2()) setStep(3) }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                background: step === 3 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 3 ? '#2563eb' : '#e2e8f0'}`
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 3 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>3</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 3 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
                Step 3: Review & Save
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={28} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : (
            <div>

              {/* ── STEP 1: Supplier & Buyer Details (4-column row 1 + Stock Status bottom Box 1) ── */}
              {step === 1 && (
                <div className="attio-table-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Supplier / Buyer Name
                      </label>
                      <input
                        name="buyer_name"
                        value={form.buyer_name}
                        onChange={handleChange}
                        placeholder="e.g. Lalitha Traders / John Doe"
                        style={inp('buyer_name')}
                        onFocus={() => setFocus('buyer_name')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Phone Number
                      </label>
                      <input
                        name="buyer_phone"
                        value={form.buyer_phone}
                        onChange={handleChange}
                        placeholder="e.g. +91 9876543210"
                        style={inp('buyer_phone')}
                        onFocus={() => setFocus('buyer_phone')}
                        onBlur={() => setFocus(null)}
                      />
                      {errors.buyer_phone && <span style={S.error}>{errors.buyer_phone}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        City
                      </label>
                      <input
                        name="buyer_city"
                        value={form.buyer_city}
                        onChange={handleChange}
                        placeholder="e.g. Hyderabad / Vijayawada"
                        style={inp('buyer_city')}
                        onFocus={() => setFocus('buyer_city')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        State
                      </label>
                      <input
                        name="buyer_state"
                        value={form.buyer_state}
                        onChange={handleChange}
                        placeholder="e.g. Telangana / Andhra Pradesh"
                        style={inp('buyer_state')}
                        onFocus={() => setFocus('buyer_state')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ width: 'calc(25% - 9px)' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Stock Status
                      </label>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                        style={{ ...inp('status'), cursor: 'pointer', background: '#fff' }}
                        onFocus={() => setFocus('status')}
                        onBlur={() => setFocus(null)}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="attio-btn attio-btn-primary"
                      onClick={handleNextStep1}
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

              {/* ── STEP 2: Products & Line Items (Quotes Style) ── */}
              {step === 2 && (
                <div className="attio-table-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Product Name *</label>
                      <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Lalitha-Rice / Wireless Mouse" style={inp('name')} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
                      {errors.name && <span style={S.error}>{errors.name}</span>}
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 0 }}>HSN Code</label>
                        <button
                          type="button"
                          onClick={() => {
                            const code = String(Math.floor(10000000 + Math.random() * 90000000))
                            setForm(prev => ({ ...prev, hsn_code: code, sku: code }))
                          }}
                          style={{ background: 'none', border: 'none', color: '#3d68f5', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Auto Generate
                        </button>
                      </div>
                      <input name="hsn_code" value={form.hsn_code || form.sku || ''} onChange={e => setForm({ ...form, hsn_code: e.target.value, sku: e.target.value })} placeholder="e.g. 10064000" style={{ ...inp('hsn_code'), fontFamily: 'monospace', color: '#475569', fontWeight: 600 }} onFocus={() => setFocus('hsn_code')} onBlur={() => setFocus(null)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Category</label>
                      <input name="category" value={form.category} onChange={handleChange} placeholder="e.g. Food / Rice" style={inp('category')} onFocus={() => setFocus('category')} onBlur={() => setFocus(null)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Unit of Measure (UOM)</label>
                      <select
                        name="unit"
                        value={form.unit}
                        onChange={handleChange}
                        style={{ ...inp('unit'), cursor: 'pointer', background: '#fff' }}
                        onFocus={() => setFocus('unit')}
                        onBlur={() => setFocus(null)}
                      >
                        {uomOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Buyer Price (100 Units, ₹)</label>
                      <input
                        name="buying_price"
                        type="number"
                        step="0.01"
                        value={form.buying_price}
                        onChange={handleChange}
                        placeholder="e.g. 5500"
                        style={inp('buying_price')}
                        onFocus={() => setFocus('buying_price')}
                        onBlur={() => setFocus(null)}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                        {form.buying_price ? `₹${(parseFloat(form.buying_price) / 100).toFixed(2)} / ${getBulkUnitDetails(form.unit)?.short || 'unit'} cost` : 'Purchase cost paid to supplier'}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>My Selling Price (100 Units, ₹) *</label>
                      <input
                        name="price_100"
                        type="number"
                        step="0.01"
                        value={form.price_100 !== undefined ? form.price_100 : (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : '')}
                        onChange={(e) => {
                          const val = e.target.value
                          const bw = parseFloat(form.bag_weight || 100)
                          const calculatedPrice = val ? ((parseFloat(val) / 100) * bw).toFixed(2) : ''
                          setForm(prev => ({ ...prev, price_100: val, price: calculatedPrice }))
                          if (errors.price) setErrors(prev => ({ ...prev, price: '' }))
                        }}
                        placeholder="e.g. 6150"
                        style={inp('price_100')}
                        onFocus={() => setFocus('price_100')}
                        onBlur={() => setFocus(null)}
                      />
                      {errors.price && <span style={S.error}>{errors.price}</span>}
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                        {sell100 > 0 ? `₹${(sell100 / 100).toFixed(2)} / ${getBulkUnitDetails(form.unit)?.short || 'unit'} selling rate` : 'Base market price'}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Pack Weight ({getBulkUnitDetails(form.unit)?.short || 'kg'}) *</label>
                      <input
                        name="bag_weight"
                        type="number"
                        step="0.1"
                        value={form.bag_weight}
                        onChange={(e) => {
                          const bw = e.target.value
                          const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                          const calculatedPrice = p100 && bw ? ((p100 / 100) * parseFloat(bw)).toFixed(2) : form.price
                          setForm(prev => ({ ...prev, bag_weight: bw, price: calculatedPrice }))
                          if (errors.bag_weight) setErrors(prev => ({ ...prev, bag_weight: '' }))
                        }}
                        placeholder="e.g. 10, 25, 50, 100"
                        style={inp('bag_weight')}
                        onFocus={() => setFocus('bag_weight')}
                        onBlur={() => setFocus(null)}
                      />
                      {getBulkUnitDetails(form.unit)?.quickSizes && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {getBulkUnitDetails(form.unit).quickSizes.map(size => {
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
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: isSelected ? '1px solid #3d68f5' : '1px solid #e5e7eb',
                                  background: isSelected ? '#eff6ff' : '#f9fafb',
                                  color: isSelected ? '#3d68f5' : '#4b5563',
                                  fontSize: '0.7rem',
                                  fontWeight: isSelected ? 600 : 500,
                                  cursor: 'pointer'
                                }}
                              >
                                {size}{getBulkUnitDetails(form.unit).short}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {errors.bag_weight && <span style={S.error}>{errors.bag_weight}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Stock Quantity ({getBulkUnitDetails(form.unit)?.pluralName || 'Units'})</label>
                      <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" style={inp('stock')} onFocus={() => setFocus('stock')} onBlur={() => setFocus(null)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Updated Price (₹)</label>
                      <input
                        name="updated_price"
                        type="number"
                        step="0.01"
                        value={form.updated_price}
                        onChange={(e) => {
                          const val = e.target.value
                          setForm(prev => ({
                            ...prev,
                            updated_price: val,
                            updated_price_date: val ? todayStr : prev.updated_price_date
                          }))
                        }}
                        placeholder="e.g. 6000"
                        style={inp('updated_price')}
                        onFocus={() => setFocus('updated_price')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Updated Date</label>
                      <input
                        name="updated_price_date"
                        type="date"
                        value={form.updated_price_date}
                        onChange={handleChange}
                        style={inp('updated_price_date')}
                        onFocus={() => setFocus('updated_price_date')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Description / Notes</label>
                    <textarea name="description" value={form.description} onChange={handleChange} placeholder="Add product notes or batch details..." rows={2} style={{ ...inp('description'), height: 'auto', padding: '6px 8px', resize: 'vertical' }} onFocus={() => setFocus('description')} onBlur={() => setFocus(null)} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{ height: 34, padding: '0 16px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', color: '#4b5563', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' }}
                    >
                      ← Back to Supplier Info
                    </button>

                    <button
                      type="button"
                      className="attio-btn attio-btn-primary"
                      onClick={handleNextStep2}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 6, height: 34, cursor: 'pointer' }}
                    >
                      Next: Review & Save <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Summary & Confirmation (Quotes Style) ── */}
              {step === 3 && (
                <div className="attio-table-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10, marginBottom: 10 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: 0 }}>Review Import Stock Summary</h2>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0' }}>Confirm supplier details, unit pricing, profit margins, and stock quantities before saving.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 8 }}>
                        Supplier / Buyer Details
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div><strong style={{ color: '#1e293b' }}>Name:</strong> {form.buyer_name || 'Not provided'}</div>
                        <div><strong style={{ color: '#1e293b' }}>Phone:</strong> {form.buyer_phone || 'Not provided'}</div>
                        <div><strong style={{ color: '#1e293b' }}>Location:</strong> {[form.buyer_city, form.buyer_state].filter(Boolean).join(', ') || 'Not provided'}</div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 8 }}>
                        Product Specifications
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div><strong style={{ color: '#1e293b' }}>Product Name:</strong> {form.name}</div>
                        <div><strong style={{ color: '#1e293b' }}>SKU / Barcode:</strong> {form.sku || 'N/A'}</div>
                        <div><strong style={{ color: '#1e293b' }}>Category:</strong> {form.category || 'General'}</div>
                        <div><strong style={{ color: '#1e293b' }}>Pack Weight:</strong> {form.bag_weight} {getBulkUnitDetails(form.unit)?.short || form.unit} per pack</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: '0.85rem' }}>
                        Pricing & Unit Rate Analysis
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Buyer Price (Supplier)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                          {form.buying_price ? `₹${parseFloat(form.buying_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                          ₹{parseFloat(buyRatePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {getBulkUnitDetails(form.unit)?.short || 'unit'} cost
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Selling Price (My Rate)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                          ₹{sell100 > 0 ? sell100.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                          ₹{parseFloat(sellRatePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {getBulkUnitDetails(form.unit)?.short || 'unit'} selling
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Updated Market Price</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#059669' }}>
                          {form.updated_price ? `₹${parseFloat(form.updated_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                          {form.updated_price_date ? `as of ${form.updated_price_date}` : 'No revision'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Total Inventory Stock</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>
                        {form.stock} {getBulkUnitDetails(form.unit)?.pluralName || 'Bags / Units'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#2563eb' }}>
                      <div>Pack Size: <strong>{form.bag_weight} {getBulkUnitDetails(form.unit)?.short || 'kg'}</strong> / pack</div>
                      <div>Total Weight: <strong>{(parseFloat(form.stock || 0) * bw).toLocaleString('en-IN')} {getBulkUnitDetails(form.unit)?.short || 'kg'}</strong></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{ height: 34, padding: '0 16px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', color: '#4b5563', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' }}
                    >
                      ← Back to Product Details
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={saving}
                      className="attio-btn attio-btn-primary"
                      style={{ height: 34, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
                    >
                      {saving && <Loader2 size={15} className="ws-chat-loader-spin" />}
                      {saving ? 'Saving Product...' : (id ? 'Update Product' : 'Save Product to Stock')}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  )
}
