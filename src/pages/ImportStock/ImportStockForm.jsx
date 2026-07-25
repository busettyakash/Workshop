import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails, ALL_UOM_OPTIONS } from '../../utils/unitHelpers'
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

  const todayStr = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    name: '', sku: '', category: '', price: '', updated_price: '', updated_price_date: todayStr, stock: 0, status: 'pending', unit: 'pcs', description: '', bag_weight: 100
  })

  const [uomOptions, setUomOptions] = useState(ALL_UOM_OPTIONS)

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    if (id) fetchItem()

    api.get('/uoms').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const dbOptions = res.data.map(u => ({
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
          name: item.name || '',
          sku: item.sku || '',
          category: item.category || '',
          price: item.price || '',
          updated_price: item.updated_price || '',
          updated_price_date: item.updated_price_date ? String(item.updated_price_date).split('T')[0] : todayStr,
          stock: item.stock || 0,
          status: item.status || 'pending',
          unit: item.unit || 'pcs',
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    const bulkUnit = getBulkUnitDetails(form.unit)
    if (!form.name.trim()) err.name = 'Product name is required'
    if (!form.price || isNaN(form.price) || parseFloat(form.price) <= 0) err.price = 'Enter a valid price'
    if (bulkUnit && (!form.bag_weight || isNaN(form.bag_weight) || parseFloat(form.bag_weight) <= 0)) {
      err.bag_weight = `Enter a valid ${bulkUnit.label.toLowerCase()} (e.g. 25)`
    }
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
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <label style={S.label}>100-Unit Price (₹) <span style={{ color: '#dc2626' }}>*</span></label>
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
                        placeholder="e.g. 6000"
                        style={inp('price_100')}
                        onFocus={() => setFocus('price_100')}
                        onBlur={() => setFocus(null)}
                      />
                      {errors.price && <span style={S.error}>{errors.price}</span>}
                    </div>
                    {getBulkUnitDetails(form.unit) && (
                      <div>
                        <label style={S.label}>Pack / Container Size <span style={{ color: '#dc2626' }}>*</span></label>
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
                          placeholder="e.g. 25, 50, 75, 100"
                          style={inp('bag_weight')}
                          onFocus={() => setFocus('bag_weight')}
                          onBlur={() => setFocus(null)}
                        />
                        {getBulkUnitDetails(form.unit).quickSizes && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
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
                                  {size}{getBulkUnitDetails(form.unit).short}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {errors.bag_weight && <span style={S.error}>{errors.bag_weight}</span>}
                      </div>
                    )}
                    {getBulkUnitDetails(form.unit) && (
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
                          style={{ ...inp('calc_price'), background: '#f8fafc', color: '#10b981', fontWeight: 700 }}
                        />
                      </div>
                    )}
                    <div>
                      <label style={S.label}>
                        {getBulkUnitDetails(form.unit) && parseFloat(form.bag_weight) > 1
                          ? `Stock Quantity (${getBulkUnitDetails(form.unit).pluralName})`
                          : `Stock Quantity (${getBulkUnitDetails(form.unit)?.short || form.unit || 'pcs'})`}
                      </label>
                      <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" style={inp('stock')} onFocus={() => setFocus('stock')} onBlur={() => setFocus(null)} />
                    </div>
                    <div>
                      <label style={S.label}>Update Price (₹)</label>
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
                            updated_price_date: val && !prev.updated_price_date ? new Date().toISOString().split('T')[0] : prev.updated_price_date
                          }))
                        }}
                        placeholder="e.g. 6500"
                        style={inp('updated_price')}
                        onFocus={() => setFocus('updated_price')}
                        onBlur={() => setFocus(null)}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Updated Date</label>
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
                    <div>
                      <label style={S.label}>Unit of Measure (UOM)</label>
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
                  </div>
                  {getBulkUnitDetails(form.unit) && (form.price_100 || form.price || form.updated_price) && form.bag_weight && (
                    <div style={{ padding: '12px 20px', background: '#f0fdf4', borderTop: '1px solid #dcfce7', fontSize: '0.8125rem', color: '#166534', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
                      <span>Calculated Unit Rate: ₹{(parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100).toFixed(2)} / {getBulkUnitDetails(form.unit).short}</span>
                      <span>• {form.bag_weight}{getBulkUnitDetails(form.unit).short} {getBulkUnitDetails(form.unit).name} Price: ₹{((parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100) * parseFloat(form.bag_weight)).toFixed(2)}</span>
                      {form.updated_price && (
                        <span style={{ color: '#047857', fontWeight: 700 }}>
                          • Updated Price: ₹{parseFloat(form.updated_price).toFixed(2)} (₹{(parseFloat(form.updated_price) / parseFloat(form.bag_weight || 1)).toFixed(2)} / {getBulkUnitDetails(form.unit).short})
                          {form.updated_price_date ? ` as of ${form.updated_price_date}` : ''}
                        </span>
                      )}
                      {form.stock && parseFloat(form.stock) > 0 && (
                        <span style={{ color: '#4b5563', fontWeight: 500 }}>
                          • Total Inventory: {form.stock} {getBulkUnitDetails(form.unit).pluralName} ({(parseFloat(form.stock) * parseFloat(form.bag_weight)).toLocaleString()} {getBulkUnitDetails(form.unit).short} total)
                        </span>
                      )}
                    </div>
                  )}
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
                    className="btn-blue"
                    style={{ width: '100%', justifyContent: 'center', background: saving ? '#9ca3af' : undefined, cursor: saving ? 'not-allowed' : 'pointer' }}
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
