import React from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

export default function HeroSection() {
  return (
    <section className="ws-hero">
      {/* Announcement pill */}
      <div className="ws-hero-pill">
        <span className="ws-hero-pill-badge">New</span>
        Workshop Billing is now live! 🎉
      </div>

      {/* Headline */}
      <h1 className="ws-hero-h1">
        Retail<br />operations magic.
      </h1>

      <p className="ws-hero-sub">
        Powerful, flexible and data-driven, Workshop makes it easy<br />
        to build the exact billing system your business needs.
      </p>

      {/* CTA Buttons */}
      <div className="ws-hero-cta">
        <Link to="/signup" className="ws-hero-btn-primary">Start for free</Link>
        <a href="#sales" className="ws-hero-btn-outline">Talk to sales</a>
      </div>

      {/* Product graphic — mimics the Attio spreadsheet UI */}
      <div className="ws-hero-graphic-wrap">
        <div className="ws-sg-container">

          {/* Sidebar */}
          <div className="ws-sg-sidebar">
            <div className="ws-sg-workspace">
              <div className="ws-sg-ws-icon">W</div>
              <span className="ws-sg-ws-name">Main Store</span>
              <span className="ws-sg-ws-chevron">›</span>
            </div>

            <div className="ws-sg-searchbox">
              <span>Search</span>
              <kbd className="ws-sg-kbd">⌘K</kbd>
            </div>

            <nav className="ws-sg-nav">
              {[
                'Notifications', 'Tasks', 'Notes', 'Emails', 'Reports'
              ].map(label => (
                <div key={label} className="ws-sg-nav-item">{label}</div>
              ))}
            </nav>
          </div>

          {/* Main table */}
          <div className="ws-sg-main">
            <div className="ws-sg-tabs">
              <div className="ws-sg-tab active"> Daily Sales Targets</div>
            </div>

            <div className="ws-sg-toolbar">
              <div className="ws-sg-tool">
                Upcoming orders ›
              </div>
              <div className="ws-sg-tool ws-sg-tool--btn">
                Filter <span className="ws-sg-count">2</span>
              </div>
              <div className="ws-sg-tool ws-sg-tool--btn">
                Sort <span className="ws-sg-count blue">1</span>
              </div>
              <div style={{ flex: 1 }} />
              <div className="ws-sg-tool ws-sg-tool--btn">View settings</div>
              <div className="ws-sg-tool ws-sg-tool--btn">↓ Import / Export ›</div>
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
                {[
                  { avatar: 'S', avatarColor: '#6366f1', name: 'Samsung QLED', status: 'Paid', statusColor: '#3b82f6', chip: 'Tomorrow', chipBg: '#dbeafe', chipText: '#1d4ed8', strength: 'Very strong with Vendor A', strengthColor: '#10b981' },
                  { avatar: 'A', avatarColor: '#0ea5e9', name: 'Apple AirPods', status: 'Expansion', statusColor: '#3b82f6', chip: 'Next month', chipBg: '#f3f4f6', chipText: '#374151', strength: 'Very strong with Vendor B', strengthColor: '#10b981' },
                  { avatar: 'L', avatarColor: '#3b82f6', name: "Levi's 511 Jeans", status: 'Delivered', statusColor: '#10b981', chip: 'In 30 minutes', chipBg: '#dcfce7', chipText: '#166534', strength: 'Good with Vendor C', strengthColor: '#3b82f6' },
                ].map(row => (
                  <tr key={row.name}>
                    <td>
                      <div className="ws-sg-td-flex">
                        <div className="ws-sg-avatar" style={{ background: row.avatarColor }}>
                          {row.avatar}
                        </div>
                        <span className="ws-sg-td-name">{row.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="ws-sg-td-flex">
                        <div className="ws-sg-dot" style={{ background: row.statusColor }} />
                        {row.status}
                      </div>
                    </td>
                    <td>
                      <span className="ws-sg-chip" style={{ background: row.chipBg, color: row.chipText }}>
                        {row.chip}
                      </span>
                    </td>
                    <td>
                      <div className="ws-sg-td-flex">
                        <span style={{ color: row.strengthColor }}>⚡</span>
                        {row.strength}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gradient fade at bottom */}
        <div className="ws-hero-graphic-fade" />
      </div>
    </section>
  )
}
