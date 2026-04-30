import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Building2, Users, Receipt, Package, 
  Settings, ChevronDown, Bell, Search, Menu, 
  LogOut, ClipboardList, Zap, Home, FileText,
  Mail, BarChart3, Workflow
} from 'lucide-react'
import WorkshopLogo from '../components/WorkshopLogo'
import './Dashboard.css'

/* ── Static Demo Data ── */
const STATS = [
  { label: "Today's Sales", value: '₹18,420', change: '+12.4%', up: true },
  { label: 'Orders Today', value: '34', change: '+6 vs yesterday', up: true },
  { label: 'Products', value: '248', change: '7 low stock', up: false },
  { label: 'Customers', value: '1,092', change: '+3 new today', up: true },
]

const TABLE_DATA = [
  { name: 'Samsung 65" QLED TV', cat: 'Electronics', status: 'In Stock', price: '₹84,990', sc: 'g' },
  { name: 'Apple AirPods Pro', cat: 'Electronics', status: 'Low Stock', price: '₹24,900', sc: 'o' },
  { name: "Levi's 511 Slim Jeans", cat: 'Apparel', status: 'In Stock', price: '₹3,999', sc: 'g' },
  { name: 'Nescafé Gold 200g', cat: 'Grocery', status: 'Out of Stock', price: '₹850', sc: 'r' },
  { name: 'Bosch Mixer Grinder', cat: 'Appliances', status: 'In Stock', price: '₹5,499', sc: 'g' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Products')

  const userData = (() => {
    try { return JSON.parse(localStorage.getItem('ws_user') || '{}') } catch { return {} }
  })()

  const shopName = userData.shopName || 'My Shop'
  const initials = (userData.shopName || 'WS').slice(0, 2).toUpperCase()

  const handleLogout = () => {
    localStorage.removeItem('ws_token')
    localStorage.removeItem('ws_user')
    navigate('/login')
  }

  const mainNav = [
    { label: 'Home', icon: <Home size={14} /> },
    { label: 'Notifications', icon: <Bell size={14} />, badge: 3 },
    { label: 'Tasks', icon: <ClipboardList size={14} /> },
    { label: 'Notes', icon: <FileText size={14} /> },
    { label: 'Emails', icon: <Mail size={14} /> },
    { label: 'Reports', icon: <BarChart3 size={14} /> },
    { label: 'Automations', icon: <Workflow size={14} /> },
  ]

  const recordsNav = [
    { label: 'Products', icon: <Package size={14} /> },
    { label: 'Billing', icon: <Receipt size={14} /> },
    { label: 'Customers', icon: <Users size={14} /> },
  ]

  return (
    <div className="ws-dash-layout">
      {/* Sidebar */}
      <div className="ws-dash-sidebar">
        {/* Workspace header */}
        <div className="ws-dash-sb-header">
          <button className="ws-dash-ws-btn">
            <div className="ws-dash-ws-icon">{initials}</div>
            <span className="ws-dash-ws-name">{shopName}</span>
            <ChevronDown size={13} color="#9ca3af" />
          </button>
        </div>

        {/* Quick search */}
        <div className="ws-dash-sb-search">
          <div className="ws-dash-searchbox">
            <Search size={13} color="#9ca3af" />
            <span>Quick actions</span>
            <span className="ws-dash-search-kbd">⌘K</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="ws-dash-nav">
          <div className="ws-dash-nav-list">
            {mainNav.map((item) => (
              <button
                key={item.label}
                className={`ws-dash-nav-item ${activeNav === item.label ? 'active' : ''}`}
                onClick={() => setActiveNav(item.label)}
              >
                {item.icon}
                {item.label}
                {item.badge && <span className="ws-dash-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>

          <div className="ws-dash-nav-section">Records</div>
          <div className="ws-dash-nav-list">
            {recordsNav.map((item) => (
              <button
                key={item.label}
                className={`ws-dash-nav-item ${activeNav === item.label ? 'active' : ''}`}
                onClick={() => setActiveNav(item.label)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div className="ws-dash-nav-section">Favorites</div>
          <div style={{ fontSize: '0.82rem', color: '#9ca3af', padding: '6px 9px', fontStyle: 'italic' }}>
            No favorites
          </div>

          <div className="ws-dash-nav-section">Settings</div>
          <div className="ws-dash-nav-list">
            <button className="ws-dash-nav-item"><Building2 size={14} /> Shop Profile</button>
            <button className="ws-dash-nav-item"><Settings size={14} /> Preferences</button>
          </div>
        </nav>

        {/* Bottom */}
        <div className="ws-dash-sb-bottom">
          <div className="ws-dash-sb-trial">
            <span><strong>14 days</strong> left on trial</span>
            <button className="ws-dash-sb-trial-btn">Add billing</button>
          </div>
          <div style={{height: 8}} />
          <button className="ws-dash-sb-footer-item" onClick={handleLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="ws-dash-main">
        {/* Topbar */}
        <header className="ws-dash-topbar">
          <button className="ws-dash-menu-btn">
            <Menu size={18} />
          </button>
          
          <div className="ws-dash-page-title">{activeNav}</div>
          
          <div className="ws-dash-topbar-actions">
            <button className="ws-dash-top-btn">↑↓ Sort</button>
            <button className="ws-dash-top-btn">⊞ Filter</button>
            <div className="ws-dash-avatar" title={shopName}>{initials}</div>
          </div>
        </header>

        {/* Body */}
        <div className="ws-dash-body">
          <h1 className="ws-dash-greeting">Good morning, {shopName.split(' ')[0]} 👋</h1>

          {/* Stats */}
          <div className="ws-dash-stats">
            {STATS.map(s => (
              <div className="ws-stat-card" key={s.label}>
                <div className="ws-stat-lbl">{s.label}</div>
                <div className="ws-stat-val">{s.value}</div>
                <div className={`ws-stat-change ${s.up ? 'up' : 'down'}`}>
                  {s.up ? '↑' : '↓'} {s.change}
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="ws-dash-table-wrap">
            <table className="ws-dash-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_DATA.map(row => (
                  <tr key={row.name}>
                    <td className="ws-td-bold">{row.name}</td>
                    <td>{row.cat}</td>
                    <td><span className={`ws-pill ${row.sc}`}>{row.status}</span></td>
                    <td>{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
