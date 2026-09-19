import React from 'react'
import { Sliders, HelpCircle, Sparkles } from 'lucide-react'
import { ExpandSidebarIcon } from '../icons/SidebarIcons'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { toggleSidebar, selectActiveNav, selectSidebarOpen, setSidebarTriggerHovered, toggleConfigure, toggleChat, selectChatOpen } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import './Topbar.css'

let topbarLeaveTimer = null

export default function Topbar() {
  const dispatch    = useAppDispatch()
  const activeNav   = useAppSelector(selectActiveNav)
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const chatOpen    = useAppSelector(selectChatOpen)
  const { initials, shopName } = useAuth()

  const isHome = activeNav === 'Home'

  const handleMouseEnterZone = () => {
    if (topbarLeaveTimer) clearTimeout(topbarLeaveTimer)
    if (!sidebarOpen) {
      dispatch(setSidebarTriggerHovered(true))
    }
  }

  const handleMouseLeaveZone = () => {
    if (topbarLeaveTimer) clearTimeout(topbarLeaveTimer)
    topbarLeaveTimer = setTimeout(() => {
      if (!sidebarOpen) {
        dispatch(setSidebarTriggerHovered(false))
      }
    }, 200)
  }

  return (
    <header className="ws-topbar">
      <div className="ws-topbar-left">
        {!sidebarOpen && (
          <div 
            className="ws-topbar-expand-zone"
            onMouseEnter={handleMouseEnterZone}
            onMouseLeave={handleMouseLeaveZone}
          >
            <div className="ws-sb-collapse-wrapper">
              <button
                className="ws-sb-collapse-btn"
                onClick={() => {
                  if (topbarLeaveTimer) clearTimeout(topbarLeaveTimer)
                  dispatch(toggleSidebar())
                }}
                aria-label="Expand sidebar"
              >
                <ExpandSidebarIcon size={16} />
              </button>
              <div className="ws-sb-tooltip" style={{ left: '0', transform: 'none', right: 'auto' }}>
                <span>Expand sidebar</span>
                <div className="ws-sb-tooltip-shortcut">
                  <kbd className="ws-sb-kbd-badge">CTRL</kbd>
                  <kbd className="ws-sb-kbd-badge">.</kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="ws-topbar-breadcrumb">
          <h1 className="ws-topbar-title">{activeNav}</h1>
        </div>
      </div>

      <div className="ws-topbar-right">
        {isHome && (
          <>
            <button className="ws-topbar-action-btn" onClick={() => dispatch(toggleConfigure())}>
              <Sliders size={13} />
              Configure
            </button>
            <button className="ws-topbar-action-btn">
              <HelpCircle size={13} />
              Help
            </button>
          </>
        )}
        <button
          type="button"
          className={`ws-topbar-chat-btn${chatOpen ? ' active' : ''}`}
          onClick={() => dispatch(toggleChat())}
          title="Toggle AI Assistant"
          aria-label="Toggle AI Chat"
        >
          <Sparkles size={14} style={{ color: chatOpen ? '#ffffff' : '#2563eb' }} />
          <span className="ws-topbar-chat-label">AI Chat</span>
        </button>
        <div className="ws-topbar-avatar" title={shopName}>
          {initials}
        </div>
      </div>
    </header>
  )
}
