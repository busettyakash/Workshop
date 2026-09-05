import React, { useState, useEffect } from 'react'
import { 
  Scale, Plus, Trash2, Edit2, Search, Sparkles, Check, 
  RotateCcw, Package, Layers, X, Tag, Box, Info, CheckCircle2, Loader2 
} from 'lucide-react'
import api from '../../api/client'
import { useAppDispatch } from '../../redux/hooks'
import { addToast } from '../../redux/slices/uiSlice'
import { getCategoryTagStyle, getPillStyle } from '../../utils/tableHelpers'
import '../../pages/Dashboard/Dashboard.css'
import '../../pages/Products/Products.css'

export default function UomManager() {
  const dispatch = useAppDispatch()
  const [uomList, setUomList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUom, setEditingUom] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Form state
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'Count',
    is_bulk: false,
    presets: '',
    status: 'Active'
  })

  const fetchUoms = async () => {
    setLoading(true)
    try {
      const res = await api.get('/uoms')
      setUomList(res.data || [])
    } catch (err) {
      console.error('Failed to fetch UOMs:', err)
      dispatch(addToast({ message: 'Could not load measurement units', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUoms()
  }, [])

  const handleOpenAdd = () => {
    setEditingUom(null)
    setForm({
      code: '',
      name: '',
      category: '',
      is_bulk: false,
      presets: '1, 10, 50',
      status: 'Active'
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (uom) => {
    setEditingUom(uom)
    setForm({
      code: uom.code || '',
      name: uom.name || '',
      category: uom.category || 'Count',
      is_bulk: Boolean(uom.is_bulk),
      presets: uom.presets || '',
      status: uom.status || 'Active'
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      dispatch(addToast({ message: 'Unit code and name are required', type: 'error' }))
      return
    }

    setSubmitting(true)
    try {
      if (editingUom) {
        await api.put(`/uoms/${editingUom.id}`, form)
        dispatch(addToast({ message: `UOM "${form.name}" updated successfully`, type: 'success' }))
      } else {
        await api.post('/uoms', form)
        dispatch(addToast({ message: `UOM "${form.name}" created successfully`, type: 'success' }))
      }
      setIsModalOpen(false)
      fetchUoms()
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to save UOM', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/uoms/${id}`)
      dispatch(addToast({ message: 'Unit of Measure removed', type: 'success' }))
      setDeleteConfirmId(null)
      fetchUoms()
    } catch {
      dispatch(addToast({ message: 'Failed to delete UOM', type: 'error' }))
    }
  }

  // Filtered List
  const filteredList = uomList.filter(item => {
    return (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.presets || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Unified Page Header (matches Products page) ── */}
      <div className="ws-unified-page-header" style={{ marginBottom: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div className="ws-unified-header-left">
          <span className="ws-unified-header-title">Unit of Measure (UOM)</span>
          <span className="ws-unified-header-badge">{uomList.length} units</span>
        </div>
        <div className="ws-unified-header-actions">
          {/* Search */}
          <div className="attio-search-box">
            <Search size={14} className="attio-search-icon" />
            <input
              type="text"
              className="attio-input-search"
              placeholder="Search products, uoms..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Add UOM button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="attio-btn attio-btn-primary"
          >
            <Plus size={14} /> Add UOM
          </button>
        </div>
      </div>

      {/* ── UOM Table (uses exact same attio-table classes as Products page) ── */}
      <div className="attio-table-card" style={{ marginTop: 0 }}>
        <div className="attio-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
              <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
              <Scale size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>No measurement units found</div>
              <div style={{ fontSize: '0.80rem', color: '#64748b', marginTop: 4 }}>
                {search ? `No units matched "${search}"` : 'Get started by creating your first Unit of Measure.'}
              </div>
              <button
                onClick={handleOpenAdd}
                className="attio-btn attio-btn-primary"
                style={{ marginTop: 14 }}
              >
                <Plus size={13} /> Add UOM
              </button>
            </div>
          ) : (
            <table className="attio-table">
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                    <input type="checkbox" className="attio-chk" readOnly />
                  </th>
                  <th>CODE</th>
                  <th>UNIT NAME</th>
                  <th>CATEGORY</th>
                  <th>CAPACITY PRESETS</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(item => {
                  const catStyle = getCategoryTagStyle(item.category)
                  const pillStyle = getPillStyle(item.status || 'active')
                  const presetsArr = (item.presets || '')
                    .split(',')
                    .map(p => p.trim())
                    .filter(Boolean)

                  return (
                    <tr key={item.id}>
                      {/* Checkbox (matches Products page) */}
                      <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                        <input type="checkbox" className="attio-chk" readOnly />
                      </td>

                      {/* Code */}
                      <td>
                        <span style={{
                          fontWeight: 600,
                          fontSize: '0.84rem',
                          background: '#f1f5f9',
                          color: '#0f172a',
                          padding: '3px 9px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0'
                        }}>
                          {item.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td>
                        <div style={{ fontWeight: 535, fontSize: '0.89rem', color: '#1e293b' }}>{item.name}</div>
                        {item.is_bulk && (
                          <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginTop: 2 }}>
                            Supports fractional quantities / bulk packaging
                          </div>
                        )}
                      </td>

                      {/* Category (matches Products page exactly) */}
                      <td>
                        <span className="attio-category-tag" style={{
                          background: catStyle.bg,
                          color: catStyle.text,
                          border: `1px solid ${catStyle.border}`,
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          {item.category || 'Count'}
                        </span>
                      </td>

                      {/* Presets */}
                      <td>
                        {presetsArr.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {presetsArr.slice(0, 4).map((p, pIdx) => (
                              <span
                                key={pIdx}
                                style={{
                                  fontSize: '0.70rem',
                                  fontWeight: 600,
                                  background: '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #e2e8f0',
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}
                              >
                                {p} {item.code}
                              </span>
                            ))}
                            {presetsArr.length > 4 && (
                              <span style={{ fontSize: '0.70rem', color: '#94a3b8', padding: '1px 4px' }}>
                                +{presetsArr.length - 4} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>

                      {/* Status (matches Products page periwinkle badge exactly) */}
                      <td>
                        <span className="attio-status-badge" style={{
                          background: pillStyle.bg,
                          color: pillStyle.text,
                          border: `1px solid ${pillStyle.border}`
                        }}>
                          {(item.status || 'active').toLowerCase()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="attio-btn"
                            style={{ fontSize: '0.75rem', padding: '4px 10px', gap: 4 }}
                            title="Edit UOM"
                          >
                            <Edit2 size={12} /> Edit
                          </button>

                          {deleteConfirmId === item.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#ef4444',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  color: '#ffffff',
                                  fontSize: '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="attio-btn"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(item.id)}
                              style={{
                                padding: '4px 6px',
                                background: 'none',
                                border: '1px solid transparent',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.background = '#fee2e2' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none' }}
                              title="Delete UOM"
                            >
                              <Trash2 size={13} />
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
      </div>

      {/* ── Add / Edit UOM Modal ── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
            }
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '95vw',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {editingUom ? `Edit UOM (${editingUom.code})` : 'Add Unit of Measure (UOM)'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Define code symbol, packaging category, and container presets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 14 }}>
                {/* Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: '#334155', marginBottom: 5 }}>
                    Unit Code <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kgs, pcs, box"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toLowerCase() })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 8,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: '#334155', marginBottom: 5 }}>
                    Unit Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kilograms, Pieces, Corrugated Box"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 8,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: '#334155', marginBottom: 5 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weight, Count, Volume, Package..."
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 8,
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  />
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: '#334155', marginBottom: 5 }}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.84rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 8,
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Capacity / Packaging Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: '#334155', marginBottom: 5 }}>
                  Container / Capacity Presets (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10, 25, 50, 100"
                  value={form.presets}
                  onChange={e => setForm({ ...form, presets: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.84rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                  Enables rapid stock creation for standard bag sizes, container capacities, and packing tiers.
                </div>
              </div>

              {/* Bulk fractional toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={form.is_bulk}
                  onChange={e => setForm({ ...form, is_bulk: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.80rem', fontWeight: 550, color: '#334155' }}>
                  Allow decimal / fractional quantities (e.g. 2.5 {form.code || 'kg'})
                </span>
              </label>

              {/* Live Preview Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Preview in Inventory & Invoices:</span>
                {(() => {
                  const previewCatStyle = getCategoryTagStyle(form.category)
                  return (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: previewCatStyle.bg,
                      color: previewCatStyle.text,
                      border: `1px solid ${previewCatStyle.border}`
                    }}>
                      {form.name || 'Unit'} ({form.code || 'code'}) · {form.category}
                    </span>
                  )
                })()}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  {editingUom ? 'Update UOM' : 'Save UOM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
