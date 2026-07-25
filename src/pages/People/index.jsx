import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Loader2, Mail, Phone, Trash2, Edit2, Search } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import { useNavigate } from 'react-router'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'

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
  const [selectedIds, setSelectedIds] = useState([])

  const isAllSelected = people.length > 0 && selectedIds.length === people.length
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(people.map(p => p.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

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
          <div className="attio-products-container">
            {/* Top Toolbar */}
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">People</span>
                <span className="ws-unified-header-badge">{total} {total === 1 ? 'person' : 'people'}</span>
              </div>
              <div className="ws-unified-header-actions">
                {/* Search box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search people..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Sort button */}
                <button 
                  className="attio-btn"
                  onClick={() => {
                    setSort(prev => prev === 'name_asc' ? 'name_desc' : prev === 'name_desc' ? '' : 'name_asc');
                    setPage(1);
                  }}
                  style={{
                    background: sort ? '#f1f5f9' : '#ffffff',
                    borderColor: sort ? '#0f172a' : '#cbd5e1',
                    fontWeight: sort ? 600 : 500
                  }}
                >
                  <ArrowUpDown size={13} /> 
                  Sort {sort === 'name_asc' ? 'A-Z' : sort === 'name_desc' ? 'Z-A' : ''}
                </button>

                {/* Filter button */}
                <button 
                  className="attio-btn"
                  onClick={() => setShowFilterBar(prev => !prev)}
                  style={{
                    background: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar || filterPersona !== 'all' || filterStatus !== 'all' ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>

                <button className="attio-btn attio-btn-primary" onClick={() => navigate('/people/add')}>
                  <Plus size={13} style={{ marginRight: '4px' }} /> New Person
                </button>
              </div>
            </div>

            {/* Expandable Filter Box */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Persona:</span>
                  <select
                    className="attio-select"
                    value={filterPersona}
                    onChange={(e) => { setFilterPersona(e.target.value); setPage(1); }}
                  >
                    <option value="all">All Persona</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Status:</span>
                  <select
                    className="attio-select"
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {(filterPersona !== 'all' || filterStatus !== 'all') && (
                  <button 
                    onClick={() => { setFilterPersona('all'); setFilterStatus('all'); setPage(1); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* Table Card Shell */}
            <div className="attio-table-card">
              <div className="attio-table-wrap">
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
                <table className="attio-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                        <input 
                          type="checkbox" 
                          className="attio-chk" 
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>NAME</th>
                      <th>EMAIL</th>
                      <th>PHONE</th>
                      <th>PERSONA</th>
                      <th>STATUS</th>
                      <th style={{ width: 80, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map(row => {
                      const statusStyle  = getPillStyle(row.status)
                      const personaStyle = getPillStyle(row.persona)
                      const isRowSelected = selectedIds.includes(row.id)
                      return (
                        <tr key={row.id} style={{ background: isRowSelected ? '#f0f5ff' : undefined }}>
                          <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                            <input 
                              type="checkbox" 
                              className="attio-chk" 
                              checked={isRowSelected}
                              onChange={() => handleSelectRow(row.id)}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                {getSingleLetter(row.name)}
                              </div>
                              <span 
                                className="ws-table-primary-text" 
                                style={{ cursor: 'pointer', fontWeight: 600 }}
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

            {/* Pagination component */}
            <TablePagination
              page={page}
              setPage={setPage}
              total={total}
              limit={limit}
              getPageNumbers={getPageNumbers}
              totalPages={totalPages}
            />
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
