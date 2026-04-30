import { Link } from 'react-router-dom'
import { 
  ChevronDown, Search, Bell, CheckSquare, FileText, Mail, 
  Settings, UserPlus, Filter, ArrowUpDown, LayoutGrid, Zap,
  Package, Receipt, Users, BarChart3
} from 'lucide-react'
import WorkshopLogo from '../components/WorkshopLogo'
import './Landing.css'

export default function Landing() {
  return (
    <div>
      {/* Navbar */}
      <nav className="ws-nav">
        <Link to="/" className="ws-nav-brand">
          <WorkshopLogo size={30} />
          <span className="ws-nav-name">workshop</span>
        </Link>
        <div className="ws-nav-links">
          <Link to="#product" className="ws-nav-link">Platform <ChevronDown size={13} className="ws-nav-icon" /></Link>
          <Link to="#resources" className="ws-nav-link">Resources <ChevronDown size={13} className="ws-nav-icon" /></Link>
          <Link to="#customers" className="ws-nav-link">Customers</Link>
          <Link to="#pricing" className="ws-nav-link">Pricing</Link>
        </div>
        <div className="ws-nav-right">
          <Link to="/login" className="ws-btn-ghost">Sign in</Link>
          <Link to="/signup" className="ws-btn-black">Start for free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="ws-hero">
        <div className="ws-hero-pill">
          <span className="ws-hero-pill-dark">New</span>
          Workshop Billing is now live! 🎉 <ChevronDown size={12} style={{transform: 'rotate(-90deg)'}}/>
        </div>
        
        <h1>Retail<br />operations magic.</h1>
        <p>
          Powerful, flexible and data-driven, Workshop makes it easy
          to build the exact billing system your business needs.
        </p>

        <div className="ws-hero-actions">
          <Link to="/signup" className="ws-btn-hero-black">Start for free</Link>
          <Link to="#sales" className="ws-btn-hero-outline">Talk to sales</Link>
        </div>
      </section>

      {/* Spreadsheet Graphic */}
      <div className="ws-hero-graphic-wrap">
        <div className="ws-sg-container">
          
          <div className="ws-sg-sidebar">
            <div className="ws-sg-workspace">
              <div className="ws-sg-ws-icon">WS</div>
              <div className="ws-sg-ws-name">Main Store</div>
              <ChevronDown size={14} color="#9ca3af" />
            </div>
            <div className="ws-sg-search">
              <div className="ws-sg-searchbox">
                <Search size={13} />
                Search
                <span style={{marginLeft: 'auto', background: '#fff', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem'}}>⌘ K</span>
              </div>
            </div>
            <div className="ws-sg-nav">
              <div className="ws-sg-nav-item"><Bell size={14} color="#6b7280" /> Notifications</div>
              <div className="ws-sg-nav-item"><CheckSquare size={14} color="#6b7280" /> Tasks</div>
              <div className="ws-sg-nav-item"><FileText size={14} color="#6b7280" /> Notes</div>
              <div className="ws-sg-nav-item"><Mail size={14} color="#6b7280" /> Emails</div>
              <div className="ws-sg-nav-item"><BarChart3 size={14} color="#6b7280" /> Reports</div>
            </div>
          </div>

          <div className="ws-sg-main">
            <div className="ws-sg-tabs">
              <div className="ws-sg-tab">🚀 Daily Sales Targets</div>
            </div>
            <div className="ws-sg-toolbar">
              <div className="ws-sg-tool"><LayoutGrid size={12} /> Upcoming orders <ChevronDown size={11} /></div>
              <div className="ws-sg-tool ws-sg-tool-btn"><Filter size={12} /> Filter <span style={{background: '#f3f4f6', padding: '1px 6px', borderRadius: 8}}>2</span></div>
              <div className="ws-sg-tool ws-sg-tool-btn"><ArrowUpDown size={12} /> Sort <span style={{background: '#eef2fd', color: '#3a65e0', padding: '1px 6px', borderRadius: 8}}>1</span></div>
              <div style={{flex: 1}} />
              <div className="ws-sg-tool ws-sg-tool-btn"><Settings size={12} /> View settings</div>
              <div className="ws-sg-tool ws-sg-tool-btn">↓ Import / Export <ChevronDown size={11} /></div>
            </div>

            <table className="ws-sg-table">
              <thead>
                <tr>
                  <th>Product / Vendor</th>
                  <th>Status</th>
                  <th>Next Restock</th>
                  <th>Supply Strength</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="ws-sg-td-flex">
                      <div style={{width: 22, height: 22, borderRadius: 5, background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700}}>S</div>
                      <span style={{fontWeight: 600}}>Samsung QLED</span>
                    </div>
                  </td>
                  <td><div className="ws-sg-td-flex"><div className="ws-sg-dot blue" /> Paid</div></td>
                  <td><span className="ws-sg-chip" style={{background: '#dbeafe', color: '#1d4ed8'}}>Tomorrow</span></td>
                  <td><div className="ws-sg-td-flex"><Zap size={13} color="#10b981" /> Very strong with Vendor A</div></td>
                </tr>
                <tr>
                  <td>
                    <div className="ws-sg-td-flex">
                      <div style={{width: 22, height: 22, borderRadius: 5, background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700}}>A</div>
                      <span style={{fontWeight: 600}}>Apple AirPods</span>
                    </div>
                  </td>
                  <td><div className="ws-sg-td-flex"><div className="ws-sg-dot blue" /> Expansion</div></td>
                  <td><span className="ws-sg-chip">Next month</span></td>
                  <td><div className="ws-sg-td-flex"><Zap size={13} color="#10b981" /> Very strong with Vendor B</div></td>
                </tr>
                <tr>
                  <td>
                    <div className="ws-sg-td-flex">
                      <div style={{width: 22, height: 22, borderRadius: 5, background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700}}>L</div>
                      <span style={{fontWeight: 600}}>Levi's 511 Jeans</span>
                    </div>
                  </td>
                  <td><div className="ws-sg-td-flex"><div className="ws-sg-dot green" /> Delivered</div></td>
                  <td><span className="ws-sg-chip" style={{background: '#dcfce7', color: '#166534'}}>In 30 minutes</span></td>
                  <td><div className="ws-sg-td-flex"><Zap size={13} color="#3b82f6" /> Good with Vendor C</div></td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
        <div className="ws-hero-graphic-fade" />
      </div>

      {/* Features Section */}
      <section className="ws-features">
        <div className="ws-features-grid">
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><Package size={20} /></div>
            <div className="ws-feature-title">Smart Inventory</div>
            <div className="ws-feature-desc">Track every product in real-time. Get low-stock alerts before you run out and automate reorder workflows.</div>
          </div>
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><Receipt size={20} /></div>
            <div className="ws-feature-title">GST Billing</div>
            <div className="ws-feature-desc">Generate GST-compliant invoices instantly. Full support for GSTIN, HSN codes, and e-invoicing.</div>
          </div>
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><Users size={20} /></div>
            <div className="ws-feature-title">Customer CRM</div>
            <div className="ws-feature-desc">Build lasting relationships. Track purchase history, preferences, and automate loyalty rewards.</div>
          </div>
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><BarChart3 size={20} /></div>
            <div className="ws-feature-title">Powerful Reports</div>
            <div className="ws-feature-desc">Real-time dashboards with sales trends, product performance, and custom date range analysis.</div>
          </div>
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><Zap size={20} /></div>
            <div className="ws-feature-title">Automate Everything</div>
            <div className="ws-feature-desc">Set up workflows for reorders, notifications, and customer communication — all on autopilot.</div>
          </div>
          <div className="ws-feature-card">
            <div className="ws-feature-icon"><Settings size={20} /></div>
            <div className="ws-feature-title">Fully Customizable</div>
            <div className="ws-feature-desc">Adapt Workshop to your exact business model. Custom fields, views, and workflows at every step.</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ws-footer">
        <div className="ws-footer-top">
          <div>
            <div className="ws-footer-brand">
              <WorkshopLogo size={22} />
              workshop
            </div>
          </div>
          <div className="ws-footer-col">
            <div className="ws-footer-col-label">Platform</div>
            <a href="#">Billing</a>
            <a href="#">Inventory</a>
            <a href="#">Customers</a>
            <a href="#">Reports</a>
            <a href="#">Automations</a>
          </div>
          <div className="ws-footer-col">
            <div className="ws-footer-col-label">Company</div>
            <a href="#">About</a>
            <a href="#">Customers</a>
            <a href="#">Changelog</a>
            <a href="#">Careers</a>
          </div>
          <div className="ws-footer-col">
            <div className="ws-footer-col-label">Resources</div>
            <a href="#">Documentation</a>
            <a href="#">Help center</a>
            <a href="#">Blog</a>
            <a href="#">System status</a>
          </div>
          <div className="ws-footer-col">
            <div className="ws-footer-col-label">Legal</div>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Security</a>
          </div>
        </div>
        <div className="ws-footer-bottom">
          <span>© {new Date().getFullYear()} Workshop Limited. All rights reserved.</span>
          <div className="ws-footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
