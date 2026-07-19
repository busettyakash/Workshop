import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Loader2, Trash2, Edit2, X } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../../components/ui/ConfirmModal'

const STAGE_OPTIONS = ['Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const STAGE_STYLES = {
  'Discovery':    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Proposal':     { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  'Negotiation':  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Closed Won':   { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Closed Lost':  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}


export default function Deals() {
  const dispatch   = useAppDispatch()
  const navigate   = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, title: '' })
  const [activeTab, setActiveTab] = useState('my_deals')

  useEffect(() => {
    dispatch(setActiveNav('Deals'))
    fetchDeals()
  }, [dispatch])

  const currentUserId = sessionStorage.getItem('ws_active_workspace_id')

  const filteredDeals = deals.filter(row => {
    if (activeTab === 'my_deals') {
      return String(row.user_id) === String(currentUserId)
    } else {
      return String(row.company_shop_id) === String(currentUserId)
    }
  })

  const fetchDeals = async () => {
    setLoading(true)
    try {
      const res = await api.get('/deals')
      setDeals(res.data?.data || [])
    } catch {
      dispatch(addToast({ message: 'Failed to load deals', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    const { id, title } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, title: '' })
    try {
      await api.delete(`/deals/${id}`)
      setDeals(prev => prev.filter(d => d.id !== id))
      dispatch(addToast({ message: 'Deal deleted', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Failed to delete deal', type: 'error' }))
    }
  }

  const formatValue = (v) => {
    if (!v && v !== 0) return '—'
    return `₹${Number(v).toLocaleString('en-IN')}`
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Deals</div>

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div className="ws-table-header-left">
                <h2 className="ws-table-title">All Deals</h2>
                <p className="ws-table-sub">{deals.length} {deals.length === 1 ? 'deal' : 'deals'}</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn"><ArrowUpDown size={12} /> Sort</button>
                <button className="ws-table-btn"><Filter size={12} /> Filter</button>
                <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/deals/add')}>
                  <Plus size={13} /> New Deal
                </button>
              </div>
            </div>

            <div className="ws-table-wrap">
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px', marginBottom: 20 }}>
                <button
                  onClick={() => setActiveTab('my_deals')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    borderBottom: activeTab === 'my_deals' ? '2px solid #3d68f5' : '2px solid transparent',
                    color: activeTab === 'my_deals' ? '#3d68f5' : '#6b7280',
                    fontWeight: activeTab === 'my_deals' ? 600 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  My Deals
                </button>
                <button
                  onClick={() => setActiveTab('received')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    borderBottom: activeTab === 'received' ? '2px solid #3d68f5' : '2px solid transparent',
                    color: activeTab === 'received' ? '#3d68f5' : '#6b7280',
                    fontWeight: activeTab === 'received' ? 600 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Received Deals
                </button>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                  <Loader2 size={22} className="ws-chat-loader-spin" style={{ color: 'var(--color-gray-400)' }} />
                </div>
              ) : filteredDeals.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 4 }}>No deals found</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginBottom: 16 }}>
                    {activeTab === 'my_deals' ? 'Start by creating your first deal' : 'You have not received any deals yet'}
                  </p>
                  {activeTab === 'my_deals' && (
                    <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/deals/add')}>
                      <Plus size={13} /> New Deal
                    </button>
                  )}
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}><input type="checkbox" className="ws-table-checkbox" readOnly /></th>
                      <th>Deal Title</th>
                      <th>Value</th>
                      <th>Stage</th>
                      <th>Owner</th>
                      <th>Close Date</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map(row => {
                      const stageStyle = STAGE_STYLES[row.stage] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
                      const currentUserId = sessionStorage.getItem('ws_active_workspace_id')
                      const isUserB = row.company_id === currentUserId || row.company_shop_id === currentUserId
                      const targetRoute = isUserB ? `/deals/review/${row.id}` : `/deals/edit/${row.id}`
                      return (
                        <tr key={row.id}>
                          <td><input type="checkbox" className="ws-table-checkbox" readOnly /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.title), borderRadius: 6 }}>
                                {getSingleLetter(row.title)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span 
                                  className="ws-table-primary-text" 
                                  style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                                  onClick={() => navigate(targetRoute)}
                                >
                                  {row.title}
                                </span>
                                {row.company_name && (
                                  <span style={{ fontSize: '0.76rem', color: '#3d68f5', fontWeight: 500, marginTop: 2, display: 'block' }}>
                                    🏢 {row.company_name}
                                  </span>
                                )}
                                {row.products && (() => {
                                  let parsed = []
                                  if (typeof row.products === 'string') {
                                    try { parsed = JSON.parse(row.products) } catch(e){}
                                  } else if (Array.isArray(row.products)) {
                                    parsed = row.products
                                  }
                                  if (!parsed.length) return null
                                  const text = parsed.map(p => `${p.name} (x${p.quantity})`).join(', ')
                                  return (
                                    <span style={{ fontSize: '0.74rem', color: 'var(--color-gray-500)', marginTop: 2, display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={text}>
                                      {text}
                                    </span>
                                  )
                                })()}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-gray-900)', fontSize: '0.86rem' }}>
                            {formatValue(row.value)}
                          </td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: stageStyle.bg, color: stageStyle.text, borderColor: stageStyle.border }}>
                              {row.stage}
                            </span>
                          </td>
                          <td style={{ color: 'var(--color-gray-600)', fontSize: '0.83rem' }}>{row.owner || '—'}</td>
                          <td style={{ color: 'var(--color-gray-500)', fontSize: '0.82rem' }}>{formatDate(row.close_date)}</td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              {isUserB ? (
                                <button
                                  className="ws-table-btn"
                                  style={{ padding: '6px 12px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}
                                  onClick={() => navigate(targetRoute)}
                                >
                                  Review
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="ws-chat-history-delete-btn"
                                    style={{ padding: 6 }}
                                    onClick={() => navigate(targetRoute)}
                                    title="Edit Deal"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    className="ws-chat-history-delete-btn"
                                    style={{ padding: 6 }}
                                    onClick={() => setConfirmDelete({ isOpen: true, id: row.id, title: row.title })}
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
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
        </main>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Deal"
        message={`Are you sure you want to delete deal "${confirmDelete.title}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, title: '' })}
      />
    </div>
  )
}
