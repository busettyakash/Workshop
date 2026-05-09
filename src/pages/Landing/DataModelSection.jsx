import React from 'react'
import { User, Users, Briefcase, Plus, Search, Mail, Building2, UserCircle2, Zap, IdCard, CreditCard, Layout, Globe, ChevronDown, SquarePlus, CircleDollarSign } from 'lucide-react'
import './Landing.css'

/**
 * Data Model section — matching Image 2 perfectly
 */
export default function DataModelSection() {
  return (
    <section className="ws-section ws-dm-section">
      <div className="ws-section-inner">

        {/* ── Big headline ── */}
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
              {/* User to Person */}
              <path 
                d="M 12.5,25 C 12.5,75 25,75 37.5,75" 
                fill="none" 
                stroke="#e5e7eb" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
              {/* Deal to Person */}
              <path 
                d="M 87.5,25 C 87.5,75 50,75 37.5,75" 
                fill="none" 
                stroke="#e5e7eb" 
                strokeWidth="0.4" 
                strokeLinecap="round"
              />
              
              {/* Dots at endpoints (Percentage based) */}
              <circle cx="12.5" cy="25" r="0.8" fill="#e5e7eb" />
              <circle cx="37.5" cy="75" r="0.8" fill="#e5e7eb" />
              <circle cx="87.5" cy="25" r="0.8" fill="#e5e7eb" />
            </svg>

            {/* User entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--user">
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

            {/* Person entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--person">
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
            </div>

            {/* Add object */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--add" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={28} strokeWidth={1.5} />
              <span style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>Add object</span>
            </div>

            {/* Deal entity */}
            <div className="ws-dm-card ws-dm-card--graph ws-dm-card--deal">
              <div className="ws-dm-card-header">
                <div className="ws-dm-card-icon-box ws-dm-icon-purple"><CircleDollarSign size={15} /></div>
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
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Albert Lund', id: '6s59-027f-4C54-98a3-3af0b00a', type: 'Member', typeColor: '#f59e0b', score: 'Light', scoreColor: '#3b82f6', avatarColor: '#ecfdf5' },
                { name: 'Jenna Roberts', id: '2d77-027f-5B23-96V9-3D9ed00a', type: 'Admin', typeColor: '#f97316', score: 'Light', scoreColor: '#3b82f6', avatarColor: '#eff6ff' },
                { name: 'David Chen', id: '1dj0-d7dd-5090-ab709-5912b027', type: 'Admin', typeColor: '#f97316', score: 'Power User', scoreColor: '#8b5cf6', avatarColor: '#f5f3ff' },
                { name: 'Marc Lopez', id: '9bc0-3abd-8990-dj36-7698b022', type: 'Member', typeColor: '#f59e0b', score: 'Inactive', scoreColor: '#9ca3af', avatarColor: '#fff7ed' },
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
