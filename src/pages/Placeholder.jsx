import React from 'react'
import Sidebar from '../components/layout/Sidebar'
import Topbar from '../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { setActiveNav, selectSidebarOpen } from '../redux/slices/uiSlice'
import { Construction } from 'lucide-react'
import './Dashboard/Dashboard.css'

export default function PlaceholderPage({ title }) {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  React.useEffect(() => { dispatch(setActiveNav(title)) }, [dispatch, title])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">{title}</div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 24px', textAlign: 'center',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
            background: 'var(--color-white)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-lg)',
              background: 'var(--color-gray-100)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Construction size={28} color="var(--color-gray-400)" />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.25rem',
              fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8,
            }}>
              {title} — Coming Soon
            </h2>
            <p style={{
              fontSize: '0.9rem', color: 'var(--color-text-secondary)',
              maxWidth: 360, lineHeight: 1.6,
            }}>
              This section is ready for your backend API. Connect your data source and
              this page will come alive with real-time records.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
