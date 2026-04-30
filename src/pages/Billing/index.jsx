import React from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch } from '../../redux/hooks'
import { setActiveNav } from '../../redux/slices/uiSlice'
import { Plus, Receipt, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import '../Dashboard/Dashboard.css'

const BILLS = [
  { id: 'INV-001', customer: 'Rahul Sharma', items: 3, total: '₹12,500', date: 'Today, 10:30 AM', status: 'Paid' },
  { id: 'INV-002', customer: 'Priya Mehta',  items: 1, total: '₹24,900', date: 'Today, 09:15 AM', status: 'Paid' },
  { id: 'INV-003', customer: 'Amit Kumar',   items: 5, total: '₹8,250',  date: 'Yesterday',       status: 'Pending' },
  { id: 'INV-004', customer: 'Sunita Patel', items: 2, total: '₹3,999',  date: 'Yesterday',       status: 'Paid' },
  { id: 'INV-005', customer: 'Vikram Singh', items: 4, total: '₹18,750', date: '2 days ago',      status: 'Cancelled' },
]

const STATUS_MAP = {
  Paid:      { bg: '#dcfce7', text: '#166534' },
  Pending:   { bg: '#fef3c7', text: '#92400e' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b' },
}

export default function Billing() {
  const dispatch = useAppDispatch()
  React.useEffect(() => { dispatch(setActiveNav('Billing')) }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className="ws-dash-content">
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Billing</div>

          <div className="ws-stats-grid" style={{ marginBottom: 28 }}>
            {[
              { label: "Today's Revenue",  value: '₹37,400',  icon: <TrendingUp size={16} color="#059669" />, change: '+18%' },
              { label: 'Bills Generated',  value: '12',       icon: <Receipt size={16} color="#3d68f5" />,    change: 'Today' },
              { label: 'Pending Bills',    value: '3',        icon: <Clock size={16} color="#d97706" />,      change: 'Action needed' },
              { label: 'Paid Bills',       value: '9',        icon: <CheckCircle size={16} color="#059669" />,change: 'Today' },
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
                <button className="ws-table-btn ws-table-btn--primary">
                  <Plus size={13} /> New Bill
                </button>
              </div>
            </div>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {BILLS.map(bill => {
                    const colors = STATUS_MAP[bill.status] || {}
                    return (
                      <tr key={bill.id}>
                        <td className="ws-td-mono">{bill.id}</td>
                        <td className="ws-td-name">{bill.customer}</td>
                        <td>{bill.items} items</td>
                        <td className="ws-td-price">{bill.total}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{bill.date}</td>
                        <td>
                          <span className="ws-pill" style={{ background: colors.bg, color: colors.text }}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
