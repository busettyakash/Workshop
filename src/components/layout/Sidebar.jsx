import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Bell, BarChart3, Settings,
  Package, BookOpen, Receipt, CheckCircle, XCircle,
  Users, UserCheck, GitBranch, Building2,
  Search, ChevronDown, ChevronRight, LogOut, UserPlus, Zap, Menu, X,
  Briefcase, User, CheckSquare, FileText, Mail, Phone, Send, Folder, LayoutGrid, Play, Star,
  MessageSquare, Upload, UserRound, ScrollText, DollarSign
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectActiveNav, toggleSidebar, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { logout } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants'
import api from '../../api/client'
import { authApi } from '../../services/authApi'
import './Sidebar.css'

const ICON_MAP = {
  Home:          <Home size={14} />,
  Notifications: <Bell size={14} />,
  Tasks:         <CheckSquare size={14} />,
  Notes:         <FileText size={14} />,
  Calls:         <Phone size={14} />,
  Reports:       <BarChart3 size={14} />,
  Automations:   <Play size={14} />,
  Sequences:     <Send size={14} />,
  Workflows:     <GitBranch size={14} />,
  Folder:        <Folder size={14} />,
  Deals:         <DollarSign size={14} />,
  Products:      <Package size={14} />,
  Customers:     <Users size={14} />,
  Companies:     <Building2 size={14} />,
  People:        <User size={14} />,
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
  'Notifications': { icon: 'Notifications', path: '/notifications' },
  'Notes':         { icon: 'Notes',         path: ROUTES.NOTES },
  'Reports':       { icon: 'Reports',       path: ROUTES.REPORTS },
  'Workflows':     { icon: 'Workflows',     path: '/workflows' },
  'Products':      { icon: 'Products',      path: ROUTES.PRODUCTS },
  'Companies':     { icon: 'Companies',     path: '/' },
  'People':        { icon: 'People',        path: '/people' },
  'Deals':         { icon: 'Deals',         path: '/deals' },
  'Billing':       { icon: 'Billing',       path: ROUTES.BILLING },
  'Paid':          { icon: 'Paid',          path: ROUTES.PAID },
  'Unpaid':        { icon: 'Unpaid',        path: ROUTES.UNPAID },
  'Import Stock':  { icon: 'ImportStock',   path: ROUTES.IMPORT_STOCK },
  'Deal Logs':     { icon: 'DealLogs',      path: '/deal-logs' },
}

const MAIN_NAV = [
  { label: 'Home',          icon: 'Home',          path: ROUTES.DASHBOARD },
  { label: 'Notifications', icon: 'Notifications', path: '/notifications' },
  { label: 'Notes',         icon: 'Notes',         path: ROUTES.NOTES },
  { label: 'Reports',       icon: 'Reports',       path: ROUTES.REPORTS },
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

  const [favorites, setFavorites] = useState(() => {
    const saved = sessionStorage.getItem('ws_favorites')
    return saved ? JSON.parse(saved) : []
  })

  const [workspaces, setWorkspaces] = useState([])
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Member')
  const [inviting, setInviting] = useState(false)

  // Reactive workspace state — reads from sessionStorage on mount and updates on switch
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(
    () => sessionStorage.getItem('ws_active_workspace_name') || shopName
  )
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => sessionStorage.getItem('ws_active_workspace_id') || ''
  )

  useEffect(() => {
    const handleOpenInvite = () => setInviteModalOpen(true)
    window.addEventListener('ws-open-invite', handleOpenInvite)
    return () => window.removeEventListener('ws-open-invite', handleOpenInvite)
  }, [])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    if (!inviteEmail?.trim()) return
    setInviting(true)
    try {
      await authApi.invite({ email: inviteEmail, role: inviteRole })
      dispatch(addToast({ message: `Invitation sent to ${inviteEmail}`, type: 'success' }))
      setInviteEmail('')
      setInviteModalOpen(false)
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send invite'
      dispatch(addToast({ message: msg, type: 'error' }))
    } finally {
      setInviting(false)
    }
  }

  // Keep reactive state in sync with sessionStorage on mount
  useEffect(() => {
    const storedName = sessionStorage.getItem('ws_active_workspace_name')
    const storedId = sessionStorage.getItem('ws_active_workspace_id')
    if (storedName) setActiveWorkspaceName(storedName)
    if (storedId) setActiveWorkspaceId(storedId)
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem('ws_token')
    if (token) {
      api.get('/chat/sessions')
        .then(res => setChats(res.data || []))
        .catch(() => {})

      authApi.getWorkspaces()
        .then(data => {
          setWorkspaces(data || [])
          const activeId = sessionStorage.getItem('ws_active_workspace_id')
          const isValid = data?.some(w => String(w.id) === String(activeId))
          if (!activeId || !isValid) {
            const owner = data?.find(w => w.isOwner)
            if (owner) {
              sessionStorage.setItem('ws_active_workspace_id', owner.id)
              sessionStorage.setItem('ws_active_workspace_name', owner.shopName)
              setActiveWorkspaceId(owner.id)
              setActiveWorkspaceName(owner.shopName)
              if (activeId && !isValid) {
                // If they had an invalid workspace selected, reload to refresh headers
                window.location.reload()
              }
            }
          } else {
            // Workspace is valid — sync name in case it changed
            const current = data?.find(w => String(w.id) === String(activeId))
            if (current && current.shopName !== activeWorkspaceName) {
              sessionStorage.setItem('ws_active_workspace_name', current.shopName)
              setActiveWorkspaceName(current.shopName)
            }
          }
        })
        .catch(() => {})
    }
  }, [location])

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
    sessionStorage.setItem('ws_favorites', JSON.stringify(updated))
  }

  const handleNav    = (label) => dispatch(setActiveNav(label))
  const handleLogout = () => { 
    dispatch(logout())
    dispatch(addToast({ message: 'Signed out successfully.', type: 'info' }))
    navigate(ROUTES.LOGIN) 
  }

  const logoLetter = activeWorkspaceName ? activeWorkspaceName.charAt(0).toUpperCase() : 'W'

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="ws-sb-overlay" onClick={() => dispatch(toggleSidebar())} />
      )}

      <aside className={`ws-sidebar${sidebarOpen ? ' ws-sidebar--open' : ''}`}>
        {/* Workspace Header */}
        <div className="ws-sb-header" style={{ position: 'relative' }}>
          <button className="ws-sb-workspace-btn" onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}>
            <div className="ws-sb-ws-icon" style={{ textTransform: 'uppercase', color: '#fff', fontWeight: '800', fontSize: '11px', fontFamily: 'sans-serif' }}>
              {logoLetter}
            </div>
            <span className="ws-sb-ws-name">{activeWorkspaceName}</span>
            <ChevronDown size={13} className="ws-sb-chevron" />
          </button>
          <button
            className="ws-sb-close-btn"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>

          {workspaceDropdownOpen && (
            <div className="ws-sb-ws-dropdown" style={{
              position: 'absolute',
              top: '55px',
              left: '12px',
              width: '216px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 1000,
              padding: '6px 0'
            }}>
              <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
                Switch Workspace
              </div>
              {workspaces.map(w => {
                const isActive = w.id === activeWorkspaceId
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      sessionStorage.setItem('ws_active_workspace_id', w.id)
                      sessionStorage.setItem('ws_active_workspace_name', w.shopName)
                      setActiveWorkspaceId(w.id)
                      setActiveWorkspaceName(w.shopName)
                      setWorkspaceDropdownOpen(false)
                      window.location.reload()
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: 'none',
                      background: isActive ? '#eff6ff' : 'transparent',
                      color: isActive ? '#3d68f5' : '#374151',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      textAlign: 'left',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isActive ? '#eff6ff' : '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = isActive ? '#eff6ff' : 'transparent'}
                  >
                    <span style={{ fontWeight: isActive ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                      {w.shopName}
                    </span>
                    {w.isOwner && (
                      <span style={{ fontSize: '0.65rem', background: '#f3f4f6', color: '#6b7280', padding: '1px 4px', borderRadius: '4px' }}>
                        Owner
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
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

          {LISTS_NAV.length > 0 && (
            <>
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
            </>
          )}

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
            <button className="ws-sb-invite-btn" onClick={() => setInviteModalOpen(true)}>
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

      {/* Invite Teammate Modal */}
      {inviteModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: '#fff',
            width: '400px',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#111827', fontFamily: 'sans-serif' }}>Invite Teammate</h3>
              <button 
                onClick={() => setInviteModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', fontFamily: 'sans-serif' }}>Teammate Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'sans-serif'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', fontFamily: 'sans-serif' }}>Role</label>
                <select 
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    background: '#fff',
                    outline: 'none',
                    fontFamily: 'sans-serif'
                  }}
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontFamily: 'sans-serif'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={inviting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--color-blue, #3d68f5)',
                    color: '#fff',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontFamily: 'sans-serif'
                  }}
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
