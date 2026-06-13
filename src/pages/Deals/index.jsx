import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Loader2, Trash2, X } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'
import ConfirmModal from '../../components/ui/ConfirmModal'

const STAGE_OPTIONS = ['Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const STAGE_STYLES = {
  'Discovery':    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Proposal':     { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  'Negotiation':  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Closed Won':   { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Closed Lost':  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}

function AddDealModal({ onClose, onSaved }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ title: '', value: '', stage: 'Discovery', owner: '', close_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { dispatch(addToast({ message: 'Title is required', type: 'error' })); return }
    setSaving(true)
    try {
      await api.post('/deals', { ...form, value: parseFloat(form.value) || 0 })
      dispatch(addToast({ message: 'Deal added!', type: 'success' }))
      onSaved()
      onClose()
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to add deal', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h3 className="ws-modal-title">Add Deal</h3>
          <button className="ws-modal-close-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Deal Title *', key: 'title', type: 'text', placeholder: 'e.g. Enterprise License' },
            { label: 'Value (₹)',    key: 'value', type: 'number', placeholder: '0.00' },
            { label: 'Owner',        key: 'owner', type: 'text', placeholder: 'Your name' },
            { label: 'Close Date',   key: 'close_date', type: 'date', placeholder: '' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="ws-field-group">
              <label className="ws-field-label">{label}</label>
              <input
                className="ws-field-input"
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
          <div className="ws-field-group">
            <label className="ws-field-label">Stage</label>
            <select className="ws-field-input" value={form.stage} onChange={e => set('stage', e.target.value)}>
              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ws-field-group">
            <label className="ws-field-label">Notes</label>
            <textarea
              className="ws-field-input"
              rows={2}
              style={{ resize: 'vertical' }}
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="ws-modal-footer">
          <button className="ws-modal-btn" onClick={onClose}>Cancel</button>
          <button className="ws-modal-btn ws-modal-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="ws-chat-loader-spin" /> : null}
            {saving ? 'Saving…' : 'Add Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Deals() {
  const dispatch   = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, title: '' })

  useEffect(() => {
    dispatch(setActiveNav('Deals'))
    fetchDeals()
  }, [dispatch])

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
                <button className="ws-table-btn ws-table-btn--primary" onClick={() => setShowModal(true)}>
                  <Plus size={13} /> New Deal
                </button>
              </div>
            </div>

            <div className="ws-table-wrap">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                  <Loader2 size={22} className="ws-chat-loader-spin" style={{ color: 'var(--color-gray-400)' }} />
                </div>
              ) : deals.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 4 }}>No deals yet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginBottom: 16 }}>Start by creating your first deal</p>
                  <button className="ws-table-btn ws-table-btn--primary" onClick={() => setShowModal(true)}>
                    <Plus size={13} /> New Deal
                  </button>
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
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(row => {
                      const stageStyle = STAGE_STYLES[row.stage] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
                      return (
                        <tr key={row.id}>
                          <td><input type="checkbox" className="ws-table-checkbox" readOnly /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.title), borderRadius: 6 }}>
                                {getSingleLetter(row.title)}
                              </div>
                              <span className="ws-table-name-text">{row.title}</span>
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
                            <button
                              className="ws-chat-history-delete-btn"
                              style={{ padding: 5 }}
                              onClick={() => setConfirmDelete({ isOpen: true, id: row.id, title: row.title })}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
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
      {showModal && <AddDealModal onClose={() => setShowModal(false)} onSaved={fetchDeals} />}

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
