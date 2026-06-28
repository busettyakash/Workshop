import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Bell, Check, Loader2, ExternalLink, Info } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

export default function Notifications() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    dispatch(setActiveNav('Notifications'))
    fetchNotifications()
  }, [dispatch])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data || [])
    } catch (err) {
      dispatch(addToast({ message: 'Failed to load notifications', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return
    setMarkingAll(true)
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      dispatch(addToast({ message: 'All notifications marked as read', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Failed to mark notifications as read', type: 'error' }))
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNotificationClick = async (notif) => {
    // If unread, mark it as read
    if (!notif.read) {
      try {
        await api.patch(`/notifications/${notif.id}/read`)
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      } catch (err) {
        console.error('Failed to mark notification as read', err)
      }
    }
    
    // Redirect if link is present
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                Notifications
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>
                Stay updated with activity on your deals and pipeline
              </p>
            </div>
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: markingAll ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => !markingAll && (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => !markingAll && (e.currentTarget.style.background = '#fff')}
              >
                {markingAll ? (
                  <Loader2 size={13} className="ws-chat-loader-spin" />
                ) : (
                  <Check size={13} />
                )}
                Mark all as read
              </button>
            )}
          </div>

          {/* Body List */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Loader2 size={24} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6b7280' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#9ca3af'
                }}>
                  <Bell size={20} />
                </div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>All caught up!</h3>
                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>No new notifications are available.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map((notif, index) => {
                  const isUnread = !notif.read
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        padding: '16px 20px',
                        borderBottom: index === notifications.length - 1 ? 'none' : '1px solid #f3f4f6',
                        background: isUnread ? '#f8faff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isUnread ? '#f0f4ff' : '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = isUnread ? '#f8faff' : '#fff')}
                    >
                      {/* Read status dot / indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%', pt: 2 }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isUnread ? '#3d68f5' : 'transparent',
                          flexShrink: 0
                        }} />
                      </div>

                      {/* Icon */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        background: isUnread ? '#eff6ff' : '#f3f4f6',
                        color: isUnread ? '#3d68f5' : '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Bell size={16} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            fontWeight: isUnread ? 600 : 500,
                            color: isUnread ? '#111827' : '#374151'
                          }}>
                            {notif.title}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {formatDate(notif.created_at)}
                          </span>
                        </div>
                        <p style={{
                          margin: '4px 0 0',
                          fontSize: '0.8125rem',
                          color: '#4b5563',
                          lineHeight: 1.4
                        }}>
                          {notif.body}
                        </p>
                        {notif.link && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 8,
                            fontSize: '0.75rem',
                            color: '#3d68f5',
                            fontWeight: 500
                          }}>
                            <span>View details</span>
                            <ExternalLink size={10} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
