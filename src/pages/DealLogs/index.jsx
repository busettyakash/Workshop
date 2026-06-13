import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Filter, ArrowUpDown, Loader2, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'

const EVENT_STYLES = {
  'Deal created':   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Stage changed':  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Note added':     { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  'Value updated':  { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  'Owner assigned': { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  'Deal closed won':  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Deal closed lost': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}

function getEventStyle(event) {
  for (const [key, val] of Object.entries(EVENT_STYLES)) {
    if (event?.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
}

export default function DealLogs() {
  const dispatch   = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dispatch(setActiveNav('Deal Logs'))
    fetchLogs()
  }, [dispatch])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/deals/logs')
      setLogs(res.data?.data || [])
    } catch {
      dispatch(addToast({ message: 'Failed to load deal logs', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Deal Logs</div>

          <div className="ws-table-section">
            <div className="ws-table-header">
              <div className="ws-table-header-left">
                <h2 className="ws-table-title">Activity Log</h2>
                <p className="ws-table-sub">{logs.length} {logs.length === 1 ? 'event' : 'events'}</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn" onClick={fetchLogs}>
                  <RefreshCw size={12} /> Refresh
                </button>
                <button className="ws-table-btn"><ArrowUpDown size={12} /> Sort</button>
                <button className="ws-table-btn"><Filter size={12} /> Filter</button>
              </div>
            </div>

            <div className="ws-table-wrap">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                  <Loader2 size={22} className="ws-chat-loader-spin" style={{ color: 'var(--color-gray-400)' }} />
                </div>
              ) : logs.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 4 }}>No activity yet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                    Deal activity will appear here when deals are created or updated
                  </p>
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th>Deal</th>
                      <th>Event</th>
                      <th>Change</th>
                      <th>By</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(row => {
                      const style = getEventStyle(row.event)
                      return (
                        <tr key={row.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.deal_title || ''), width: 26, height: 26, fontSize: '0.72rem', borderRadius: 6 }}>
                                {getSingleLetter(row.deal_title || '?')}
                              </div>
                              <span className="ws-table-name-text" style={{ fontWeight: 500 }}>{row.deal_title || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                              {row.event}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {row.from_value && row.to_value ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ color: 'var(--color-gray-400)' }}>{row.from_value}</span>
                                <span style={{ color: 'var(--color-gray-400)', fontSize: '0.75rem' }}>→</span>
                                <span style={{ color: 'var(--color-gray-800)', fontWeight: 500 }}>{row.to_value}</span>
                              </div>
                            ) : row.to_value ? (
                              <span style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>{row.to_value}</span>
                            ) : (
                              <span style={{ color: 'var(--color-gray-400)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.done_by || ''), width: 22, height: 22, fontSize: '0.65rem', borderRadius: '50%' }}>
                                {getSingleLetter(row.done_by || 'S')}
                              </div>
                              <span style={{ fontSize: '0.82rem', color: 'var(--color-gray-700)' }}>{row.done_by || 'System'}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-gray-500)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDate(row.created_at)}
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
    </div>
  )
}
