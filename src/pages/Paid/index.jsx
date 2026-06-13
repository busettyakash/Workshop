import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Trash2, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    dispatch(setActiveNav('Paid'))
    fetchPaidBills()
  }, [dispatch])

  const fetchPaidBills = async () => {
    setLoading(true)
    try {
      const res = await api.get('/billing?status=paid')
      setBills(res.data?.data || [])
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

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div>
                <h2 className="ws-table-title">Paid Invoices</h2>
                <p className="ws-table-sub">{bills.length} paid invoices total</p>
              </div>
            </div>

            <div className="ws-table-wrap">
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
