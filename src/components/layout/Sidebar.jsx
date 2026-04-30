import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Bell, ClipboardList, FileText, Mail, BarChart3, Workflow,
  Package, Receipt, Users, Tag, History, Building2, Settings,
  Search, ChevronDown, LogOut, UserPlus, Zap
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectActiveNav } from '../../redux/slices/uiSlice'
import { logout } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants'
import WorkshopLogo from '../WorkshopLogo'
import './Sidebar.css'

const ICON_MAP = {
  Home: <Home size={14} />, Bell: <Bell size={14} />, ClipboardList: <ClipboardList size={14} />,
  FileText: <FileText size={14} />, Mail: <Mail size={14} />, BarChart3: <BarChart3 size={14} />,
  Workflow: <Workflow size={14} />, Package: <Package size={14} />, Receipt: <Receipt size={14} />,
  Users: <Users size={14} />, Tag: <Tag size={14} />, History: <History size={14} />,
  Building2: <Building2 size={14} />, Settings: <Settings size={14} />,
}

const MAIN_NAV = [
  { label: 'Home',          icon: 'Home',         path: ROUTES.DASHBOARD },
  { label: 'Notifications', icon: 'Bell',         path: ROUTES.NOTIFICATIONS, badge: 3 },
  { label: 'Tasks',         icon: 'ClipboardList',path: null },
  { label: 'Notes',         icon: 'FileText',     path: null },
  { label: 'Emails',        icon: 'Mail',         path: null },
  { label: 'Reports',       icon: 'BarChart3',    path: ROUTES.REPORTS },
  { label: 'Automations',   icon: 'Workflow',     path: null },
]

const RECORDS_NAV = [
  { label: 'Products',     icon: 'Package',  path: ROUTES.PRODUCTS },
  { label: 'Billing',      icon: 'Receipt',  path: ROUTES.BILLING },
  { label: 'Customers',    icon: 'Users',    path: ROUTES.CUSTOMERS },
  { label: 'Categories',   icon: 'Tag',      path: ROUTES.CATEGORIES },
  { label: 'Bill History', icon: 'History',  path: ROUTES.HISTORY },
]

const SETTINGS_NAV = [
  { label: 'Shop Profile', icon: 'Building2', path: null },
  { label: 'Preferences',  icon: 'Settings',  path: ROUTES.SETTINGS },
]

function NavItem({ item, active, onClick }) {
  const content = (
    <button
      className={`ws-sb-nav-item ${active ? 'active' : ''}`}
      onClick={() => onClick(item.label)}
    >
      {ICON_MAP[item.icon]}
      <span>{item.label}</span>
      {item.badge ? <span className="ws-sb-badge">{item.badge}</span> : null}
    </button>
  )

  if (item.path) {
    return <Link to={item.path} style={{ display: 'block' }}>{content}</Link>
  }
  return content
}

export default function Sidebar() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()
  const activeNav = useAppSelector(selectActiveNav)
  const { shopName, initials } = useAuth()

  const handleNav = (label) => dispatch(setActiveNav(label))

  const handleLogout = () => {
    dispatch(logout())
    navigate(ROUTES.LOGIN)
  }

  return (
    <aside className="ws-sidebar">
      {/* Workspace Header */}
      <div className="ws-sb-header">
        <button className="ws-sb-workspace-btn">
          <div className="ws-sb-ws-icon">
            <WorkshopLogo size={14} color="#fff" />
          </div>
          <span className="ws-sb-ws-name">{shopName}</span>
          <ChevronDown size={13} className="ws-sb-chevron" />
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
        <div className="ws-sb-nav-list">
          {MAIN_NAV.map(item => (
            <NavItem
              key={item.label}
              item={item}
              active={activeNav === item.label}
              onClick={handleNav}
            />
          ))}
        </div>

        <div className="ws-sb-section-label">Records</div>
        <div className="ws-sb-nav-list">
          {RECORDS_NAV.map(item => (
            <NavItem
              key={item.label}
              item={item}
              active={activeNav === item.label}
              onClick={handleNav}
            />
          ))}
        </div>

        <div className="ws-sb-section-label">Favorites</div>
        <div className="ws-sb-empty-note">No favorites yet</div>

        <div className="ws-sb-section-label">Settings</div>
        <div className="ws-sb-nav-list">
          {SETTINGS_NAV.map(item => (
            <NavItem
              key={item.label}
              item={item}
              active={activeNav === item.label}
              onClick={handleNav}
            />
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="ws-sb-bottom">
        <div className="ws-sb-trial">
          <div className="ws-sb-trial-info">
            <Zap size={13} color="#3d68f5" />
            <span><strong>14 days</strong> left on trial</span>
          </div>
          <button className="ws-sb-trial-btn">Add billing</button>
        </div>

        <div className="ws-sb-footer-actions">
          <button className="ws-sb-footer-item">
            <UserPlus size={14} />
            Invite teammates
          </button>
          <button className="ws-sb-footer-item" onClick={handleLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
