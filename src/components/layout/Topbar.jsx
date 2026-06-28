import React from 'react'
import { Menu, ArrowUpDown, Sparkles, Plus, Sliders, HelpCircle } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { toggleSidebar, selectActiveNav, toggleConfigure } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import './Topbar.css'

export default function Topbar() {
  const dispatch  = useAppDispatch()
  const activeNav = useAppSelector(selectActiveNav)
  const { initials, shopName } = useAuth()

  const isHome = activeNav === 'Home'

  return (
    <header className="ws-topbar">
      <div className="ws-topbar-left">
        <button
          className="ws-topbar-menu-btn"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <h1 className="ws-topbar-title">{activeNav}</h1>
      </div>

      <div className="ws-topbar-right">
        {isHome ? (
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
        ) : (
          <>
            <button className="ws-topbar-action-btn">
              <ArrowUpDown size={13} />
              Sort
            </button>
            <button className="ws-topbar-action-btn">
              <Plus size={13} />
              New
            </button>
            <button 
              className="ws-topbar-action-btn ws-topbar-invite-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('ws-open-invite'))}
            >
              <Plus size={13} style={{ color: 'var(--color-blue)' }} />
              Invite
            </button>
            <div className="ws-topbar-avatar" title={shopName}>
              {initials}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
