import React from 'react'
import { User, Users, Briefcase, Plus, Mail, Building2, UserCircle2, Zap, IdCard, CreditCard, Layout, Globe, Tag, CheckCircle } from 'lucide-react'
import './Landing.css'

// Custom SVGs for Workspace logos
const RaycastLogo = () => (
  <svg viewBox="0 0 100 100" style={{ width: 15, height: 15, marginRight: 8, borderRadius: 3, flexShrink: 0 }}>
    <rect width="100" height="100" rx="22" fill="#111" />
    <circle cx="50" cy="50" r="18" fill="#ff4f00" />
  </svg>
)

const StripeLogo = () => (
  <svg viewBox="0 0 100 100" style={{ width: 15, height: 15, marginRight: 8, borderRadius: 3, flexShrink: 0 }}>
    <rect width="100" height="100" rx="22" fill="#635bff" />
    <path d="M35 55 C35 42 65 48 65 35 C65 26 53 25 48 25 C38 25 35 32 35 32 M65 45 C65 58 35 52 35 65 C35 74 47 75 52 75 C62 75 65 68 65 68" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
  </svg>
)

const AnthropicLogo = () => (
  <svg viewBox="0 0 100 100" style={{ width: 15, height: 15, marginRight: 8, borderRadius: 3, flexShrink: 0 }}>
    <rect width="100" height="100" rx="22" fill="#e0b896" />
    <text x="50" y="70" fontSize="56" fontWeight="900" fill="#191919" textAnchor="middle" fontFamily="sans-serif">A</text>
  </svg>
)

const LinearLogo = () => (
  <svg viewBox="0 0 100 100" style={{ width: 15, height: 15, marginRight: 8, borderRadius: 3, flexShrink: 0 }}>
    <rect width="100" height="100" rx="22" fill="#5e6ad2" />
    <circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeWidth="10" />
    <circle cx="50" cy="50" r="10" fill="#fff" />
  </svg>
)

export default function DataModelSection() {
  return (
    <section className="ws-section ws-dm-section">
      <div className="ws-section-inner">

        {/* ── Headline ── */}
        <div className="ws-big-headline ws-big-headline--centered">
          <h2 className="ws-big-headline-title ws-text-muted" style={{ maxWidth: 700, margin: '0 auto' }}>
            Your business model — <em>perfectly reflected</em> in your platform.
          </h2>
          <div style={{ marginTop: 20 }}>
            <a href="#" className="ws-outline-btn">Explore our data model</a>
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div className="ws-dm-tabs">
          {['Scale-ups', 'SaaS startups', 'SMBs', 'Investors'].map((tab, i) => (
            <button key={tab} className={`ws-dm-tab ${i === 0 ? 'ws-dm-tab--active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Entity relationship diagram ── */}
        <div className="ws-dm-graph-container">
          <div className="ws-dm-entities-graph">
            
            {/* SVG Connectors (Percentage based) */}
            <svg className="ws-dm-connectors" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* User (right edge, middle port) ➔ Person (left edge, top port) */}
              <path 
                d="M 23,31 C 25,31 25,66 27,66" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
              {/* User (right edge, bottom port) ➔ Workspace (left edge, top port) */}
              <path 
                d="M 23,34 C 30,34 45,66 52,66" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
              {/* Person (right edge, middle port) ➔ Workspace (left edge, middle port) */}
              <path 
                d="M 48,69 C 50,69 50,69 52,69" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
              {/* Workspace (right edge, middle port) ➔ Deal (left edge, middle port) */}
              <path 
                d="M 73,69 C 75,69 75,31 77,31" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
            </svg>

            {/* 1. User entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--user">
              {/* Right Ports */}
              <div className="ws-dm-ports ws-dm-ports--right">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>

              <div className="ws-dm-card-header">
                <div className="ws-dm-card-icon-box ws-dm-icon-green"><User size={15} /></div>
                <span className="ws-dm-card-name">User</span>
                <span className="ws-dm-card-badge">Standard</span>
              </div>
              <div className="ws-dm-card-body">
                <div className="ws-dm-attr"><IdCard size={13} /> User ID</div>
                <div className="ws-dm-attr"><Zap size={13} /> Engagement score</div>
                <div className="ws-dm-attr"><CreditCard size={13} /> User type</div>
                <div className="ws-dm-attr ws-dm-attr--more">+ 4 More Attributes</div>
              </div>
            </div>

            {/* 2. Person entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--person">
              {/* Left Ports */}
              <div className="ws-dm-ports ws-dm-ports--left">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>

              <div className="ws-dm-card-header">
                <div className="ws-dm-card-icon-box ws-dm-icon-blue"><Users size={15} /></div>
                <span className="ws-dm-card-name">Person</span>
                <span className="ws-dm-card-badge">Standard</span>
              </div>
              <div className="ws-dm-card-body">
                <div className="ws-dm-attr"><User size={13} /> Name</div>
                <div className="ws-dm-attr"><Mail size={13} /> Email</div>
                <div className="ws-dm-attr"><Building2 size={13} /> Company</div>
                <div className="ws-dm-attr ws-dm-attr--more">+ 12 More Attributes</div>
              </div>

              {/* Right Ports */}
              <div className="ws-dm-ports ws-dm-ports--right">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>
            </div>

            {/* 3. Workspace entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--workspace">
              {/* Left Ports */}
              <div className="ws-dm-ports ws-dm-ports--left">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>

              <div className="ws-dm-card-header">
                <div className="ws-dm-card-icon-box ws-dm-icon-orange">
                  <Layout size={15} />
                </div>
                <span className="ws-dm-card-name">Workspace</span>
                <span className="ws-dm-card-badge">Standard</span>
              </div>
              <div className="ws-dm-card-body">
                <div className="ws-dm-attr"><Tag size={13} /> Name</div>
                <div className="ws-dm-attr"><Building2 size={13} /> Company</div>
                <div className="ws-dm-attr"><CheckCircle size={13} /> Status</div>
                <div className="ws-dm-attr ws-dm-attr--more">+ 7 More Attributes</div>
              </div>

              {/* Right Ports */}
              <div className="ws-dm-ports ws-dm-ports--right">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>
            </div>

            {/* 4. Deal entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--deal">
              {/* Left Ports */}
              <div className="ws-dm-ports ws-dm-ports--left">
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
                <span className="ws-dm-port-dot"></span>
              </div>

              <div className="ws-dm-card-header">
                <div className="ws-dm-card-icon-box ws-dm-icon-purple"><Briefcase size={15} /></div>
                <span className="ws-dm-card-name">Deal</span>
                <span className="ws-dm-card-badge">Standard</span>
              </div>
              <div className="ws-dm-card-body">
                <div className="ws-dm-attr"><IdCard size={13} /> Deal name</div>
                <div className="ws-dm-attr"><Globe size={13} /> Workspace</div>
                <div className="ws-dm-attr"><Briefcase size={13} /> Stage</div>
                <div className="ws-dm-attr ws-dm-attr--more">+ 2 More Attributes</div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Data table ── */}
        <div className="ws-dm-table-wrap">
          <table className="ws-dm-table">
            <thead>
              <tr>
                <th style={{ width: '40px', padding: '0 0 0 16px' }}><input type="checkbox" readOnly /></th>
                <th>User</th>
                <th><div className="ws-th-icon"><IdCard size={12} /> User ID</div></th>
                <th><div className="ws-th-icon"><CreditCard size={12} /> User type</div></th>
                <th><div className="ws-th-icon"><Zap size={12} /> Engagement score</div></th>
                <th><div className="ws-th-icon"><Globe size={12} /> Workspace</div></th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Albert Lund', id: '6s59-027f-4C54-98a3-3af0b00a', type: 'Member', typeColor: '#f59e0b', score: 'Light', scoreColor: '#3b82f6', avatarColor: '#ecfdf5', workspace: 'Raycast', logo: <RaycastLogo /> },
                { name: 'Jenna Roberts', id: '2d77-027f-5B23-96V9-3D9ed00a', type: 'Admin', typeColor: '#f97316', score: 'Light', scoreColor: '#3b82f6', avatarColor: '#eff6ff', workspace: 'Stripe', logo: <StripeLogo /> },
                { name: 'David Chen', id: '1dj0-d7dd-5090-ab709-5912b027', type: 'Admin', typeColor: '#f97316', score: 'Power User', scoreColor: '#8b5cf6', avatarColor: '#f5f3ff', workspace: 'Anthropic', logo: <AnthropicLogo /> },
                { name: 'Marc Lopez', id: '9bc0-3abd-8990-dj36-7698b022', type: 'Member', typeColor: '#f59e0b', score: 'Inactive', scoreColor: '#9ca3af', avatarColor: '#fff7ed', workspace: 'Linear', logo: <LinearLogo /> },
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '0 0 0 16px' }}><input type="checkbox" readOnly /></td>
                  <td>
                    <div className="ws-dm-row-user">
                      <div className="ws-dm-row-avatar" style={{ background: row.avatarColor }}>
                        <UserCircle2 size={14} style={{ color: row.typeColor }} />
                      </div>
                      <span className="ws-td-name">{row.name}</span>
                    </div>
                  </td>
                  <td className="ws-td-mono">{row.id}</td>
                  <td>
                    <span className="ws-dm-status-pill">
                      <span className="ws-dm-dot" style={{ background: row.typeColor }} />
                      {row.type}
                    </span>
                  </td>
                  <td>
                    <span className="ws-dm-score-pill" style={{ background: row.scoreColor + '12', color: row.scoreColor }}>
                      {row.score}
                    </span>
                  </td>
                  <td>
                    <div className="ws-dm-row-workspace" style={{ display: 'flex', alignItems: 'center' }}>
                      {row.logo}
                      <span className="ws-td-workspace-name" style={{ fontWeight: 500, fontSize: '13px', color: '#111827' }}>{row.workspace}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
