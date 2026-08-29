import React, { useState, useEffect } from 'react'
import Topbar from '../../components/layout/Topbar'
import Sidebar from '../../components/layout/Sidebar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import BusinessMetrics from '../Dashboard/BusinessMetrics'
import api from '../../api/client'
import { Grid, BarChart3 } from 'lucide-react'
import '../Dashboard/Dashboard.css'

function ReportsTableView() {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        setLoading(true)
        const [prodRes, custRes] = await Promise.allSettled([
          api.get('/reports/top-products'),
          api.get('/reports/top-customers')
        ])
        if (active) {
          if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data || [])
          if (custRes.status === 'fulfilled') setCustomers(custRes.value.data || [])
        }
      } catch (err) {
        console.error('Failed to load reports tables:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchData()
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#64748b' }}>
        Loading reports tables...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 12 }}>
      {/* Top Products Table */}
      <div className="ws-table-section" style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Product Sales Performance</h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{products.length} products</span>
        </div>
        <table className="ws-table-styled" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Product</th>
              <th style={{ width: '20%' }}>Category</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Units Sold (UOM)</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  No product sales records found
                </td>
              </tr>
            ) : (
              products.map((p, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: '#f1f5f9',
                      color: '#475569'
                    }}>
                      {p.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {Number(p.units_sold).toLocaleString('en-IN')} <span style={{ color: '#64748b', fontSize: '0.80rem', fontWeight: 500 }}>{p.uom || p.unit || ''}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{Number(p.revenue).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Top Customers Table */}
      <div className="ws-table-section" style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Customer Order Summary</h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{customers.length} customers</span>
        </div>
        <table className="ws-table-styled" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Customer Name</th>
              <th style={{ width: '30%' }}>Email / Contact</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Total Orders</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  No customer orders found
                </td>
              </tr>
            ) : (
              customers.map((c, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</td>
                  <td style={{ color: '#64748b' }}>{c.email || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.orders}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{Number(c.total_spent).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [viewMode, setViewMode] = useState('graph') // Default to 'graph'

  useEffect(() => {
    dispatch(setActiveNav('Reports'))
  }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />

        <main className="ws-dash-body" style={{ background: '#ffffff', padding: '24px 28px' }}>
          
          {/* Sub-toolbar row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20 }}>
            {/* Segmented View Switcher */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: 8, border: '1px solid #e2e8f0', gap: 3 }}>
                <button 
                  type="button"
                  onClick={() => setViewMode('graph')}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.80rem', 
                    padding: '5px 12px', 
                    background: viewMode === 'graph' ? '#ffffff' : 'transparent', 
                    color: viewMode === 'graph' ? '#2563eb' : '#64748b', 
                    borderRadius: 6,
                    border: 'none', 
                    fontWeight: viewMode === 'graph' ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'graph' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={14} />
                  Charts & Metrics
                </button>
                <button 
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.80rem', 
                    padding: '5px 12px', 
                    background: viewMode === 'table' ? '#ffffff' : 'transparent', 
                    color: viewMode === 'table' ? '#2563eb' : '#64748b', 
                    borderRadius: 6,
                    border: 'none', 
                    fontWeight: viewMode === 'table' ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Grid size={14} />
                  Table Breakdown
                </button>
              </div>
            </div>

          {/* View Container */}
          {viewMode === 'graph' ? (
            <div className="ws-reports-container" style={{ marginTop: '0px' }}>
              <BusinessMetrics />
            </div>
          ) : (
            <ReportsTableView />
          )}

        </main>
      </div>
    </div>
  )
}
