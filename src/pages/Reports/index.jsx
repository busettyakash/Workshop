import React, { useState, useEffect } from 'react'
import Topbar from '../../components/layout/Topbar'
import Sidebar from '../../components/layout/Sidebar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import BusinessMetrics from '../Dashboard/BusinessMetrics'
import { ArrowLeft } from 'lucide-react'
import '../Dashboard/Dashboard.css'

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [productFilter, setProductFilter] = useState('All Products')

  useEffect(() => {
    dispatch(setActiveNav('Reports'))
  }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />

        <main className="ws-dash-body" style={{ background: '#ffffff', padding: '24px 28px' }}>
          
          {/* Sub-toolbar row when inside category drilldown */}
          {selectedCategory && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 16 }}>
              <button
                type="button"
                className="attio-btn attio-btn-primary"
                onClick={() => {
                  setSelectedCategory(null)
                  setProductFilter('All Products')
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  fontSize: '0.80rem',
                  padding: '0 14px',
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={13} /> Back to all categories
              </button>
            </div>
          )}

          {/* View Container */}
          <div className="ws-reports-container" style={{ marginTop: '0px' }}>
            <BusinessMetrics 
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              productFilter={productFilter}
              setProductFilter={setProductFilter}
            />
          </div>

        </main>
      </div>
    </div>
  )
}
