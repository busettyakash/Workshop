import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

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

export default function ImportStockForm() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  const [form, setForm] = useState({
    name: '', sku: '', category: '', price: '', stock: 0, status: 'pending', unit: 'pcs', description: ''
  })

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    if (id) fetchItem()
  }, [id, dispatch])

  const fetchItem = async () => {
    try {
      const res = await api.get(`/import-stock/${id}`)
      const item = res.data?.data
      if (item) {
        setForm({
          name: item.name || '',
          sku: item.sku || '',
          category: item.category || '',
          price: item.price || '',
          stock: item.stock || 0,
          status: item.status || 'pending',
          unit: item.unit || 'pcs',
          description: item.description || ''
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.name.trim()) err.name = 'Product name is required'
    if (!form.price || isNaN(form.price) || parseFloat(form.price) <= 0) err.price = 'Enter a valid price'
    if (Object.keys(err).length) { setErrors(err); return }

    setSaving(true)
    try {
      if (id) {
        await api.put(`/import-stock/${id}`, form)
        dispatch(addToast({ message: 'Updated successfully!', type: 'success' }))
      } else {
        await api.post('/import-stock', form)
        dispatch(addToast({ message: 'Pending product added!', type: 'success' }))
      }
      navigate('/import-stock')
    } catch {
      dispatch(addToast({ message: 'Failed to save', type: 'error' }))
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

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <button
              onClick={() => navigate('/import-stock')}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                {id ? 'Edit Pending Product' : 'Add Pending Product'}
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>
                Import Stock / {id ? 'Edit' : 'Add'}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={28} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

              {/* ── Left: Main Fields ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Basic Info */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Basic Information</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={S.field}>
                      <label style={S.label}>Product Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Wireless Mouse" style={inp('name')} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
                      {errors.name && <span style={S.error}>{errors.name}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ ...S.label, marginBottom: 0 }}>SKU / Barcode</label>
                          <button
                            type="button"
                            onClick={handleGenerateMainSKU}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#3d68f5',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            Auto Generate
                          </button>
                        </div>
                        <input name="sku" value={form.sku} onChange={handleChange} placeholder="e.g. SKU-1234" style={inp('sku')} onFocus={() => setFocus('sku')} onBlur={() => setFocus(null)} />
                      </div>
                      <div>
                        <label style={S.label}>Category</label>
                        <input name="category" value={form.category} onChange={handleChange} placeholder="e.g. Electronics" style={inp('category')} onFocus={() => setFocus('category')} onBlur={() => setFocus(null)} />
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Description</label>
                      <textarea name="description" value={form.description} onChange={handleChange} placeholder="Brief product description..." rows={4} style={{ ...inp('description'), height: 'auto', padding: '10px 12px', resize: 'vertical' }} onFocus={() => setFocus('description')} onBlur={() => setFocus(null)} />
                    </div>
                  </div>
                </div>

                {/* Pricing & Stock */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Pricing & Stock</p>
                  </div>
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={S.label}>Price (₹) <span style={{ color: '#dc2626' }}>*</span></label>
                      <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} placeholder="0.00" style={inp('price')} onFocus={() => setFocus('price')} onBlur={() => setFocus(null)} />
                      {errors.price && <span style={S.error}>{errors.price}</span>}
                    </div>
                    <div>
                      <label style={S.label}>Stock Quantity</label>
                      <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" style={inp('stock')} onFocus={() => setFocus('stock')} onBlur={() => setFocus(null)} />
                    </div>
                    <div>
                      <label style={S.label}>Unit of Measure</label>
                      <input 
                        name="unit" 
                        value={form.unit} 
                        onChange={handleChange} 
                        placeholder="e.g. pcs" 
                        style={inp('unit')} 
                        onFocus={() => setFocus('unit')} 
                        onBlur={() => setFocus(null)} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right: Status + Actions ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Status */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Status</p>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <select name="status" value={form.status} onChange={handleChange} style={{ ...S.input, cursor: 'pointer' }}>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                {/* Info box */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e40af', margin: '0 0 4px' }}>Pending Products</p>
                      <p style={{ fontSize: '0.7875rem', color: '#3b82f6', margin: 0, lineHeight: 1.5 }}>
                        Products staged here are reviewed before being added to your live inventory. Use the "Add to Products" button on the list page to approve them.
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
                    {saving ? 'Saving...' : id ? 'Update Product' : 'Save Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/import-stock')}
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
