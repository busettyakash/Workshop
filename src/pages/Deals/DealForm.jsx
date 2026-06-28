import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info, Plus, Trash2, X } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

const STAGE_OPTIONS = ['Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
const STATUS_OPTIONS = ['active', 'inactive']

const S = {
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: '40px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.875rem',
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
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.75rem',
    marginTop: '4px',
    display: 'block',
  },
  field: { marginBottom: '20px' },
}

export default function DealForm() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  const [storeProducts, setStoreProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedProdId, setSelectedProdId] = useState('')
  const [autoApplied, setAutoApplied] = useState(false)

  const [form, setForm] = useState({
    title: '', value: 0, owner: '', close_date: '', stage: 'Discovery', status: 'active', notes: '',
    products: [], discount: 0, company_id: ''
  })

  useEffect(() => {
    dispatch(setActiveNav('Deals'))
    fetchStoreProducts()
    fetchCompanies()
    if (id) fetchDeal()
  }, [id, dispatch])

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies')
      setCompanies(res.data?.data || [])
    } catch (err) {
      console.error('Failed to load companies', err)
    }
  }

  const fetchStoreProducts = async () => {
    try {
      const res = await api.get('/products?status=active&limit=100')
      setStoreProducts(res.data?.data || [])
    } catch (err) {
      console.error('Failed to load active products', err)
    }
  }

  const fetchDeal = async () => {
    try {
      const res = await api.get(`/deals/${id}`)
      const item = res.data?.data
      if (item) {
        let formattedDate = ''
        if (item.close_date) {
          formattedDate = new Date(item.close_date).toISOString().split('T')[0]
        }

        let parsedProducts = []
        if (item.products) {
          if (typeof item.products === 'string') {
            try { parsedProducts = JSON.parse(item.products) } catch (e) {}
          } else if (Array.isArray(item.products)) {
            parsedProducts = item.products
          }
        }

        setForm({
          title: item.title || '',
          value: parseFloat(item.value) || 0,
          owner: item.owner || '',
          close_date: formattedDate,
          stage: item.stage || 'Discovery',
          status: item.status || 'active',
          notes: item.notes || '',
          products: parsedProducts,
          discount: parseFloat(item.discount) || 0,
          company_id: item.company_id || ''
        })
      } else {
        dispatch(addToast({ message: 'Deal not found', type: 'error' }))
        navigate('/deals')
      }
    } catch {
      dispatch(addToast({ message: 'Failed to load deal details', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let newForm = { ...form, [name]: value }

    if (name === 'title') {
      const match = value.match(/(\d+)\s*%/)
      if (match) {
        const parsedDiscount = Math.min(100, Math.max(0, parseInt(match[1]) || 0))
        newForm.discount = parsedDiscount
        setAutoApplied(true)
      } else {
        setAutoApplied(false)
      }
    }

    setForm(newForm)
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleAddProduct = () => {
    if (!selectedProdId) return
    const prod = storeProducts.find(p => p.id === parseInt(selectedProdId))
    if (!prod) return
    const exists = form.products.find(p => p.id === prod.id)
    if (exists) {
      dispatch(addToast({ message: 'Product already added. Adjust quantity below.', type: 'info' }))
      return
    }

    const stock = parseInt(prod.stock) || 0
    if (stock <= 0) {
      dispatch(addToast({ message: `Product "${prod.name}" is out of stock.`, type: 'error' }))
      return
    }

    const newProd = {
      id: prod.id,
      name: prod.name,
      price: parseFloat(prod.price) || 0,
      quantity: 1
    }
    setForm(prev => ({
      ...prev,
      products: [...prev.products, newProd]
    }))
    setSelectedProdId('')
  }

  const handleQuantityChange = (prodId, qty) => {
    const storeProd = storeProducts.find(p => p.id === prodId)
    const stock = storeProd ? (parseInt(storeProd.stock) || 0) : Infinity

    let cleanQty = Math.max(1, parseInt(qty) || 1)
    if (storeProd && cleanQty > stock) {
      cleanQty = stock
      dispatch(addToast({ message: `Only ${stock} units available in stock`, type: 'info' }))
    }

    setForm(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === prodId ? { ...p, quantity: cleanQty } : p)
    }))
  }

  const handleRemoveProduct = (prodId) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== prodId)
    }))
  }

  const subtotal = form.products.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
  const calculatedValue = subtotal * (1 - (parseFloat(form.discount) || 0) / 100)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.title.trim()) err.title = 'Deal Title is required'
    if (!form.company_id) err.company_id = 'Company is required'
    if (Object.keys(err).length) { setErrors(err); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        value: calculatedValue
      }
      if (id) {
        await api.put(`/deals/${id}`, payload)
        dispatch(addToast({ message: 'Deal updated successfully!', type: 'success' }))
      } else {
        await api.post('/deals', payload)
        dispatch(addToast({ message: 'Deal added successfully!', type: 'success' }))
      }
      navigate('/deals')
    } catch {
      dispatch(addToast({ message: 'Failed to save deal details', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <button
              onClick={() => navigate('/deals')}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                {id ? 'Edit Deal' : 'Add Deal'}
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>
                Deals / {id ? 'Edit' : 'Add'}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={28} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

              {/* Left Column: Input Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Deal Information */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Deal Information</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={S.field}>
                      <label style={S.label}>Company <span style={{ color: '#dc2626' }}>*</span></label>
                      <select 
                        name="company_id" 
                        value={form.company_id} 
                        onChange={e => {
                          const val = e.target.value || ''
                          setForm(prev => ({ ...prev, company_id: val }))
                          if (errors.company_id) setErrors(prev => ({ ...prev, company_id: '' }))
                        }} 
                        style={{ ...S.input, cursor: 'pointer', ...(errors.company_id ? S.inputError : {}) }}
                      >
                        <option value="">-- Select Company --</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {errors.company_id && <span style={S.error}>{errors.company_id}</span>}
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Deal Title <span style={{ color: '#dc2626' }}>*</span></label>
                      <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Enterprise License (10% Discount)" style={inp('title')} onFocus={() => setFocus('title')} onBlur={() => setFocus(null)} />
                      {errors.title && <span style={S.error}>{errors.title}</span>}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={S.label}>Subtotal (₹)</label>
                        <input type="text" value={subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly style={{ ...inp('subtotal'), background: '#f9fafb', cursor: 'not-allowed' }} />
                      </div>
                      <div>
                        <label style={S.label}>Discount (%)</label>
                        <input 
                          name="discount" 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={form.discount} 
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                            setForm(prev => ({ ...prev, discount: val }))
                            setAutoApplied(false)
                          }} 
                          style={inp('discount')} 
                          onFocus={() => setFocus('discount')} 
                          onBlur={() => setFocus(null)} 
                        />
                        {autoApplied && <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 500, marginTop: 4, display: 'block' }}>Auto-applied from title</span>}
                      </div>
                      <div>
                        <label style={S.label}>Final Value (₹)</label>
                        <input type="text" value={calculatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly style={{ ...inp('value'), background: '#f9fafb', cursor: 'not-allowed', fontWeight: 600, color: '#3d68f5' }} />
                      </div>
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Owner</label>
                      <input name="owner" type="text" value={form.owner} onChange={handleChange} placeholder="Your name" style={inp('owner')} onFocus={() => setFocus('owner')} onBlur={() => setFocus(null)} />
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Close Date</label>
                      <input name="close_date" type="date" value={form.close_date} onChange={handleChange} style={inp('close_date')} onFocus={() => setFocus('close_date')} onBlur={() => setFocus(null)} />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={S.label}>Notes</label>
                      <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Add optional details or history..." rows={3} style={{ ...inp('notes'), height: 'auto', padding: '10px 12px', resize: 'vertical' }} onFocus={() => setFocus('notes')} onBlur={() => setFocus(null)} />
                    </div>
                  </div>
                </div>

                {/* Deal Products */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginTop: 20 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Deal Products</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    {/* Selector */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                      <select 
                        value={selectedProdId} 
                        onChange={e => setSelectedProdId(e.target.value)} 
                        style={{ ...S.input, flex: 1, cursor: 'pointer' }}
                      >
                        <option value="">-- Select Product to Add --</option>
                        {storeProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (₹{parseFloat(p.price).toLocaleString('en-IN')})</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={handleAddProduct}
                        style={{ 
                          padding: '0 16px', 
                          height: 40, 
                          background: '#3d68f5', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          fontSize: '0.875rem', 
                          fontWeight: 600, 
                          cursor: 'pointer' 
                        }}
                      >
                        Add
                      </button>
                    </div>

                    {/* Listing */}
                    {form.products.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed #e5e7eb', borderRadius: '8px', color: '#6b7280', fontSize: '0.875rem' }}>
                        No products selected. Select products above to calculate deal value.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                              <th style={{ padding: '10px 8px', color: '#4b5563', fontWeight: 600 }}>Product</th>
                              <th style={{ padding: '10px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'right', width: 90 }}>Price</th>
                              <th style={{ padding: '10px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center', width: 80 }}>Qty</th>
                              <th style={{ padding: '10px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'right', width: 100 }}>Total</th>
                              <th style={{ padding: '10px 8px', width: 32 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.products.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 8px', color: '#111827', fontWeight: 500 }}>{p.name}</td>
                                <td style={{ padding: '12px 8px', color: '#4b5563', textAlign: 'right' }}>₹{p.price.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={p.quantity} 
                                    onChange={e => handleQuantityChange(p.id, e.target.value)} 
                                    style={{ width: 50, textAlign: 'center', height: 28, border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                                  />
                                </td>
                                <td style={{ padding: '12px 8px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                                  ₹{(p.price * p.quantity).toLocaleString('en-IN')}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveProduct(p.id)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                    title="Remove Product"
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Summary */}
                    {form.products.length > 0 && (
                      <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: '0.875rem' }}>
                          <span style={{ color: '#4b5563' }}>Subtotal:</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>₹{subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        {form.discount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: '0.875rem', color: '#16a34a' }}>
                            <span>Discount ({form.discount}%):</span>
                            <span>- ₹{(subtotal * form.discount / 100).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, fontSize: '0.9375rem', fontWeight: 700, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                          <span style={{ color: '#111827' }}>Total Deal Value:</span>
                          <span style={{ color: '#3d68f5' }}>₹{calculatedValue.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Status / Stage & Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Attributes (Stage & Status) */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Attributes</p>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={S.label}>Stage</label>
                      <select name="stage" value={form.stage} onChange={handleChange} style={{ ...S.input, cursor: 'pointer' }}>
                        {STAGE_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Status</label>
                      <select name="status" value={form.status} onChange={handleChange} style={{ ...S.input, cursor: 'pointer' }}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Information Card */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e40af', margin: '0 0 4px' }}>Deals Management</p>
                      <p style={{ fontSize: '0.7875rem', color: '#3b82f6', margin: 0, lineHeight: 1.5 }}>
                        Deals saved here are used to track pipeline value, monitor close dates, and generate sales reports.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ width: '100%', height: 40, border: 'none', borderRadius: '8px', background: saving ? '#9ca3af' : '#111827', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {saving && <Loader2 size={14} className="ws-chat-loader-spin" />}
                    {saving ? 'Saving...' : id ? 'Update Deal' : 'Save Deal'}
                  </button>
                  {id && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.get(`/deals/${id}/chat`)
                          navigate(`/dashboard?session=${res.data.sessionId}`)
                        } catch (e) {
                          dispatch(addToast({ message: 'Chat session not found', type: 'error' }))
                        }
                      }}
                      style={{ width: '100%', height: 38, border: '1px solid #3d68f5', borderRadius: '8px', background: '#eff6ff', color: '#3d68f5', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                      onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                    >
                      Discuss with Customer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/deals')}
                    style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    Cancel
                  </button>
                </div>

              </div>

            </form>
          )}

        </main>
      </div>
    </div>
  )
}
