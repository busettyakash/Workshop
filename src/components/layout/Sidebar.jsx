import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Bell, BarChart3, Settings,
  Package, BookOpen, Receipt, CheckCircle, XCircle,
  Users, UserCheck, GitBranch,
  Search, ChevronDown, ChevronRight, LogOut, UserPlus, Zap, Menu, X,
  Briefcase, User, CheckSquare, FileText, Mail, Phone, Send, Folder, LayoutGrid, Play, Star,
  MessageSquare, Upload, UserRound, ScrollText
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectActiveNav, toggleSidebar, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { logout } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants'
import api from '../../api/client'
import './Sidebar.css'

const ICON_MAP = {
  Home:          <Home size={14} />,
  Notifications: <Bell size={14} />,
  Tasks:         <CheckSquare size={14} />,
  Notes:         <FileText size={14} />,
  Emails:        <Mail size={14} />,
  Calls:         <Phone size={14} />,
  Reports:       <BarChart3 size={14} />,
  Automations:   <Play size={14} />,
  Sequences:     <Send size={14} />,
  Workflows:     <GitBranch size={14} />,
  Folder:        <Folder size={14} />,
  Deals:         <LayoutGrid size={14} />,
  Products:      <Package size={14} />,
  Customers:     <Users size={14} />,
  People:        <UserRound size={14} />,
  Contacts:      <User size={14} />,
  Billing:       <Receipt size={14} />,
  Paid:          <CheckCircle size={14} />,
  Unpaid:        <XCircle size={14} />,
  Settings:      <Settings size={14} />,
  Pipeline:      <Briefcase size={14} />,
  ImportStock:   <Upload size={14} />,
  DealLogs:      <ScrollText size={14} />,
}

// All nav items with their actual or fallback routes
const ALL_NAV_ITEMS = {
  'Home':          { icon: 'Home',          path: ROUTES.DASHBOARD },
  'Notes':         { icon: 'Notes',         path: ROUTES.NOTES },
  'Emails':        { icon: 'Emails',        path: ROUTES.EMAILS },
  'Reports':       { icon: 'Reports',       path: ROUTES.REPORTS },
  'Workflows':     { icon: 'Workflows',     path: '/workflows' },
  'Products':      { icon: 'Products',      path: ROUTES.PRODUCTS },
  'People':        { icon: 'People',        path: '/people' },
  'Deals':         { icon: 'Deals',         path: '/deals' },
  'Billing':       { icon: 'Billing',       path: ROUTES.BILLING },
  'Paid':          { icon: 'Paid',          path: ROUTES.PAID },
  'Unpaid':        { icon: 'Unpaid',        path: ROUTES.UNPAID },
  'Import Stock':  { icon: 'ImportStock',   path: ROUTES.IMPORT_STOCK },
  'Deal Logs':     { icon: 'DealLogs',      path: '/deal-logs' },
}

const MAIN_NAV = [
  { label: 'Home',    icon: 'Home',    path: ROUTES.DASHBOARD },
  { label: 'Notes',   icon: 'Notes',   path: ROUTES.NOTES },
  { label: 'Emails',  icon: 'Emails',  path: ROUTES.EMAILS },
  { label: 'Reports', icon: 'Reports', path: ROUTES.REPORTS },
]

const RECORDS_NAV = [
  { label: 'Products',     icon: 'Products',  path: ROUTES.PRODUCTS },
  { label: 'People',       icon: 'People',    path: '/people' },
  { label: 'Deals',        icon: 'Deals',     path: '/deals' },
  { label: 'Import Stock', icon: 'ImportStock', path: ROUTES.IMPORT_STOCK },
]

const BILLING_NAV = [
  { label: 'Billing',  icon: 'Billing',   path: ROUTES.BILLING },
  { label: 'Paid',     icon: 'Paid',      path: ROUTES.PAID },
  { label: 'Unpaid',   icon: 'Unpaid',    path: ROUTES.UNPAID },
]

const LISTS_NAV = [
  { label: 'Deal Logs', icon: 'DealLogs', path: '/deal-logs' },
]

function NavItem({ item, active, onClick, favorites, onToggleFav }) {
  const isFav = favorites.includes(item.label)

  const content = (
    <div className={`ws-sb-nav-item-wrapper ${active ? 'active' : ''}`}>
      <button
        className="ws-sb-nav-item-btn"
        onClick={() => onClick(item.label)}
      >
        {ICON_MAP[item.icon]}
        <span>{item.label}</span>
      </button>
      
      <button 
        className={`ws-sb-star-btn ${isFav ? 'favorited' : ''}`}
        onClick={(e) => onToggleFav(item.label, e)}
        aria-label={isFav ? "Remove from Favorites" : "Add to Favorites"}
      >
        <Star size={11} fill={isFav ? "#eab308" : "none"} stroke={isFav ? "#eab308" : "currentColor"} />
      </button>
    </div>
  )

  return (
    <Link to={item.path} style={{ display: 'block', textDecoration: 'none' }}>
      {content}
    </Link>
  )
}

export default function Sidebar() {
  const dispatch    = useAppDispatch()
  const navigate    = useNavigate()
  const activeNav   = useAppSelector(selectActiveNav)
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { shopName } = useAuth()

  const [automationsOpen, setAutomationsOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(true)

  const location = useLocation()
  const [chats, setChats] = useState([])
  const searchParams = new URLSearchParams(location.search)
  const activeSessionId = searchParams.get('session')

  useEffect(() => {
    const token = localStorage.getItem('ws_token')
    if (token) {
      api.get('/chat/sessions')
        .then(res => setChats(res.data || []))
        .catch(() => {})
    }
  }, [location])

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('ws_favorites')
    return saved ? JSON.parse(saved) : []
  })

  const toggleFavorite = (label, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const isFav = favorites.includes(label)
    let updated
    if (isFav) {
      updated = favorites.filter(item => item !== label)
      dispatch(addToast({ message: `Removed ${label} from Favorites.`, type: 'info' }))
    } else {
      updated = [...favorites, label]
      dispatch(addToast({ message: `Added ${label} to Favorites.`, type: 'success' }))
    }
    setFavorites(updated)
    localStorage.setItem('ws_favorites', JSON.stringify(updated))
  }

  const handleNav    = (label) => dispatch(setActiveNav(label))
  const handleLogout = () => { 
    dispatch(logout())
    dispatch(addToast({ message: 'Signed out successfully.', type: 'info' }))
    navigate(ROUTES.LOGIN) 
  }

  const logoLetter = shopName ? shopName.charAt(0).toUpperCase() : 'W'

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="ws-sb-overlay" onClick={() => dispatch(toggleSidebar())} />
      )}

      <aside className={`ws-sidebar${sidebarOpen ? ' ws-sidebar--open' : ''}`}>
        {/* Workspace Header */}
        <div className="ws-sb-header">
          <button className="ws-sb-workspace-btn">
            <div className="ws-sb-ws-icon" style={{ textTransform: 'uppercase', color: '#fff', fontWeight: '800', fontSize: '11px', fontFamily: 'sans-serif' }}>
              {logoLetter}
            </div>
            <span className="ws-sb-ws-name">{shopName}</span>
            <ChevronDown size={13} className="ws-sb-chevron" />
          </button>
          <button
            className="ws-sb-close-btn"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="ws-sb-search">
          <button className="ws-sb-searchbox">
            <Search size={13} />
            <span>Quick actions</span>
            <kbd className="ws-sb-kbd">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="ws-sb-nav">
          {/* Main List */}
          <div className="ws-sb-nav-list">
            {MAIN_NAV.map(item => (
              <NavItem 
                key={item.label} 
                item={item} 
                active={activeNav === item.label} 
                onClick={handleNav} 
                favorites={favorites}
                onToggleFav={toggleFavorite}
              />
            ))}

            {/* Collapsible Automations Item */}
            <div className="ws-sb-collapsible-item">
              <div className={`ws-sb-nav-item-wrapper ${activeNav === 'Sequences' || activeNav === 'Workflows' ? 'active' : ''}`}>
                <button 
                  className="ws-sb-nav-item-btn"
                  onClick={() => setAutomationsOpen(!automationsOpen)}
                >
                  {ICON_MAP.Automations}
                  <span>Automations</span>
                </button>
                <button 
                  className={`ws-sb-arrow-btn ${automationsOpen ? 'rotated' : ''}`}
                  onClick={() => setAutomationsOpen(!automationsOpen)}
                  aria-label="Toggle sublist"
                >
                  <ChevronRight size={12} className="ws-sb-arrow" />
                </button>
              </div>
              
              {automationsOpen && (
                <div className="ws-sb-sublist">
                  <Link to="/workflows" style={{ textDecoration: 'none' }} onClick={() => handleNav('Workflows')}>
                    <div className={`ws-sb-subitem ${activeNav === 'Workflows' ? 'active' : ''}`}>
                      {ICON_MAP.Workflows}
                      <span>Workflows</span>
                      <button 
                        className={`ws-sb-star-btn ${favorites.includes('Workflows') ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorite('Workflows', e)}
                      >
                        <Star size={10} fill={favorites.includes('Workflows') ? "#eab308" : "none"} stroke={favorites.includes('Workflows') ? "#eab308" : "currentColor"} />
                      </button>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Favorites Collapsible Section */}
          <div className="ws-sb-section">
            <button 
              className="ws-sb-section-header"
              onClick={() => setFavoritesOpen(!favoritesOpen)}
            >
              <ChevronRight size={12} className={`ws-sb-arrow ${favoritesOpen ? 'rotated' : ''}`} />
              <span>Favorites</span>
            </button>
            
            {favoritesOpen && (
              <div className="ws-sb-section-body">
                {favorites.length === 0 ? (
                  <div className="ws-sb-empty-note">No favorites added yet</div>
                ) : (
                  favorites.map(favLabel => {
                    const details = ALL_NAV_ITEMS[favLabel]
                    if (!details) return null
                    return (
                      <Link to={details.path} key={favLabel} style={{ textDecoration: 'none' }} onClick={() => handleNav(favLabel)}>
                        <div className={`ws-sb-subitem ${activeNav === favLabel ? 'active' : ''}`}>
                          {ICON_MAP[details.icon]}
                          <span>{favLabel}</span>
                          <button 
                            className="ws-sb-star-btn favorited"
                            onClick={(e) => toggleFavorite(favLabel, e)}
                          >
                            <Star size={10} fill="#eab308" stroke="#eab308" />
                          </button>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="ws-sb-section-label">Records</div>
          <div className="ws-sb-nav-list">
            {RECORDS_NAV.map(item => (
              <NavItem 
                key={item.label} 
                item={item} 
                active={activeNav === item.label} 
                onClick={handleNav} 
                favorites={favorites}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>

          <div className="ws-sb-section-label">Billing</div>
          <div className="ws-sb-nav-list">
            {BILLING_NAV.map(item => (
              <NavItem 
                key={item.label} 
                item={item} 
                active={activeNav === item.label} 
                onClick={handleNav} 
                favorites={favorites}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>

          <div className="ws-sb-section-label">Lists</div>
          <div className="ws-sb-nav-list">
            {LISTS_NAV.map(item => (
              <NavItem 
                key={item.label} 
                item={item} 
                active={activeNav === item.label} 
                onClick={handleNav} 
                favorites={favorites}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>

          <div className="ws-sb-section-label">Chats</div>
          <div className="ws-sb-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
            {chats.length === 0 ? (
              <div className="ws-sb-empty-note" style={{ fontSize: '0.75rem', color: '#9ca3af', padding: '6px 12px' }}>No chats yet</div>
            ) : (
              chats.slice(0, 8).map(c => {
                const isActive = activeSessionId === String(c.id)
                return (
                  <Link 
                    to={`/dashboard?session=${c.id}`} 
                    key={c.id} 
                    style={{ textDecoration: 'none', display: 'block' }}
                    onClick={() => handleNav('Home')}
                  >
                    <div className={`ws-sb-subitem ${isActive ? 'active' : ''}`} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '6px 12px', 
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: isActive ? '#3d68f5' : '#4b5563',
                      background: isActive ? '#eff6ff' : 'transparent',
                      transition: 'all 0.12s'
                    }}>
                      <MessageSquare size={13} style={{ flexShrink: 0 }} />
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: isActive ? '600' : '450'
                      }}>
                        {c.title || 'Untitled chat'}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </nav>

        {/* Bottom */}
        <div className="ws-sb-bottom">
          <div className="ws-sb-footer-actions">
            <button className="ws-sb-invite-btn">
              <UserPlus size={14} />
              Invite teammates
            </button>
            <button className="ws-sb-footer-item ws-sb-footer-item--danger" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
