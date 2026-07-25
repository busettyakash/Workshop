import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import {
  Plus, Receipt, TrendingUp, Clock, CheckCircle,
  Trash2, Loader2, Check, Eye, Download, Upload,
  FileText, Star, X, ChevronDown, Search, Filter, ArrowUpDown
} from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'
import BillPreview from './BillPreview'
import { useNavigate } from 'react-router'

const STATUS_MAP = {
  paid: { bg: '#dcfce7', text: '#166534', label: 'Paid' },
  unpaid: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
}

/* ── Template Manager Modal ──────────────────────────────── */
function TemplateManagerModal({ onClose }) {
  const dispatch = useAppDispatch()
  const fileRef = useRef(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await api.get('/bill-templates')
      setTemplates(res.data?.data || [])
    } catch {
      dispatch(addToast({ message: 'Failed to load templates', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      dispatch(addToast({ message: 'Only HTML files are supported', type: 'warning' }))
      return
    }
    const name = templateName.trim() || file.name.replace(/\.(html|htm)$/, '')
    setUploading(true)
    try {
      const html = await file.text()
      await api.post('/bill-templates', { name, html, is_default: templates.length === 0 })
      dispatch(addToast({ message: `Template "${name}" saved!`, type: 'success' }))
      setTemplateName('')
      fetchTemplates()
    } catch {
      dispatch(addToast({ message: 'Failed to upload template', type: 'error' }))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/bill-templates/${id}/set-default`)
      dispatch(addToast({ message: 'Default template updated!', type: 'success' }))
      fetchTemplates()
    } catch {
      dispatch(addToast({ message: 'Failed to set default', type: 'error' }))
    }
  }

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/bill-templates/${id}`)
      dispatch(addToast({ message: `Template "${name}" deleted`, type: 'info' }))
      fetchTemplates()
    } catch {
      dispatch(addToast({ message: 'Failed to delete template', type: 'error' }))
    }
  }

  return (
    <div className="ws-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="ws-modal-card" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h3 className="ws-modal-title">Bill Templates</h3>
          <button className="ws-modal-close-x" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload section */}
          <div style={{ background: '#f8fafc', border: '1px dashed #d1d5db', borderRadius: 10, padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: 8 }}>
              Upload Custom Template
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
              Upload an HTML file as your custom invoice template. Use variables like <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{{shopName}}'}</code>, <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{{invoiceId}}'}</code>, <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{{customerName}}'}</code>, <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{{total}}'}</code>.
            </p>
            <input
              type="text"
              placeholder="Template name (optional)"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
            />
            <input ref={fileRef} type="file" accept=".html,.htm" onChange={handleFileUpload} style={{ display: 'none' }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#3d68f5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Upload size={14} />
              {uploading ? 'Uploading…' : 'Choose HTML File & Upload'}
            </button>
          </div>

          {/* Templates list */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: 8 }}>
              Saved Templates ({templates.length})
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <Loader2 size={20} className="ws-chat-loader-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem', background: '#f9fafb', borderRadius: 8 }}>
                No custom templates yet. The built-in default will be used.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: `1px solid ${t.is_default ? '#bfdbfe' : '#e5e7eb'}`,
                    background: t.is_default ? '#eff6ff' : '#fff', borderRadius: 8
                  }}>
                    <FileText size={16} color={t.is_default ? '#3d68f5' : '#9ca3af'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {t.is_default && <span style={{ marginLeft: 6, color: '#2563eb', fontWeight: 700 }}>· Default</span>}
                      </div>
                    </div>
                    {!t.is_default && (
                      <button
                        onClick={() => handleSetDefault(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Set as default"
                      >
                        <Star size={12} /> Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      style={{ display: 'flex', alignItems: 'center', padding: 6, border: 'none', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}
                      title="Delete template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ws-modal-footer">
          <button className="ws-modal-btn ws-modal-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Billing Page ────────────────────────────────────── */
export default function Billing() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const [bills, setBills] = useState([])
  const [summary, setSummary] = useState({ revenue: 0, count: 0, pending: 0, paid: 0 })
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, displayId: '' })
  const [previewBill, setPreviewBill] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [shopInfo, setShopInfo] = useState({ shopName: '', gstin: '', phone: '', address: '' })

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'id_asc', 'id_desc', 'amount_asc', 'amount_desc'
  const [filterStatus, setFilterStatus] = useState('all') // default all
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

  useEffect(() => {
    dispatch(setActiveNav('Billing'))
    fetchData(page)
    // Load shop info from sessionStorage
    try {
      const u = JSON.parse(sessionStorage.getItem('ws_user') || '{}')
      setShopInfo({ shopName: u.shopName || '', gstin: u.gstin || '', phone: u.phone || '', address: u.address || '' })
    } catch { }
  }, [dispatch, page, search, sort, filterStatus])

  const fetchData = async (currentPage = page) => {
    setLoading(true)
    try {
      const statusParam = filterStatus === 'all' ? '' : filterStatus
      const [billsRes, summaryRes] = await Promise.all([
        api.get(`/billing?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&status=${statusParam}`),
        api.get('/billing/summary')
      ])
      setBills(billsRes.data?.data || [])
      setTotal(billsRes.data?.total || 0)
      let rev = 0, totalCount = 0, pendingCount = 0, paidCount = 0
      summaryRes.data?.forEach(s => {
        const val = parseFloat(s.total) || 0
        const cnt = parseInt(s.count) || 0
        totalCount += cnt
        if (s.status === 'paid') { rev = val; paidCount = cnt }
        else if (s.status === 'unpaid') { pendingCount = cnt }
      })
      setSummary({ revenue: rev, count: totalCount, pending: pendingCount, paid: paidCount })
    } catch {
      dispatch(addToast({ message: 'Failed to load billing details', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/billing/${id}/pay`)
      dispatch(addToast({ message: 'Bill marked as Paid', type: 'success' }))
      fetchData()
    } catch {
      dispatch(addToast({ message: 'Failed to update bill', type: 'error' }))
    }
  }

  const handlePreview = async (bill) => {
    try {
      const res = await api.get(`/billing/${bill.id}`)
      setPreviewBill(res.data)
    } catch {
      setPreviewBill(bill)
    }
  }

  const handleConfirmDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, displayId: '' })
    try {
      await api.delete(`/billing/${id}`)
      dispatch(addToast({ message: 'Bill deleted', type: 'success' }))
      fetchData()
    } catch {
      dispatch(addToast({ message: 'Failed to delete bill', type: 'error' }))
    }
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(val) || 0)

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
          <div className="attio-products-container">
            {/* Top Toolbar */}
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Billing</span>
                <span className="ws-unified-header-badge">{total} invoices</span>
              </div>
              <div className="ws-unified-header-actions">
                {/* Search box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search bills..."
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
                    background: showFilterBar || filterStatus !== 'all' ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar || filterStatus !== 'all' ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar || filterStatus !== 'all' ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>

                <button
                  className="attio-btn"
                  onClick={() => setShowTemplates(true)}
                  title="Manage bill templates"
                >
                  <FileText size={13} /> Templates
                </button>

                <button className="attio-btn attio-btn-primary" onClick={() => navigate('/billing/new')}>
                  <Plus size={13} style={{ marginRight: '4px' }} /> New Bill
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="ws-stats-grid" style={{ marginBottom: 20 }}>
              {[
                { label: 'Total Revenue', value: formatCurrency(summary.revenue), icon: <TrendingUp size={16} color="#059669" />, change: 'Paid' },
                { label: 'Bills Generated', value: String(summary.count), icon: <Receipt size={16} color="#3d68f5" />, change: 'Invoices' },
                { label: 'Pending Bills', value: String(summary.pending), icon: <Clock size={16} color="#d97706" />, change: 'Action needed' },
                { label: 'Paid Bills', value: String(summary.paid), icon: <CheckCircle size={16} color="#059669" />, change: 'Completed' },
              ].map(s => (
                <div className="ws-stat-card" key={s.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="ws-stat-card-label">{s.label}</div>
                    {s.icon}
                  </div>
                  <div className="ws-stat-card-value">{s.value}</div>
                  <div className="ws-stat-card-change up">{s.change}</div>
                </div>
              ))}
            </div>

            {/* Expandable Filter Box */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Status:</span>
                  <select
                    className="attio-select"
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  >
                    <option value="all">All Invoices</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {filterStatus !== 'all' && (
                  <button
                    onClick={() => { setFilterStatus('all'); setPage(1); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Reset Filters
                  </button>
                )}
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
                    No bills generated yet. Click "New Bill" to create one.
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
                        <th>CUSTOMER</th>
                        <th>TOTAL</th>
                        <th>DUE DATE</th>
                        <th>STATUS</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map(bill => {
                        const name = bill.customer_name || 'General Customer'
                        const colors = getPillStyle(bill.status === 'paid' ? 'Paid' : 'Pending')
                        const isRowSelected = selectedIds.includes(bill.id)
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
                            <td className="ws-td-mono">INV-{String(bill.id).padStart(3, '0')}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="attio-avatar" style={{ background: getAvatarColor(name) }}>
                                  {getSingleLetter(name)}
                                </div>
                                <span className="ws-table-name-text">{name}</span>
                              </div>
                            </td>
                            <td className="ws-td-price">{formatCurrency(bill.amount)}</td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{formatDate(bill.due_date)}</td>
                            <td>
                              <span className="ws-pill-topic" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                                {bill.status === 'paid' ? 'Paid' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                {/* Preview */}
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{ color: '#3d68f5', padding: 6, backgroundColor: '#eff6ff' }}
                                  onClick={() => handlePreview(bill)}
                                  title="Preview Invoice"
                                >
                                  <Eye size={13} />
                                </button>
                                {/* Mark Paid */}
                                {bill.status === 'unpaid' && (
                                  <button
                                    className="ws-chat-history-delete-btn"
                                    style={{ color: '#10b981', padding: 6, backgroundColor: '#ecfdf5' }}
                                    onClick={() => handleMarkPaid(bill.id)}
                                    title="Mark as Paid"
                                  >
                                    <Check size={13} />
                                  </button>
                                )}
                                {/* Delete */}
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{ padding: 6 }}
                                  onClick={() => setConfirmDelete({ isOpen: true, id: bill.id, displayId: 'INV-' + String(bill.id).padStart(3, '0') })}
                                  title="Delete Bill"
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

      {/* Bill Preview Modal */}
      {previewBill && (
        <BillPreview
          bill={previewBill}
          shopName={shopInfo.shopName}
          shopGstin={shopInfo.gstin}
          shopPhone={shopInfo.phone}
          shopAddress={shopInfo.address}
          onClose={() => setPreviewBill(null)}
        />
      )}

      {/* Template Manager Modal */}
      {showTemplates && <TemplateManagerModal onClose={() => setShowTemplates(false)} />}

      {/* Confirm Delete */}
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