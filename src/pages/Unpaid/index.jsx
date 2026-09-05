import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Trash2, Loader2, Check, Search, Filter, ArrowUpDown, Eye } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'
import BillPreview from '../Billing/BillPreview'
import { useNavigate } from 'react-router'
import { hasModulePermission, canDeleteModule, canEditModule, getFirstAccessibleRoute, usePermissions } from '../../utils/permissionUtils'

export default function UnpaidBills() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const { canRead, canDelete, canEdit } = usePermissions('unpaid')

  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewBill, setPreviewBill] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, displayId: '' })

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'id_asc', 'id_desc', 'amount_asc', 'amount_desc'
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const isAllSelected = bills.length > 0 && selectedIds.length === bills.length
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(bills.map(b => b.id))
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

  const fetchUnpaidBills = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await api.get(`/billing?status=unpaid&page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`)
      setBills(res.data?.data || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      dispatch(addToast({ message: 'Failed to load unpaid bills', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canRead) {
      navigate(getFirstAccessibleRoute(), { replace: true })
      return
    }
    dispatch(setActiveNav('Unpaid'))
    fetchUnpaidBills(page)
  }, [dispatch, page, search, sort, canRead])

  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/billing/${id}/pay`)
      dispatch(addToast({ message: 'Bill marked as Paid successfully', type: 'success' }))
      fetchUnpaidBills(page, limit)
    } catch (err) {
      dispatch(addToast({ message: 'Failed to update bill', type: 'error' }))
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
    let s = String(d).trim()
    if (!s.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(s) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
      s = s.replace(' ', 'T') + 'Z'
    }
    const parsed = new Date(s)
    const validDate = Number.isNaN(parsed.getTime()) ? new Date(d) : parsed
    return validDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
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
                <span className="ws-unified-header-title">Unpaid Invoices</span>
                <span className="ws-unified-header-badge">{total} pending</span>
              </div>
              <div className="ws-unified-header-actions">
                {/* Search box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search invoices..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Sort button */}
                <button
                  className="attio-btn"
                  onClick={() => {
                    setSort(prev => prev === 'id_asc' ? 'id_desc' : prev === 'id_desc' ? 'amount_asc' : prev === 'amount_asc' ? 'amount_desc' : prev === 'amount_desc' ? '' : 'id_asc');
                    setPage(1);
                  }}
                  style={{
                    background: sort ? '#f1f5f9' : '#ffffff',
                    borderColor: sort ? '#0f172a' : '#cbd5e1',
                    fontWeight: sort ? 600 : 500
                  }}
                >
                  <ArrowUpDown size={13} />
                  Sort {sort === 'id_asc' ? 'ID Asc' : sort === 'id_desc' ? 'ID Desc' : sort === 'amount_asc' ? 'Min Amt' : sort === 'amount_desc' ? 'Max Amt' : ''}
                </button>

                {/* Filter button */}
                <button
                  className="attio-btn"
                  onClick={() => setShowFilterBar(prev => !prev)}
                  style={{
                    background: showFilterBar ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>
              </div>
            </div>

            {/* Expandable Filter Box */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ fontSize: '0.8125rem', color: '#475467' }}>
                  Filtering for <span style={{ fontWeight: 600, color: '#0f172a' }}>Unpaid</span> invoices only.
                </div>
              </div>
            )}

            {/* Table Card Shell */}
            <div className="attio-table-card">

              <div className="attio-table-wrap" style={{ flex: 1 }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <Loader2 size={24} className="ws-chat-loader-spin" />
                  </div>
                ) : bills.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                    No pending/unpaid invoices found.
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
                        <th>INVOICE ID</th>
                        <th>QUOTE / ORDER #</th>
                        <th>CUSTOMER</th>
                        <th>TOTAL AMOUNT</th>
                        <th>INVOICE DATE</th>
                        <th>DUE DATE</th>
                        <th>STATUS</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map(bill => {
                        const name = bill.customer_name || 'General Customer'
                        const colors = getPillStyle('Pending')
                        const isRowSelected = selectedIds.includes(bill.id)
                        const invNum = bill.bill_number || (bill.id ? `INV-${String(bill.id).padStart(5, '0')}` : '—')
                        const orderMatch = bill.order_number || (bill.notes && (bill.notes.match(/ORD-\w+/i)?.[0]))
                        const quoteMatch = bill.notes && (bill.notes.match(/QT-\w+/i)?.[0])

                        return (
                          <tr key={bill.id} style={{ background: isRowSelected ? '#f0f5ff' : undefined }}>
                            <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                              <input
                                type="checkbox"
                                className="attio-chk"
                                checked={isRowSelected}
                                onChange={() => handleSelectRow(bill.id)}
                              />
                            </td>
                            <td className="ws-td-mono" style={{ fontWeight: 700, color: '#1e293b' }}>{invNum}</td>
                            <td>
                              {orderMatch ? (
                                <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                                  {orderMatch}
                                </span>
                              ) : quoteMatch ? (
                                <span style={{ color: '#475569', fontWeight: 600, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                                  {quoteMatch}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>
                                  Direct Bill
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="attio-avatar" style={{ background: getAvatarColor(name) }}>
                                  {getSingleLetter(name)}
                                </div>
                                <span className="ws-table-name-text">
                                  {name}
                                </span>
                              </div>
                            </td>
                            <td className="ws-td-price">{formatCurrency(bill.amount)}</td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{formatDate(bill.created_at || bill.date || bill.issue_date)}</td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{formatDate(bill.due_date)}</td>
                            <td>
                              <span className="ws-pill-topic" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                                Pending
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                                <button 
                                  onClick={() => setPreviewBill(bill)}
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    transition: 'all 0.15s'
                                  }}
                                  title="View Unpaid Invoice Details"
                                >
                                  <Eye size={12} /> View
                                </button>
                                {canEdit && (
                                  <button
                                    className="ws-chat-history-delete-btn"
                                    style={{ color: '#10b981', padding: 6, backgroundColor: '#ecfdf5' }}
                                    onClick={() => handleMarkPaid(bill.id)}
                                    title="Mark as Paid"
                                  >
                                    <Check size={13} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className="ws-chat-history-delete-btn"
                                    style={{ padding: 6 }}
                                    onClick={() => setConfirmDelete({ isOpen: true, id: bill.id, displayId: 'INV-' + String(bill.id).padStart(3, '0') })}
                                    title="Delete Bill Record"
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

      {previewBill && (
        <BillPreview
          bill={previewBill}
          onClose={() => setPreviewBill(null)}
        />
      )}

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