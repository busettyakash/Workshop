import React, { useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import BusinessMetrics from '../Dashboard/BusinessMetrics'
import { 
  HelpCircle, SlidersHorizontal, Search, Grid, Plus, Star, 
  LayoutDashboard, Info, BarChart3, Database 
} from 'lucide-react'
import '../Dashboard/Dashboard.css'

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'graph'
  
  React.useEffect(() => {
    dispatch(setActiveNav('Reports'))
  }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        
        {/* Custom Topbar matching Reports Screenshot */}
        <header className="ws-chat-header" style={{ padding: '0 28px' }}>
          <div className="ws-chat-header-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Reports</span>
          </div>
          <div className="ws-chat-header-right" style={{ color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HelpCircle size={15} />
            <span>Help</span>
          </div>
        </header>

        <main className="ws-dash-body" style={{ background: '#ffffff', padding: '24px 28px' }}>
          
          {/* Sub-toolbar row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {/* Left toolbar */}
            <div>
              <button className="ws-table-btn" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                <SlidersHorizontal size={13} style={{ marginRight: 6 }} />
                Sorted by <strong>Creation date</strong>
              </button>
            </div>

            {/* Right toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="ws-table-btn" style={{ padding: '6px 8px' }} title="Search">
                <Search size={14} />
              </button>
              <button className="ws-table-btn" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                <Grid size={13} style={{ marginRight: 6 }} />
                View settings
              </button>
              
              {/* Toggle switch for view mode */}
              <button 
                className="ws-table-btn" 
                onClick={() => setViewMode(viewMode === 'table' ? 'graph' : 'table')}
                style={{ fontSize: '0.82rem', padding: '6px 12px', background: '#f3f4f6', color: '#1f2937', borderColor: '#d1d5db', fontWeight: 600 }}
              >
                {viewMode === 'table' ? (
                  <>
                    <BarChart3 size={13} style={{ marginRight: 6 }} />
                    Show Graph
                  </>
                ) : (
                  <>
                    <Grid size={13} style={{ marginRight: 6 }} />
                    Show Table
                  </>
                )}
              </button>

              <button className="ws-table-btn ws-table-btn--primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                <Plus size={14} style={{ marginRight: 6 }} />
                New dashboard
              </button>
            </div>
          </div>

          {/* Dual format view switcher */}
          {viewMode === 'table' ? (
            <div>
              {/* Favorites Dashed Container */}
              <div className="ws-rep-fav-card">
                <div className="ws-rep-fav-title">Favorites</div>
                <div className="ws-rep-fav-desc">Dashboards that you favorite will appear here</div>
              </div>

              {/* Styled Table list of Dashboards */}
              <div className="ws-table-section" style={{ border: 'none', background: 'none' }}>
                <table className="ws-table-styled" style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%', borderLeft: 'none' }}>Dashboard</th>
                      <th style={{ width: '40%' }}>Reports</th>
                      <th style={{ width: '20%', borderRight: 'none' }}>Created at</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                        No Dashboards available. Click "New dashboard" to create one.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="ws-reports-container" style={{ marginTop: '0px' }}>
              {/* BusinessMetrics renders charts dynamically */}
              <BusinessMetrics />
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
