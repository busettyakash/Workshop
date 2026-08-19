import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import {
  Home, Bell, BarChart3, Settings,
  Package, BookOpen, Receipt, CheckCircle, CheckCircle2, XCircle,
  Users, UserCheck, GitBranch, Building2,
  Search, ChevronDown, ChevronRight, LogOut, UserPlus, Zap, Menu, X, Plus,
  Briefcase, User, CheckSquare, FileText, Mail, Phone, Send, Folder, LayoutGrid, Play, Star,
  MessageSquare, Upload, UserRound, ScrollText, DollarSign, History, ShoppingBag, PanelLeftClose, PanelLeftOpen, MoreHorizontal
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { CollapseSidebarIcon } from '../icons/SidebarIcons'
import {
  setActiveNav, selectActiveNav, toggleSidebar, selectSidebarOpen,
  selectSidebarTriggerHovered, selectSidebarContentHovered, setSidebarContentHovered, clearSidebarHover, addToast,
  selectAllChatsPanelOpen, setAllChatsPanelOpen, toggleAllChatsPanel
} from '../../redux/slices/uiSlice'
import { logout } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants'
import api from '../../api/client'
import { authApi } from '../../services/authApi'
import './Sidebar.css'

let sidebarLeaveTimer = null

const ICON_MAP = {
  Home: <Home size={14} />,
  Tasks: <CheckSquare size={14} />,
  Notes: <FileText size={14} />,
  Emails: <Mail size={14} />,
  Calls: <Phone size={14} />,
  Reports: <BarChart3 size={14} />,
  Automations: <Play size={14} />,
  Sequences: <Send size={14} />,
  Workflows: <GitBranch size={14} />,
  Folder: <Folder size={14} />,
  PriceHistory: <History size={14} />,
  Products: <Package size={14} />,
  Customers: <Users size={14} />,
  People: <User size={14} />,
  Contacts: <User size={14} />,
  Billing: <Receipt size={14} />,
  Quotes: <ScrollText size={14} />,
  Orders: <ShoppingBag size={14} />,
  Paid: <CheckCircle size={14} />,
  Unpaid: <XCircle size={14} />,
  Settings: <Settings size={14} />,
  Pipeline: <Briefcase size={14} />,
  ImportStock: <Upload size={14} />,
  UserPlus: <UserPlus size={14} />,
  LogOut: <LogOut size={14} />,
}

// All nav items for Favorites lookup
const ALL_NAV_ITEMS = {
  'Home': { icon: 'Home', path: ROUTES.DASHBOARD },
  'Notes': { icon: 'Notes', path: ROUTES.NOTES },
  'Emails': { icon: 'Emails', path: ROUTES.EMAILS },
  'Reports': { icon: 'Reports', path: ROUTES.REPORTS },
  'Workflows': { icon: 'Workflows', path: '/workflows' },
  'Products': { icon: 'Products', path: ROUTES.PRODUCTS },
  'People': { icon: 'People', path: '/people' },
  'Price History': { icon: 'PriceHistory', path: '/price-history' },
  'Product History': { icon: 'PriceHistory', path: '/price-history' },
  'Billing': { icon: 'Billing', path: ROUTES.BILLING },
  'Quotes': { icon: 'Quotes', path: '/quotes' },
  'Orders': { icon: 'Orders', path: '/orders' },
  'Paid': { icon: 'Paid', path: ROUTES.PAID },
  'Unpaid': { icon: 'Unpaid', path: ROUTES.UNPAID },
  'Import Stock': { icon: 'ImportStock', path: ROUTES.IMPORT_STOCK },
  'Settings': { icon: 'Settings', path: '/settings' },
}

const MAIN_NAV = [
  { label: 'Home', icon: 'Home', path: ROUTES.DASHBOARD },
  { label: 'Notes', icon: 'Notes', path: ROUTES.NOTES },
  { label: 'Emails', icon: 'Emails', path: ROUTES.EMAILS },
  { label: 'Reports', icon: 'Reports', path: ROUTES.REPORTS },
]

const RECORDS_NAV = [
  { label: 'Products', icon: 'Products', path: ROUTES.PRODUCTS },
  { label: 'People', icon: 'People', path: '/people' },
  { label: 'Product History', icon: 'PriceHistory', path: '/price-history' },
  { label: 'Quotes', icon: 'Quotes', path: '/quotes' },
  { label: 'Orders', icon: 'Orders', path: '/orders' },
  { label: 'Import Stock', icon: 'ImportStock', path: ROUTES.IMPORT_STOCK },
]

const INVOICES_NAV = [
  { label: 'Billing', icon: 'Billing', path: ROUTES.BILLING },
  { label: 'Paid', icon: 'Paid', path: ROUTES.PAID },
  { label: 'Unpaid', icon: 'Unpaid', path: ROUTES.UNPAID },
]

const SEARCH_ITEMS = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: 'Home', category: 'Navigation', keywords: 'dashboard main overview start' },
  { label: 'Notes', path: ROUTES.NOTES, icon: 'Notes', category: 'Navigation', keywords: 'memo text' },
  { label: 'Emails', path: ROUTES.EMAILS, icon: 'Emails', category: 'Navigation', keywords: 'messages mail send inbox' },
  { label: 'Reports', path: ROUTES.REPORTS, icon: 'Reports', category: 'Navigation', keywords: 'analytics stats metrics chart' },
  { label: 'Products', path: ROUTES.PRODUCTS, icon: 'Products', category: 'Records', keywords: 'inventory item stock goods' },
  { label: 'People', path: '/people', icon: 'People', category: 'Records', keywords: 'customers contacts client users' },
  { label: 'Product History', path: '/price-history', icon: 'PriceHistory', category: 'Records', keywords: 'price changes log track history' },
  { label: 'Quotes', path: '/quotes', icon: 'Quotes', category: 'Records', keywords: 'estimates proposal vendor customer' },
  { label: 'Orders', path: '/orders', icon: 'Orders', category: 'Records', keywords: 'sales purchases transactions' },
  { label: 'Import Stock', path: ROUTES.IMPORT_STOCK, icon: 'ImportStock', category: 'Records', keywords: 'upload csv inventory bulk' },
  { label: 'Billing', path: ROUTES.BILLING, icon: 'Billing', category: 'Invoices & Finance', keywords: 'payment invoices money finance' },
  { label: 'Paid Invoices', path: ROUTES.PAID, icon: 'Paid', category: 'Invoices & Finance', keywords: 'completed payment settled' },
  { label: 'Unpaid Invoices', path: ROUTES.UNPAID, icon: 'Unpaid', category: 'Invoices & Finance', keywords: 'pending overdue due bill' },
  { label: 'Workflows', path: '/workflows', icon: 'Workflows', category: 'Automations', keywords: 'automation triggers sequences flow' },
  { label: 'Settings', path: '/settings', icon: 'Settings', category: 'Account', keywords: 'preferences config profile workspace' },
  { label: 'Invite Teammates', action: 'invite', icon: 'UserPlus', category: 'Actions', keywords: 'team invite user member share' },
  { label: 'Sign Out', action: 'logout', icon: 'LogOut', category: 'Account', keywords: 'exit logout logoff' },
]

function NavItem({ item, active, onClick, favorites, onToggleFav }) {
  const isFav = favorites.includes(item.label)

  return (
    <div className={`ws-sb-nav-item-wrapper ${active ? 'active' : ''}`}>
      <Link
        to={item.path}
        className="ws-sb-nav-item-btn"
        onClick={() => onClick(item.label)}
        style={{ textDecoration: 'none' }}
      >
        {ICON_MAP[item.icon]}
        <span>{item.label}</span>
      </Link>

      <button
        type="button"
        className={`ws-sb-star-btn ${isFav ? 'favorited' : ''}`}
        onClick={(e) => onToggleFav(item.label, e)}
        aria-label={isFav ? "Remove from Favorites" : "Add to Favorites"}
      >
        <Star size={11} fill={isFav ? "#eab308" : "none"} stroke={isFav ? "#eab308" : "currentColor"} />
      </button>
    </div>
  )
}

export default function Sidebar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const activeNav = useAppSelector(selectActiveNav)
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const sidebarTriggerHovered = useAppSelector(selectSidebarTriggerHovered)
  const sidebarContentHovered = useAppSelector(selectSidebarContentHovered)
  const { shopName } = useAuth()

  const isHoverPeek = !sidebarOpen && (sidebarTriggerHovered || sidebarContentHovered)
  const isVisible = sidebarOpen || isHoverPeek

  const handleMouseEnter = () => {
    if (!sidebarOpen) {
      dispatch(setSidebarContentHovered(true))
    }
  }

  const handleMouseLeave = () => {
    if (!sidebarOpen) {
      dispatch(setSidebarContentHovered(false))
    }
  }

  const [automationsOpen, setAutomationsOpen] = useState(() => {
    return window.location.pathname.startsWith('/workflows')
  })
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(() => {
    return ['/products', '/people', '/price-history', '/quotes', '/orders', '/import-stock'].some(path => window.location.pathname.startsWith(path))
  })
  const [billingOpen, setBillingOpen] = useState(() => {
    return ['/billing', '/paid', '/unpaid'].some(path => window.location.pathname.startsWith(path))
  })
  const [chatsOpen, setChatsOpen] = useState(() => {
    const saved = sessionStorage.getItem('ws_chats_open')
    return saved !== null ? saved === 'true' : true
  })

  const toggleChats = () => {
    setChatsOpen(prev => {
      const next = !prev
      sessionStorage.setItem('ws_chats_open', String(next))
      return next
    })
  }

  const showAllChatsPanel = useAppSelector(selectAllChatsPanelOpen)
  const setShowAllChatsPanel = (val) => dispatch(setAllChatsPanelOpen(val))
  const [chatsSearchQuery, setChatsSearchQuery] = useState('')

  useEffect(() => {
    if (showAllChatsPanel) {
      const token = sessionStorage.getItem('ws_token')
      if (token) {
        api.get('/chat/sessions')
          .then(res => {
            const data = res.data || []
            setChats(data)
            sessionStorage.setItem('ws_cached_chats', JSON.stringify(data))
          })
          .catch(() => { })
      }
    }
  }, [showAllChatsPanel])
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchModalOpen(prev => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        dispatch(toggleSidebar())
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [dispatch])

  const filteredSearchItems = SEARCH_ITEMS.filter(item => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    )
  })

  const handleExecuteSearchItem = (item) => {
    setSearchModalOpen(false)
    setSearchQuery('')
    if (item.path) {
      handleNav(item.label)
      navigate(item.path)
    } else if (item.action === 'invite') {
      setInviteModalOpen(true)
    } else if (item.action === 'logout') {
      handleLogout()
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredSearchItems.length > 0) {
        setSelectedIndex(prev => (prev + 1) % filteredSearchItems.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredSearchItems.length > 0) {
        setSelectedIndex(prev => (prev - 1 + filteredSearchItems.length) % filteredSearchItems.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSearchItems.length > 0 && selectedIndex < filteredSearchItems.length) {
        handleExecuteSearchItem(filteredSearchItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSearchModalOpen(false)
    }
  }

  const toggleAutomations = () => {
    const next = !automationsOpen
    setAutomationsOpen(next)
    if (next) {
      setRecordsOpen(false)
      setBillingOpen(false)
    }
  }

  const toggleRecords = () => {
    const next = !recordsOpen
    setRecordsOpen(next)
    if (next) {
      setBillingOpen(false)
      setAutomationsOpen(false)
    }
  }

  const toggleBilling = () => {
    const next = !billingOpen
    setBillingOpen(next)
    if (next) {
      setRecordsOpen(false)
      setAutomationsOpen(false)
    }
  }

  const location = useLocation()

  useEffect(() => {
    if (['/products', '/people', '/price-history', '/quotes', '/orders', '/import-stock'].some(path => location.pathname.startsWith(path))) {
      setRecordsOpen(true)
    }
    if (['/billing', '/paid', '/unpaid'].some(path => location.pathname.startsWith(path))) {
      setBillingOpen(true)
    }
    if (location.pathname.startsWith('/workflows')) {
      setAutomationsOpen(true)
    }
  }, [location.pathname])
  const [chats, setChats] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ws_cached_chats')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const searchParams = new URLSearchParams(location.search)
  const activeSessionId = searchParams.get('session')

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ws_favorites')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const [workspaces, setWorkspaces] = useState([])
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Member')
  const [inviteTeam, setInviteTeam] = useState('')
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Reactive workspace state
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(
    () => sessionStorage.getItem('ws_active_workspace_name') || shopName
  )
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => sessionStorage.getItem('ws_active_workspace_id') || ''
  )

  useEffect(() => {
    const handleOpenInvite = () => setInviteModalOpen(true)
    const handleWsUpdate = () => {
      const updated = sessionStorage.getItem('ws_active_workspace_name') || localStorage.getItem('ws_workspace_name')
      if (updated) setActiveWorkspaceName(updated)
    }
    window.addEventListener('ws-open-invite', handleOpenInvite)
    window.addEventListener('workspace_updated', handleWsUpdate)
    return () => {
      window.removeEventListener('ws-open-invite', handleOpenInvite)
      window.removeEventListener('workspace_updated', handleWsUpdate)
    }
  }, [])

  useEffect(() => {
    if (!workspaceDropdownOpen) return
    const handleClickOutside = (e) => {
      const dropdown = document.querySelector('.ws-sb-ws-dropdown')
      const trigger = document.querySelector('.ws-sb-workspace-btn')
      if (dropdown && !dropdown.contains(e.target) && trigger && !trigger.contains(e.target)) {
        setWorkspaceDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [workspaceDropdownOpen])

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

  const handleInviteKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleInviteSubmit(e)
    }
  }

  useEffect(() => {
    const token = sessionStorage.getItem('ws_token')
    if (token) {
      api.get('/chat/sessions')
        .then(res => {
          const data = res.data || []
          setChats(data)
          sessionStorage.setItem('ws_cached_chats', JSON.stringify(data))
        })
        .catch(() => { })

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
            }
          } else {
            const current = data?.find(w => String(w.id) === String(activeId))
            if (current) {
              sessionStorage.setItem('ws_active_workspace_name', current.shopName)
              setActiveWorkspaceName(current.shopName)
            }
          }
        })
        .catch(() => { })
    }
  }, [])

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

  const handleNav = (label) => {
    dispatch(setActiveNav(label))
    dispatch(clearSidebarHover())
  }
  const handleLogout = () => {
    dispatch(logout())
    dispatch(addToast({ message: 'Signed out successfully.', type: 'info' }))
    navigate(ROUTES.LOGIN)
  }

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ws_sidebar_width')
    return saved ? parseInt(saved, 10) : 235
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    localStorage.setItem('ws_sidebar_width', sidebarWidth)
  }, [sidebarWidth])


  const logoLetter = activeWorkspaceName ? activeWorkspaceName.charAt(0).toUpperCase() : 'W'

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="ws-sb-overlay" onClick={() => dispatch(toggleSidebar())} />
      )}

      <aside
        className={`ws-sidebar${isVisible ? ' ws-sidebar--open' : ''}${isHoverPeek ? ' ws-sidebar--hover-peek' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Workspace Header */}
        <div className="ws-sb-header" style={{ position: 'relative' }}>
          <button
            className="ws-sb-workspace-btn"
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            title={activeWorkspaceName}
          >
            <div className="ws-sb-ws-icon" style={{ textTransform: 'uppercase', color: '#fff', fontWeight: '800', fontSize: '11px', fontFamily: 'sans-serif' }}>
              {logoLetter}
            </div>
            <span className="ws-sb-ws-name" title={activeWorkspaceName}>{activeWorkspaceName}</span>
            <ChevronDown size={13} className="ws-sb-chevron" />
          </button>
          <div className="ws-sb-collapse-wrapper">
            <button
              className="ws-sb-collapse-btn"
              onClick={() => dispatch(toggleSidebar())}
              aria-label="Collapse sidebar"
            >
              <CollapseSidebarIcon size={16} />
            </button>
            <div className="ws-sb-tooltip">
              <span>Collapse sidebar</span>
              <div className="ws-sb-tooltip-shortcut">
                <kbd className="ws-sb-kbd-badge">CTRL</kbd>
                <kbd className="ws-sb-kbd-badge">.</kbd>
              </div>
            </div>
          </div>

          {workspaceDropdownOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'transparent' }}
                onClick={() => setWorkspaceDropdownOpen(false)}
              />
              <div
                className="ws-sb-ws-dropdown"
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: '8px',
                  width: '205px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
                  zIndex: 10000,
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                }}
              >
              {/* Workspace List */}
              {workspaces.map(w => {
                const isActive = String(w.id) === String(activeWorkspaceId)
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
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: '6px',
                      background: isActive ? '#f1f5f9' : 'transparent',
                      color: '#0f172a',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      textAlign: 'left',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isActive ? '#f1f5f9' : '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = isActive ? '#f1f5f9' : 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        background: '#2563eb',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {(w.shopName || 'W')[0].toUpperCase()}
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.shopName}
                      </span>
                    </div>
                    {isActive && <CheckCircle2 size={14} fill="#2563eb" color="#ffffff" />}
                  </button>
                )
              })}

              {/* New Workspace button */}
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false)
                  navigate('/settings')
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#344054',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Plus size={14} style={{ color: '#64748b' }} />
                <span>New workspace</span>
              </button>

              <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

              {/* Account Settings */}
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false)
                  navigate('/account-settings')
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#344054',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <User size={14} style={{ color: '#64748b' }} />
                <span>Account settings</span>
              </button>

              {/* Workspace Settings */}
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false)
                  navigate('/workspace-settings')
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#344054',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Settings size={14} style={{ color: '#64748b' }} />
                <span>Workspace settings</span>
              </button>

              <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

              {/* Invite Team Members */}
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false)
                  setInviteModalOpen(true)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#344054',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <UserPlus size={14} style={{ color: '#64748b' }} />
                <span>Invite team members</span>
              </button>

              <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

              {/* Sign out */}
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false)
                  handleLogout()
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#344054',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={14} style={{ color: '#64748b' }} />
                <span>Sign out</span>
              </button>
            </div>
          </>
          )}
        </div>

        {/* Search */}
        <div className="ws-sb-search">
          <button className="ws-sb-searchbox" onClick={() => setSearchModalOpen(true)}>
            <Search size={13} style={{ color: '#64748b', flexShrink: 0 }} />
            <span>Search</span>
            <kbd className="ws-sb-kbd">CTRL K</kbd>
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
              <div className={`ws-sb-nav-item-wrapper ${activeNav === 'Workflows' ? 'active' : ''}`}>
                <button
                  className="ws-sb-nav-item-btn"
                  onClick={toggleAutomations}
                >
                  {ICON_MAP.Automations}
                  <span>Automations</span>
                </button>
                <button
                  className={`ws-sb-arrow-btn ${automationsOpen ? 'rotated' : ''}`}
                  onClick={toggleAutomations}
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

          {/* Collapsible Records Item */}
          <div className="ws-sb-collapsible-item">
            <div className="ws-sb-nav-item-wrapper">
              <button
                className="ws-sb-nav-item-btn"
                onClick={toggleRecords}
              >
                {ICON_MAP.Folder}
                <span>Records</span>
              </button>
              <button
                className={`ws-sb-arrow-btn ${recordsOpen ? 'rotated' : ''}`}
                onClick={toggleRecords}
                aria-label="Toggle sublist"
              >
                <ChevronRight size={12} className="ws-sb-arrow" />
              </button>
            </div>

            {recordsOpen && (
              <div className="ws-sb-sublist">
                {RECORDS_NAV.map(item => (
                  <Link to={item.path} key={item.label} style={{ textDecoration: 'none' }} onClick={() => handleNav(item.label)}>
                    <div className={`ws-sb-subitem ${activeNav === item.label ? 'active' : ''}`}>
                      {ICON_MAP[item.icon]}
                      <span>{item.label}</span>
                      <button
                        className={`ws-sb-star-btn ${favorites.includes(item.label) ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorite(item.label, e)}
                      >
                        <Star size={10} fill={favorites.includes(item.label) ? "#eab308" : "none"} stroke={favorites.includes(item.label) ? "#eab308" : "currentColor"} />
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Billing Item */}
          <div className="ws-sb-collapsible-item">
            <div className="ws-sb-nav-item-wrapper">
              <button
                className="ws-sb-nav-item-btn"
                onClick={toggleBilling}
              >
                {ICON_MAP.Billing}
                <span>Billing</span>
              </button>
              <button
                className={`ws-sb-arrow-btn ${billingOpen ? 'rotated' : ''}`}
                onClick={toggleBilling}
                aria-label="Toggle sublist"
              >
                <ChevronRight size={12} className="ws-sb-arrow" />
              </button>
            </div>

            {billingOpen && (
              <div className="ws-sb-sublist">
                {INVOICES_NAV.map(item => (
                  <Link to={item.path} key={item.label} style={{ textDecoration: 'none' }} onClick={() => handleNav(item.label)}>
                    <div className={`ws-sb-subitem ${activeNav === item.label ? 'active' : ''}`}>
                      {ICON_MAP[item.icon]}
                      <span>{item.label}</span>
                      <button
                        className={`ws-sb-star-btn ${favorites.includes(item.label) ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorite(item.label, e)}
                      >
                        <Star size={10} fill={favorites.includes(item.label) ? "#eab308" : "none"} stroke={favorites.includes(item.label) ? "#eab308" : "currentColor"} />
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Chats Section */}
          <div className="ws-sb-section">
            <button
              className="ws-sb-section-header"
              onClick={toggleChats}
            >
              <ChevronRight size={12} className={`ws-sb-arrow ${chatsOpen ? 'rotated' : ''}`} />
              <span>Chats</span>
            </button>

            {chatsOpen && (
              <div className="ws-sb-section-body">
                {chats.length === 0 ? (
                  <div className="ws-sb-empty-note">No recent chats</div>
                ) : (
                  <>
                    {chats.slice(0, 5).map(chat => {
                      const isActive = activeSessionId && (String(activeSessionId) === String(chat.id) || String(activeSessionId) === String(chat.conversation_id))
                      return (
                        <Link
                          to={`/dashboard?session=${chat.id}`}
                          key={chat.id}
                          style={{ textDecoration: 'none' }}
                          onClick={() => handleNav('Home')}
                        >
                          <div className={`ws-sb-subitem ${isActive ? 'active' : ''}`}>
                            <MessageSquare size={13} style={{ flexShrink: 0, color: '#6b7280' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chat.title || 'Untitled chat'}
                            </span>
                          </div>
                        </Link>
                      )
                    })}

                    <button
                      type="button"
                      className="ws-sb-subitem"
                      onClick={() => {
                        dispatch(toggleAllChatsPanel())
                      }}
                      style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', color: '#6b7280', fontSize: '0.8rem' }}
                    >
                      <MoreHorizontal size={13} style={{ flexShrink: 0 }} />
                      <span>All chats</span>
                    </button>
                  </>
                )}
              </div>
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
          </div>
        </div>
      </aside>

      {/* All Chats Side Drawer*/}
      {showAllChatsPanel && (
        <div
          className="ws-chats-drawer-panel"
          style={{
            position: 'fixed',
            left: sidebarOpen ? 'var(--sidebar-width)' : '50px',
            top: 0,
            width: 280,
            height: '100vh',
            background: '#ffffff',
            borderRight: '1px solid #e5e7eb',
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.08)',
            zIndex: 1150,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Chats</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => {
                  setShowAllChatsPanel(false)
                  handleNav('Home')
                  navigate('/dashboard?chat=true')
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="New chat"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setShowAllChatsPanel(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close chats panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #3b82f6', background: '#ffffff', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.12)' }}>
            <Search size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search chats..."
              value={chatsSearchQuery}
              onChange={(e) => setChatsSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.83rem', color: '#0f172a' }}
              autoFocus
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {chats
              .filter(c => !chatsSearchQuery.trim() || (c.title || '').toLowerCase().includes(chatsSearchQuery.toLowerCase()))
              .length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No chats found</div>
            ) : (
              chats
                .filter(c => !chatsSearchQuery.trim() || (c.title || '').toLowerCase().includes(chatsSearchQuery.toLowerCase()))
                .map(chat => {
                  const isActive = activeSessionId && (String(activeSessionId) === String(chat.id) || String(activeSessionId) === String(chat.conversation_id))
                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        setShowAllChatsPanel(false)
                        handleNav('Home')
                        navigate(`/dashboard?session=${chat.id}`)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : 'transparent',
                        color: isActive ? '#2563eb' : '#334155',
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 500 : 400,
                        transition: 'background 0.12s ease'
                      }}
                    >
                      <MessageSquare size={14} style={{ flexShrink: 0, color: isActive ? '#2563eb' : '#64748b' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {chat.title || 'Untitled chat'}
                      </span>
                    </div>
                  )
                })
            )}
          </div>
        </div>
      )}

      {/* Invite Teammate Modal */}
      {inviteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh',
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: '20px',
            overflowY: 'auto'
          }}
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '14px',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.18)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e2e8f0'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserRound size={16} style={{ color: '#475569' }} />
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', fontFamily: 'inherit' }}>
                  Invite team members
                </h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Send Invite to... */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: '#64748b', fontFamily: 'inherit' }}>
                    Send Invite to ...
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={handleInviteKeyDown}
                    style={{
                      width: '100%',
                      minHeight: '76px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.875rem',
                      outline: 'none',
                      color: '#0f172a',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.4',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>

                {/* Invite as */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 500, color: '#64748b', fontFamily: 'inherit' }}>
                    Invite as
                  </label>

                  {/* Select Box Button */}
                  <button
                    type="button"
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <span>{inviteRole}</span>
                    <ChevronDown
                      size={16}
                      style={{
                        color: '#64748b',
                        transform: roleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    />
                  </button>

                  {/* Dropdown Options Card */}
                  {roleDropdownOpen && (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '5px',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginTop: '4px'
                    }}>
                      {/* Member */}
                      <div
                        onClick={() => {
                          setInviteRole('Member')
                          setRoleDropdownOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 14px',
                          borderRadius: '6px',
                          background: inviteRole === 'Member' ? '#f8fafc' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Member</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>can edit</span>
                        </div>
                        {inviteRole === 'Member' && (
                          <CheckCircle2 size={15} fill="#2563eb" color="#ffffff" />
                        )}
                      </div>

                      {/* Admin */}
                      <div
                        onClick={() => {
                          setInviteRole('Admin')
                          setRoleDropdownOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 14px',
                          borderRadius: '6px',
                          background: inviteRole === 'Admin' ? '#f8fafc' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Admin</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>full access</span>
                        </div>
                        {inviteRole === 'Admin' && (
                          <CheckCircle2 size={15} fill="#2563eb" color="#ffffff" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 24px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: 'var(--color-blue, #2563eb)',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                    opacity: inviting || !inviteEmail.trim() ? 0.65 : 1,
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                    transition: 'opacity 0.15s'
                  }}
                >
                  <span>{inviting ? 'Sending...' : 'Send Invites'}</span>
                  <span style={{
                    fontSize: '0.6rem',
                    background: 'rgba(255, 255, 255, 0.25)',
                    padding: '1.5px 4px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    letterSpacing: '0.3px'
                  }}>
                    CTRL ↵
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Actions Search Modal */}
      {searchModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh'
          }}
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '580px',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e2e8f0'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Input Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 18px',
              borderBottom: '1px solid #f1f5f9',
              gap: '12px'
            }}>
              <Search size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.95rem',
                  color: '#1e293b',
                  background: 'transparent',
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                >
                  <X size={16} />
                </button>
              )}
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                background: '#f1f5f9',
                color: '#64748b',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                ESC
              </span>
            </div>

            {/* Results List */}
            <div style={{
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '8px 0'
            }}>
              {filteredSearchItems.length === 0 ? (
                <div style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.875rem'
                }}>
                  No commands or results found for "{searchQuery}"
                </div>
              ) : (
                filteredSearchItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={item.label}
                      onClick={() => handleExecuteSearchItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 18px',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        color: isSelected ? '#1d4ed8' : '#334155',
                        transition: 'background 0.1s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: isSelected ? 600 : 500, fontSize: '0.875rem' }}>
                            {item.label}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          color: isSelected ? '#3b82f6' : '#94a3b8',
                          background: isSelected ? '#dbeafe' : '#f8fafc',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 500
                        }}>
                          {item.category}
                        </span>
                        {isSelected && (
                          <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>↵</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 18px',
              background: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              <span>Search actions & navigation</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span><kbd style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, padding: '1px 4px', fontSize: '0.68rem' }}>↑↓</kbd> Navigate</span>
                <span><kbd style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, padding: '1px 4px', fontSize: '0.68rem' }}>↵</kbd> Select</span>
                <span><kbd style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, padding: '1px 4px', fontSize: '0.68rem' }}>esc</kbd> Dismiss</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
