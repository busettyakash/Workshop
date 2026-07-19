import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Loader2, Mail, Phone, Trash2, Edit2, Search } from 'lucide-react'
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

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'name_asc', 'name_desc'
  const [filterPersona, setFilterPersona] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showFilterBar, setShowFilterBar] = useState(false)

  const totalPages = Math.ceil(total / limit) || 1
  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 2) {
        pages.push(1, 2, 3, '...', totalPages)
      } else if (page >= totalPages - 1) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
      }
    }
    return pages
  }

  useEffect(() => {
    dispatch(setActiveNav('People'))
    fetchPeople(page)
  }, [dispatch, page, search, sort, filterPersona, filterStatus])

  const fetchPeople = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await api.get(`/people?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&persona=${filterPersona}&status=${filterStatus}`)
      setPeople(res.data?.data || [])
      setTotal(res.data?.total || 0)
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

          <div className="ws-table-section" style={{ minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}>
            <div className="ws-table-header" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="ws-table-header-left">
                  <h2 className="ws-table-title">All People</h2>
                  <p className="ws-table-sub">{total} {total === 1 ? 'person' : 'people'}</p>
                </div>
                <div className="ws-table-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Search box */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Search people..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      style={{
                        padding: '8px 12px 8px 30px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        outline: 'none',
                        width: '180px',
                        background: '#fff',
                        color: '#374151'
                      }}
                    />
                  </div>

                  {/* Sort button */}
                  <button 
                    className="ws-table-btn" 
                    onClick={() => {
                      setSort(prev => prev === 'name_asc' ? 'name_desc' : prev === 'name_desc' ? '' : 'name_asc');
                      setPage(1);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      borderColor: sort ? '#111827' : '#d1d5db',
                      background: sort ? '#f3f4f6' : '#fff',
                      fontWeight: sort ? 600 : 500
                    }}
                  >
                    <ArrowUpDown size={13} /> 
                    Sort {sort === 'name_asc' ? 'A-Z' : sort === 'name_desc' ? 'Z-A' : ''}
                  </button>

                  {/* Filter button */}
                  <button 
                    className="ws-table-btn" 
                    onClick={() => setShowFilterBar(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      borderColor: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? '#111827' : '#d1d5db',
                      background: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? '#f3f4f6' : '#fff',
                      fontWeight: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? 600 : 500
                    }}
                  >
                    <Filter size={13} /> Filter
                  </button>

                  <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/people/add')}>
                    <Plus size={13} /> New Person
                  </button>
                </div>
              </div>

              {/* Expandable Filter Bar */}
              {showFilterBar && (
                <div style={{ display: 'flex', gap: 12, padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
                    <span>Persona:</span>
                    <select
                      value={filterPersona}
                      onChange={(e) => { setFilterPersona(e.target.value); setPage(1); }}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      <option value="all">All Persona</option>
                      <option value="Lead">Lead</option>
                      <option value="Customer">Customer</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
                    <span>Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {(filterPersona !== 'all' || filterStatus !== 'all') && (
                    <button 
                      onClick={() => { setFilterPersona('all'); setFilterStatus('all'); setPage(1); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3d68f5', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="ws-table-wrap" style={{ flex: 1 }}>
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

            {/* Pagination component outside ws-table-wrap at bottom of card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #f3f4f6', background: '#fff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', marginTop: 'auto' }}>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Showing <span style={{ fontWeight: 600, color: '#111827' }}>{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
                <span style={{ fontWeight: 600, color: '#111827' }}>{Math.min(page * limit, total)}</span> of{' '}
                <span style={{ fontWeight: 600, color: '#111827' }}>{total}</span> entries
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#fff',
                    color: page <= 1 ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  &lt;
                </button>
                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`dots-${idx}`} style={{ color: '#9ca3af', padding: '0 8px', fontSize: '0.875rem' }}>
                        ...
                      </span>
                    )
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: page === p ? '#111827' : '#fff',
                        color: page === p ? '#fff' : '#374151',
                        border: page === p ? '1px solid #111827' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#fff',
                    color: page >= totalPages ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  &gt;
                </button>
              </div>
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
