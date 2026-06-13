import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Receipt, TrendingUp, Clock, CheckCircle, X, Trash2, Loader2, Check } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'

const STATUS_MAP = {
  paid:      { bg: '#dcfce7', text: '#166534', label: 'Paid' },
  unpaid:    { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
}

// BillForm moved to a separate page component

import { useNavigate } from 'react-router-dom'

export default function Billing() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()
  
  const [bills, setBills] = useState([])
  const [summary, setSummary] = useState({ revenue: 0, count: 0, pending: 0, paid: 0 })
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, displayId: '' })

  useEffect(() => { 
    dispatch(setActiveNav('Billing')) 
    fetchData()
  }, [dispatch])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [billsRes, summaryRes] = await Promise.all([
        api.get('/billing'),
        api.get('/billing/summary')
      ])
      
      setBills(billsRes.data?.data || [])
      
      let rev = 0
      let totalCount = 0
      let pendingCount = 0
      let paidCount = 0
      
      summaryRes.data?.forEach(s => {
        const val = parseFloat(s.total) || 0
        const cnt = parseInt(s.count) || 0
        totalCount += cnt
        if (s.status === 'paid') {
          rev = val
          paidCount = cnt
        } else if (s.status === 'unpaid') {
          pendingCount = cnt
        }
      })
      
      setSummary({ revenue: rev, count: totalCount, pending: pendingCount, paid: paidCount })
    } catch (err) {
      dispatch(addToast({ message: 'Failed to load billing details', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }



  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/billing/${id}/pay`)
      dispatch(addToast({ message: 'Bill marked as Paid successfully', type: 'success' }))
      fetchData()
    } catch (err) {
      dispatch(addToast({ message: 'Failed to update bill', type: 'error' }))
    }
  }

  const handleConfirmDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, displayId: '' })
    try {
      await api.delete(`/billing/${id}`)
      dispatch(addToast({ message: 'Bill deleted successfully', type: 'success' }))
      fetchData()
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete bill', type: 'error' }))
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
          <div className="ws-dash-greeting">Billing</div>

          <div className="ws-stats-grid" style={{ marginBottom: 28 }}>
            {[
              { label: "Total Revenue",  value: formatCurrency(summary.revenue),  icon: <TrendingUp size={16} color="#059669" />, change: 'Paid' },
              { label: 'Bills Generated',  value: String(summary.count),       icon: <Receipt size={16} color="#3d68f5" />,    change: 'Invoices' },
              { label: 'Pending Bills',    value: String(summary.pending),        icon: <Clock size={16} color="#d97706" />,      change: 'Action needed' },
              { label: 'Paid Bills',       value: String(summary.paid),       icon: <CheckCircle size={16} color="#059669" />,change: 'Completed' },
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

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div>
                <h2 className="ws-table-title">Recent Bills</h2>
                <p className="ws-table-sub">GST-compliant invoices</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/billing/add')}>
                  <Plus size={13} /> New Bill
                </button>
              </div>
            </div>
            <div className="ws-table-wrap">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={24} className="ws-chat-loader-spin" />
                </div>
              ) : bills.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  No bills generated yet. Click "New Bill" to create one.
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" className="ws-table-checkbox" readOnly /></th>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(bill => {
                      const name = bill.customer_name || 'General Customer'
                      const colors = getPillStyle(bill.status === 'paid' ? 'Paid' : 'Pending')
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
                              {bill.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
