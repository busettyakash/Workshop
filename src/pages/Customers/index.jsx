import React from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav } from '../../redux/slices/uiSlice'
import { selectCustomers } from '../../redux/slices/dashboardSlice'
import { Plus, Filter, ArrowUpDown } from 'lucide-react'
import { getInitials } from '../../utils/formatters'
import '../Dashboard/Dashboard.css'

/* ── pill colour maps ── */
const typeStyles = {
  Premium: { background: '#ede9fe', color: '#6d28d9' },
  Member: { background: '#ede9fe', color: '#7c3aed' },
}

const loyaltyStyles = {
  Gold: { background: '#dcfce7', color: '#15803d' },
  Platinum: { background: '#ede9fe', color: '#7c3aed' },
  Inactive: { background: '#f3f4f6', color: '#9ca3af' },
}

export default function Customers() {
  const dispatch = useAppDispatch()
  const customers = useAppSelector(selectCustomers)
  React.useEffect(() => { dispatch(setActiveNav('Customers')) }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className="ws-dash-content">
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Customers</div>

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div>
                <h2 className="ws-table-title">All Customers</h2>
                <p className="ws-table-sub">{customers.length} customers</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn"><Filter size={13} /> Filter</button>
                <button className="ws-table-btn"><ArrowUpDown size={13} /> Sort</button>
                <button className="ws-table-btn ws-table-btn--primary"><Plus size={13} /> Add Customer</button>
              </div>
            </div>

            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Customer</th>
                    <th>Customer ID</th>
                    <th>Customer type</th>
                    <th>Loyalty score</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const tStyle = typeStyles[c.type] || typeStyles.Member
                    const lStyle = loyaltyStyles[c.loyalty] || loyaltyStyles.Inactive

                    return (
                      <tr key={c.id}>
                        {/* Avatar */}
                        <td>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: '#e5e7eb',
                            color: '#6b7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.68rem', fontWeight: 600, flexShrink: 0,
                          }}>
                            {getInitials(c.name)}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="ws-td-name">{c.name}</td>

                        {/* Customer ID — monospaced */}
                        <td className="ws-td-mono">{c.id}</td>

                        {/* Customer type pill */}
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 9999,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            ...tStyle,
                          }}>
                            {c.type}
                          </span>
                        </td>

                        {/* Loyalty score pill */}
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 9999,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            ...lStyle,
                          }}>
                            {c.loyalty}
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