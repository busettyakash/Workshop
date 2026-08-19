import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info, Check, User, Package, DollarSign, FileText, ArrowRight } from 'lucide-react'
import api from '../../api/client'
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
    price_covers: '',
    price_100: '',
    price: '',
    updated_price: '',
    updated_price_date: todayStr,
    stock: 0,
    status: 'pending',
    unit: '',
    description: '',
    bag_weight: ''
  })

  const [uomRecords, setUomRecords] = useState([])
  const [uomOptions, setUomOptions] = useState([])

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    if (id) fetchItem()

    api.get('/uoms').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const activeUnits = res.data.filter(u => u.status !== 'Inactive')
        setUomRecords(activeUnits)
        const dbOptions = activeUnits.map(u => ({
          value: u.code,
          label: `${u.name} (${u.code})`,
          category: u.category
        }))
        setUomOptions(dbOptions)
        if (!id && activeUnits.length > 0) {
          const firstUom = activeUnits[0]
          const presets = firstUom?.presets ? String(firstUom.presets).split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0) : []
          const initialWeight = presets.length > 0 ? presets[0] : 1
          setForm(prev => ({
            ...prev,
            unit: firstUom.code,
            bag_weight: prev.bag_weight || initialWeight,
            price_covers: prev.price_covers || initialWeight
          }))
        }
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
          price_covers: item.price_covers !== undefined && item.price_covers !== null ? item.price_covers : '',
          price: item.price || '',
          updated_price: item.updated_price || '',
          updated_price_100: (() => {
            const up = parseFloat(item.updated_price || 0)
            const bw = parseFloat(item.bag_weight || 1)
            const pc = parseFloat(item.price_covers || 0)
            if (up > 0 && pc > 0 && bw > 0 && pc !== bw) {
              return ((up / bw) * pc).toFixed(2)
            }
            return up > 0 ? up.toFixed(2) : ''
          })(),
          updated_price_date: item.updated_price_date ? String(item.updated_price_date).split('T')[0] : todayStr,
          stock: item.stock || 0,
          initial_stock: item.stock || 0,
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

  const currentUomObj = React.useMemo(() => {
    return uomRecords.find(u => u.code?.toLowerCase() === String(form.unit || '').toLowerCase().trim())
  }, [uomRecords, form.unit])

  const uomPresets = React.useMemo(() => {
    if (!currentUomObj?.presets) return []
    return String(currentUomObj.presets)
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
  }, [currentUomObj])

  const uomShort = currentUomObj?.code || form.unit || 'unit'
  const uomName = currentUomObj?.name || form.unit || 'Unit'
  const isBulkUom = Boolean(currentUomObj?.is_bulk)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'unit') {
      const matchedUom = uomRecords.find(u => u.code?.toLowerCase() === String(value).toLowerCase().trim())
      const presets = matchedUom?.presets ? String(matchedUom.presets).split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0) : []
      const nextBw = presets.length > 0 ? presets[0] : ''
      const nextPc = presets.length > 0 ? presets[0] : ''

      setForm(prev => {
        const pc = parseFloat(nextPc || prev.price_covers || 1)
        const bwVal = parseFloat(nextBw || prev.bag_weight || 1)
        let calculatedPrice = prev.price
        if (prev.price_100 && !isNaN(prev.price_100)) {
          const p100 = parseFloat(prev.price_100)
          calculatedPrice = pc > 0 ? ((p100 / pc) * bwVal).toFixed(2) : p100.toFixed(2)
        }
        return {
          ...prev,
          unit: value,
          bag_weight: nextBw || prev.bag_weight,
          price_covers: nextPc || prev.price_covers,
          price: calculatedPrice
        }
      })
      if (errors.unit) setErrors(prev => ({ ...prev, unit: '' }))
      return
    }

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
    if (!form.name.trim()) err.name = 'Product name is required'
    if (!form.price || isNaN(form.price) || parseFloat(form.price) <= 0) err.price = 'Enter a valid selling price'
    if (isBulkUom && (!form.bag_weight || isNaN(form.bag_weight) || parseFloat(form.bag_weight) <= 0)) {
      err.bag_weight = `Enter a valid pack size / capacity (${uomShort})`
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
      const unitShort = uomShort
      const unitPlural = uomName

      const noteBody = `=== REVIEW IMPORT STOCK SUMMARY ===

SUPPLIER / BUYER DETAILS:
Name: ${form.buyer_name || 'Not provided'}
Phone: ${form.buyer_phone || 'Not provided'}
Location: ${[form.buyer_city, form.buyer_state].filter(Boolean).join(', ') || 'Not provided'}

PRODUCT SPECIFICATIONS:
Product Name: ${form.name}
SKU / Barcode: ${form.sku || 'N/A'}
Category: ${form.category || 'General'}
Pack Weight: ${form.bag_weight} ${unitShort} per pack

PRICING & UNIT RATE ANALYSIS:
Buyer Price (Supplier): ₹${form.buying_price ? parseFloat(form.buying_price).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'} (₹${buyRatePerUnit} / ${unitShort} cost)
Updated Market Price: ${form.updated_price ? `₹${parseFloat(form.updated_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}

TOTAL INVENTORY STOCK:
Amount of Bags: ${form.stock} ${unitPlural}
Pack Size: ${form.bag_weight} ${unitShort} / pack
Total Weight: ${(parseFloat(form.stock || 0) * bw).toLocaleString('en-IN')} ${unitShort}`

      const payload = { ...form, note: noteBody }
      let res
      if (id) {
        res = await api.put(`/import-stock/${id}`, payload)
        dispatch(addToast({ message: 'Stock product updated successfully!', type: 'success' }))
      } else {
        res = await api.post('/import-stock', payload)
        dispatch(addToast({ message: 'Stock product added successfully!', type: 'success' }))
      }

      navigate('/import-stock')
    } catch (err) {
      console.error('Failed to save import stock product:', err)
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
  const bw = parseFloat(form.bag_weight || 1)
  const pc = parseFloat(form.price_covers) || 0
  const rawPrice = parseFloat(form.price || 0)

  // Calculate displaying Selling Price for the form input
  const sellPriceDisplay = form.price_100 !== undefined && form.price_100 !== ''
    ? form.price_100
    : (rawPrice > 0 ? (pc > 0 && bw > 0 && pc !== bw ? ((rawPrice / bw) * pc).toFixed(2) : rawPrice.toFixed(2)) : '')

  const sell100 = parseFloat(sellPriceDisplay) || 0

  const sellRatePerUnit = sell100 > 0
    ? (pc > 0 ? (sell100 / pc).toFixed(2) : (bw > 0 ? (sell100 / bw).toFixed(2) : '0.00'))
    : (rawPrice > 0 ? (bw > 0 ? (rawPrice / bw).toFixed(2) : rawPrice.toFixed(2)) : '0.00')
  const buyRatePerUnit = parseFloat(form.buying_price || 0) > 0
    ? (pc > 0 ? (parseFloat(form.buying_price) / pc).toFixed(2) : (bw > 0 ? (parseFloat(form.buying_price) / bw).toFixed(2) : '0.00'))
    : '0.00'

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
                        placeholder="Supplier / Buyer Name"
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
                        placeholder="Phone Number"
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
                        placeholder="City"
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
                        placeholder="State"
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
                      <input name="name" value={form.name} onChange={handleChange} placeholder="Product Name" style={inp('name')} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
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
                      <input name="hsn_code" value={form.hsn_code || form.sku || ''} onChange={e => setForm({ ...form, hsn_code: e.target.value, sku: e.target.value })} placeholder="HSN Code / SKU" style={{ ...inp('hsn_code'), fontFamily: 'monospace', color: '#475569', fontWeight: 600 }} onFocus={() => setFocus('hsn_code')} onBlur={() => setFocus(null)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Category</label>
                      <input name="category" value={form.category} onChange={handleChange} placeholder="Category" style={inp('category')} onFocus={() => setFocus('category')} onBlur={() => setFocus(null)} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Unit of Measure (UOM)</label>
                        {uomOptions.length === 0 && (
                          <a
                            href="/settings?tab=uom"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            + Add UOM in Settings
                          </a>
                        )}
                      </div>
                      <select
                        name="unit"
                        value={form.unit}
                        onChange={handleChange}
                        style={{ ...inp('unit'), cursor: 'pointer', background: '#fff' }}
                        onFocus={() => setFocus('unit')}
                        onBlur={() => setFocus(null)}
                      >
                        {uomOptions.length === 0 ? (
                          <option value="">-- No UOM found (Create in Settings &gt; UOM) --</option>
                        ) : (
                          <>
                            <option value="" disabled>-- Select Unit of Measure --</option>
                            {uomOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {uomOptions.length === 0 && (
                        <span style={{ fontSize: '0.70rem', color: '#dc2626', marginTop: 3, display: 'block' }}>
                          ⚠️ No measurement units created yet. Please add your units in Settings &gt; UOM.
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Buyer Price (₹)</label>
                      <input
                        name="buying_price"
                        type="number"
                        step="0.01"
                        value={form.buying_price}
                        onChange={handleChange}
                        placeholder="Buying Price"
                        style={inp('buying_price')}
                        onFocus={() => setFocus('buying_price')}
                        onBlur={() => setFocus(null)}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                        {form.buying_price ? `₹${(parseFloat(form.buying_price) / parseFloat(form.price_covers || 1)).toFixed(2)} / ${uomShort} cost` : 'Purchase cost paid to supplier'}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Price Covers ({uomShort})</label>
                      <input
                        name="price_covers"
                        type="number"
                        step="0.1"
                        value={form.price_covers}
                        onChange={handleChange}
                        placeholder="Price Covers Qty"
                        style={inp('price_covers')}
                        onFocus={() => setFocus('price_covers')}
                        onBlur={() => setFocus(null)}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                        Quantity covered by the price rate
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>My Selling Price (₹) *</label>
                      <input
                        name="price_100"
                        type="number"
                        step="0.01"
                        value={sellPriceDisplay}
                        onChange={(e) => {
                          const val = e.target.value
                          const bw = parseFloat(form.bag_weight || 1)
                          const pc = parseFloat(form.price_covers || 0)
                          const calculatedPrice = val
                            ? (pc > 0 ? ((parseFloat(val) / pc) * bw).toFixed(2) : parseFloat(val).toFixed(2))
                            : ''
                          setForm(prev => ({ ...prev, price_100: val, price: calculatedPrice }))
                          if (errors.price) setErrors(prev => ({ ...prev, price: '' }))
                        }}
                        placeholder="Selling Price"
                        style={inp('price_100')}
                        onFocus={() => setFocus('price_100')}
                        onBlur={() => setFocus(null)}
                      />
                      {errors.price && <span style={S.error}>{errors.price}</span>}
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                        {sellRatePerUnit > 0 ? `₹${sellRatePerUnit} / ${uomShort} rate` : 'Base market price'}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        {isBulkUom ? `Package Weight / Capacity (${uomShort}) *` : `Pack Size (${uomShort}) *`}
                      </label>
                      <input
                        name="bag_weight"
                        type="number"
                        step="0.1"
                        value={form.bag_weight}
                        onChange={(e) => {
                          const bw = e.target.value
                          const pc = parseFloat(form.price_covers || 0)
                          const bwVal = parseFloat(bw || 1)
                          let calculatedPrice = form.price
                          if (form.price_100 && !isNaN(form.price_100)) {
                            const p100 = parseFloat(form.price_100)
                            calculatedPrice = pc > 0 ? ((p100 / pc) * bwVal).toFixed(2) : p100.toFixed(2)
                          }
                          setForm(prev => ({ ...prev, bag_weight: bw, price: calculatedPrice }))
                          if (errors.bag_weight) setErrors(prev => ({ ...prev, bag_weight: '' }))
                        }}
                        placeholder="Pack Size / Weight"
                        style={inp('bag_weight')}
                        onFocus={() => setFocus('bag_weight')}
                        onBlur={() => setFocus(null)}
                      />
                      {uomPresets.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {uomPresets.map(size => {
                            const isSelected = Number(form.bag_weight) === size
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  const pc = parseFloat(form.price_covers || 0)
                                  let calculatedPrice = form.price
                                  if (form.price_100 && !isNaN(form.price_100)) {
                                    const p100 = parseFloat(form.price_100)
                                    calculatedPrice = pc > 0 ? ((p100 / pc) * size).toFixed(2) : p100.toFixed(2)
                                  }
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
                                {size}{uomShort}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {errors.bag_weight && <span style={S.error}>{errors.bag_weight}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Initial Purchased Quantity ({uomName})
                      </label>
                      <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" style={inp('stock')} onFocus={() => setFocus('stock')} onBlur={() => setFocus(null)} />
                      <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                        Total batch quantity imported from supplier
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>Updated Price (₹)</label>
                      <input
                        name="updated_price_100"
                        type="number"
                        step="0.01"
                        value={form.updated_price_100 ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          const p100val = parseFloat(val || 0)
                          const bwVal = parseFloat(form.bag_weight || 1)
                          const pcVal = parseFloat(form.price_covers || 0)
                          // Convert price_covers rate → bag price for storage
                          const bagPrice = (p100val > 0 && pcVal > 0 && bwVal > 0 && pcVal !== bwVal)
                            ? ((p100val / pcVal) * bwVal).toFixed(2)
                            : val
                          setForm(prev => ({
                            ...prev,
                            updated_price_100: val,
                            updated_price: bagPrice,
                            updated_price_date: todayStr
                          }))
                        }}
                        placeholder={pc > 0 ? `Price for ${pc}kg` : '3300'}
                        style={inp('updated_price_100')}
                        onFocus={() => setFocus('updated_price_100')}
                        onBlur={() => setFocus(null)}
                      />
                      {form.updated_price_100 && parseFloat(form.updated_price_100) > 0 && pc > 0 && (
                        <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                          ₹{(parseFloat(form.updated_price_100) / pc).toFixed(2)} / kg rate
                        </span>
                      )}
                      <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1, display: 'block' }}>
                        Auto-applies today's date ({todayStr})
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Add New Stock to Inventory ({uomName})
                      </label>
                      <input
                        name="add_stock_qty"
                        type="number"
                        step="0.01"
                        value={form.add_stock_qty || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setForm(prev => ({
                            ...prev,
                            add_stock_qty: val
                          }))
                        }}
                        placeholder="Quantity to add to stock"
                        style={inp('add_stock_qty')}
                        onFocus={() => setFocus('add_stock_qty')}
                        onBlur={() => setFocus(null)}
                      />
                      <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                        Adds directly to total stock
                      </span>
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
                        <div><strong style={{ color: '#1e293b' }}>Pack Weight:</strong> {form.bag_weight} {uomShort} per pack</div>
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
                          ₹{parseFloat(buyRatePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uomShort} cost
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Selling Price (My Rate)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                          ₹{sell100 > 0 ? sell100.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                          ₹{parseFloat(sellRatePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uomShort} selling
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
                      <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>
                        Total Inventory Stock
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>
                        {form.add_stock_qty && parseFloat(form.add_stock_qty) > 0 ? (
                          <span>
                            Total After Addition: <strong style={{ color: '#15803d' }}>{(parseFloat(form.initial_stock ?? form.stock ?? 0) + parseFloat(form.add_stock_qty || 0))} {uomName}</strong>
                          </span>
                        ) : (
                          <span>{form.stock} {uomName}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#2563eb' }}>
                      <div>Initial Batch Qty: <strong>{form.initial_stock ?? form.stock} {uomName}</strong></div>
                      {form.add_stock_qty && parseFloat(form.add_stock_qty) > 0 && (
                        <div style={{ color: '#15803d', fontWeight: 600 }}>Adding to Stock: <strong>+{form.add_stock_qty} {uomName}</strong></div>
                      )}
                      <div>Pack Size: <strong>{form.bag_weight} {uomShort}</strong> / pack</div>
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
