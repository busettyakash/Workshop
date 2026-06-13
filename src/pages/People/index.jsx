import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Loader2, Mail, Phone, Trash2, Edit2 } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function People() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, name: '' })

  useEffect(() => {
    dispatch(setActiveNav('People'))
    fetchPeople()
  }, [dispatch])

  const fetchPeople = async () => {
    setLoading(true)
    try {
      const res = await api.get('/people')
      setPeople(res.data?.data || [])
    } catch {
      dispatch(addToast({ message: 'Failed to load people', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    const { id, name } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, name: '' })
    try {
      await api.delete(`/people/${id}`)
      setPeople(prev => prev.filter(p => p.id !== id))
      dispatch(addToast({ message: 'Person deleted', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Failed to delete', type: 'error' }))
    }
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">People</div>

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div className="ws-table-header-left">
                <h2 className="ws-table-title">All People</h2>
                <p className="ws-table-sub">{people.length} {people.length === 1 ? 'person' : 'people'}</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn"><ArrowUpDown size={12} /> Sort</button>
                <button className="ws-table-btn"><Filter size={12} /> Filter</button>
                <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/people/add')}>
                  <Plus size={13} /> New Person
                </button>
              </div>
            </div>

            <div className="ws-table-wrap">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                  <Loader2 size={22} className="ws-chat-loader-spin" style={{ color: 'var(--color-gray-400)' }} />
                </div>
              ) : people.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 4 }}>No people yet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginBottom: 16 }}>Add your first person to get started</p>
                  <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/people/add')}>
                    <Plus size={13} /> New Person
                  </button>
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}><input type="checkbox" className="ws-table-checkbox" readOnly /></th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Persona</th>
                      <th>Status</th>
                      <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map(row => {
                      const statusStyle  = getPillStyle(row.status)
                      const personaStyle = getPillStyle(row.persona)
                      return (
                        <tr key={row.id}>
                          <td><input type="checkbox" className="ws-table-checkbox" readOnly /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.name) }}>
                                {getSingleLetter(row.name)}
                              </div>
                              <span 
                                className="ws-table-primary-text" 
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/people/edit/${row.id}`)}
                              >
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Mail size={12} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.82rem', color: 'var(--color-gray-600)' }}>{row.email || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Phone size={12} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.82rem', color: 'var(--color-gray-600)' }}>{row.phone || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: personaStyle.bg, color: personaStyle.text, borderColor: personaStyle.border }}>
                              {row.persona || 'Lead'}
                            </span>
                          </td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                className="ws-chat-history-delete-btn"
                                style={{ padding: 6 }}
                                onClick={() => navigate(`/people/edit/${row.id}`)}
                                title="Edit Person"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="ws-chat-history-delete-btn"
                                style={{ padding: 6 }}
                                onClick={() => setConfirmDelete({ isOpen: true, id: row.id, name: row.name })}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
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
        title="Delete Person"
        message={`Are you sure you want to delete "${confirmDelete.name}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
      />
    </div>
  )
}
