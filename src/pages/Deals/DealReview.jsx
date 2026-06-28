import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast, toggleChat } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info, Check, X, MessageSquare } from 'lucide-react'
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
    background: '#f9fafb',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'not-allowed'
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  field: { marginBottom: '20px' },
}

export default function DealReview() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', value: 0, owner: '', close_date: '', stage: 'Discovery', status: 'active', notes: '',
    products: [], discount: 0, company_name: ''
  })

  useEffect(() => {
    dispatch(setActiveNav('Deals'))
    fetchDeal()
  }, [id, dispatch])

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
          company_name: item.company_name || 'Unknown Company'
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

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      await api.post(`/deals/${id}/approve`)
      dispatch(addToast({ message: 'Deal approved successfully!', type: 'success' }))
      navigate('/deals')
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to approve deal', type: 'error' }))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    try {
      await api.post(`/deals/${id}/reject`)
      dispatch(addToast({ message: 'Deal rejected.', type: 'info' }))
      navigate('/deals')
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to reject deal', type: 'error' }))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDiscuss = async () => {
    try {
      const res = await api.get(`/deals/${id}/chat`)
      navigate(`/dashboard?session=${res.data.sessionId}`)
    } catch (e) {
      dispatch(addToast({ message: 'Chat session not found', type: 'error' }))
    }
  }

  const subtotal = form.products.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
  const calculatedValue = subtotal * (1 - (parseFloat(form.discount) || 0) / 100)

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
                Review Deal
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>
                Deals / Review
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={28} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

              {/* Left Column: Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Deal Information */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Deal Information</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={S.field}>
                      <label style={S.label}>Company</label>
                      <input value={form.company_name} readOnly style={S.input} />
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Deal Title</label>
                      <input value={form.title} readOnly style={S.input} />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={S.label}>Subtotal (₹)</label>
                        <input type="text" value={subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Discount (%)</label>
                        <input type="text" value={form.discount} readOnly style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Final Value (₹)</label>
                        <input type="text" value={calculatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly style={{ ...S.input, fontWeight: 600, color: '#3d68f5' }} />
                      </div>
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Owner</label>
                      <input value={form.owner} readOnly style={S.input} />
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>Close Date</label>
                      <input value={form.close_date} readOnly style={S.input} />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={S.label}>Notes</label>
                      <textarea value={form.notes} readOnly rows={3} style={{ ...S.input, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
                    </div>
                  </div>
                </div>

                {/* Deal Products */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginTop: 20 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Deal Products</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    {form.products.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed #e5e7eb', borderRadius: '8px', color: '#6b7280', fontSize: '0.875rem' }}>
                        No products attached to this deal.
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
                            </tr>
                          </thead>
                          <tbody>
                            {form.products.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 8px', color: '#111827', fontWeight: 500 }}>{p.name}</td>
                                <td style={{ padding: '12px 8px', color: '#4b5563', textAlign: 'right' }}>₹{p.price.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>{p.quantity}</td>
                                <td style={{ padding: '12px 8px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                                  ₹{(p.price * p.quantity).toLocaleString('en-IN')}
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
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Current Status</p>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={S.label}>Stage</label>
                      <input value={form.stage} readOnly style={{ ...S.input, fontWeight: 600, color: '#3d68f5' }} />
                    </div>

                    <div>
                      <label style={S.label}>Status</label>
                      <input value={form.status} readOnly style={S.input} />
                    </div>
                  </div>
                </div>

                {/* Information Card */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e40af', margin: '0 0 4px' }}>Action Required</p>
                      <p style={{ fontSize: '0.7875rem', color: '#3b82f6', margin: 0, lineHeight: 1.5 }}>
                        Please review the deal details. You can approve the deal, reject it, or discuss terms with the representative.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    style={{ width: '100%', height: 40, border: 'none', borderRadius: '8px', background: actionLoading ? '#9ca3af' : '#10b981', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {actionLoading ? <Loader2 size={14} className="ws-chat-loader-spin" /> : <Check size={16} />}
                    Approve Deal
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleDiscuss}
                    disabled={actionLoading}
                    style={{ width: '100%', height: 40, border: 'none', borderRadius: '8px', background: actionLoading ? '#9ca3af' : '#3d68f5', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <MessageSquare size={16} />
                    Discuss
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={{ width: '100%', height: 38, border: '1px solid #ef4444', borderRadius: '8px', background: '#fff', color: '#ef4444', fontSize: '0.875rem', fontWeight: 500, cursor: actionLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onMouseEnter={e => !actionLoading && (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={e => !actionLoading && (e.currentTarget.style.background = '#fff')}
                  >
                    <X size={16} />
                    Reject Deal
                  </button>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  )
}
