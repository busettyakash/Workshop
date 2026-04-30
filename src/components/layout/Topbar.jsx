import React from 'react'
import { Menu, Search, ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { toggleSidebar, selectActiveNav } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import './Topbar.css'

export default function Topbar() {
  const dispatch  = useAppDispatch()
  const activeNav = useAppSelector(selectActiveNav)
  const { initials, shopName } = useAuth()

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
        <button className="ws-topbar-action-btn">
          <ArrowUpDown size={13} />
          Sort
        </button>
        <button className="ws-topbar-action-btn">
          <SlidersHorizontal size={13} />
          Filter
        </button>
        <div className="ws-topbar-avatar" title={shopName}>
          {initials}
        </div>
      </div>
    </header>
  )
}
