import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Trash2, Loader2, Search, Filter, ArrowUpDown } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function PaidBills() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, displayId: '' })

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'id_asc', 'id_desc', 'amount_asc', 'amount_desc'
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
    dispatch(setActiveNav('Paid'))
    fetchPaidBills(page)
  }, [dispatch, page, search, sort])

  const fetchPaidBills = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await api.get(`/billing?status=paid&page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`)
      setBills(res.data?.data || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      dispatch(addToast({ message: 'Failed to load paid bills', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, displayId: '' })
    try {
      await api.delete(`/billing/${id}`)
      setBills(prev => prev.filter(b => b.id !== id))
      dispatch(addToast({ message: 'Bill record deleted successfully', type: 'success' }))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete bill record', type: 'error' }))
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Paid Invoices</div>

          <div className="ws-table-section" style={{ minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}>
            <div className="ws-table-header" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="ws-table-title">Paid Invoices</h2>
                  <p className="ws-table-sub">{total} paid invoices total</p>
                </div>
                <div className="ws-table-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Search box */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Search invoices..."
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
                      setSort(prev => prev === 'id_asc' ? 'id_desc' : prev === 'id_desc' ? 'amount_asc' : prev === 'amount_asc' ? 'amount_desc' : prev === 'amount_desc' ? '' : 'id_asc');
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
                    Sort {sort === 'id_asc' ? 'ID Asc' : sort === 'id_desc' ? 'ID Desc' : sort === 'amount_asc' ? 'Min Amt' : sort === 'amount_desc' ? 'Max Amt' : ''}
                  </button>

                  {/* Filter button */}
                  <button 
                    className="ws-table-btn" 
                    onClick={() => setShowFilterBar(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      borderColor: showFilterBar ? '#111827' : '#d1d5db',
                      background: showFilterBar ? '#f3f4f6' : '#fff',
                      fontWeight: showFilterBar ? 600 : 500
                    }}
                  >
                    <Filter size={13} /> Filter
                  </button>
                </div>
              </div>

              {/* Expandable Filter Bar */}
              {showFilterBar && (
                <div style={{ display: 'flex', gap: 12, padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    Filtering for <span style={{ fontWeight: 600, color: '#111827' }}>Paid</span> invoices only.
                  </div>
                </div>
              )}
            </div>

            <div className="ws-table-wrap" style={{ flex: 1 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={24} className="ws-chat-loader-spin" />
                </div>
              ) : bills.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  No paid invoices found.
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" className="ws-table-checkbox" readOnly /></th>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Total Amount</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(bill => {
                      const name = bill.customer_name || 'General Customer'
                      const colors = getPillStyle('Paid')
                      return (
                        <tr key={bill.id}>
                          <td>
                            <input type="checkbox" className="ws-table-checkbox" readOnly />
                          </td>
                          <td className="ws-td-mono">INV-{String(bill.id).padStart(3, '0')}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(name) }}>
                                {getSingleLetter(name)}
                              </div>
                              <span className="ws-table-name-text">
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="ws-td-price">{formatCurrency(bill.amount)}</td>
                          <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{formatDate(bill.due_date)}</td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                              Paid
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button 
                                className="ws-chat-history-delete-btn" 
                                style={{ padding: 6 }} 
                                onClick={() => setConfirmDelete({ isOpen: true, id: bill.id, displayId: 'INV-' + String(bill.id).padStart(3, '0') })}
                                title="Delete Bill Record"
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
        title="Delete Bill"
        message={`Are you sure you want to delete bill ${confirmDelete.displayId}?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, displayId: '' })}
      />
    </div>
  )
}
