import React from 'react'
import './Landing.css'

/**
 * Data Model section — matching Screenshot 134351
 * Top: big headline + CTA + category tabs
 * Middle: Entity cards (User, Person, Deal) with relationship lines + "Add object"
 * Bottom: Data table with user records
 */
export default function DataModelSection() {
  return (
    <section className="ws-section">
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
          {['Retail Shops', 'Wholesale', 'Franchise', 'Individual Sellers'].map((tab, i) => (
            <button key={tab} className={`ws-dm-tab ${i === 0 ? 'ws-dm-tab--active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Entity relationship diagram ── */}
        <div className="ws-dm-entities">
          {/* User entity */}
          <div className="ws-dm-card ws-dm-card--left">
            <div className="ws-dm-card-header">
              <span className="ws-dm-card-icon ws-dm-card-icon--green">🟢</span>
              <span className="ws-dm-card-name">Customer</span>
              <span className="ws-dm-card-badge">Standard</span>
            </div>
            <div className="ws-dm-card-attrs">
              <div className="ws-dm-attr">📊 Customer ID</div>
              <div className="ws-dm-attr">⭐ Loyalty score</div>
              <div className="ws-dm-attr">🏷 Customer type</div>
              <div className="ws-dm-attr ws-dm-attr--more">+ 4 More Attributes</div>
            </div>
          </div>

          {/* Person entity (center) */}
          <div className="ws-dm-card ws-dm-card--center">
            <div className="ws-dm-card-header">
              <span className="ws-dm-card-icon ws-dm-card-icon--blue">🔵</span>
              <span className="ws-dm-card-name">Product</span>
              <span className="ws-dm-card-badge">Standard</span>
            </div>
            <div className="ws-dm-card-attrs">
              <div className="ws-dm-attr">📦 Name</div>
              <div className="ws-dm-attr">📧 SKU</div>
              <div className="ws-dm-attr">🏢 Category</div>
              <div className="ws-dm-attr ws-dm-attr--more">+ 12 More Attributes</div>
            </div>
          </div>

          {/* Add object placeholder */}
          <div className="ws-dm-card ws-dm-card--add">
            <span className="ws-dm-add-icon">＋</span>
            <span>Add object</span>
          </div>

          {/* Deal entity (right) */}
          <div className="ws-dm-card ws-dm-card--right">
            <div className="ws-dm-card-header">
              <span className="ws-dm-card-icon ws-dm-card-icon--orange">🟠</span>
              <span className="ws-dm-card-name">Order</span>
              <span className="ws-dm-card-badge">Standard</span>
            </div>
            <div className="ws-dm-card-attrs">
              <div className="ws-dm-attr">📋 Order name</div>
              <div className="ws-dm-attr">🏬 Workspace</div>
              <div className="ws-dm-attr">📈 Stage</div>
              <div className="ws-dm-attr ws-dm-attr--more">+ 2 More Attributes</div>
            </div>
          </div>
        </div>

        {/* ── Data table ── */}
        <div className="ws-dm-table-wrap">
          <table className="ws-dm-table">
            <thead>
              <tr>
                <th></th>
                <th>Customer</th>
                <th>Customer ID</th>
                <th>Customer type</th>
                <th>Loyalty score</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Rahul Sharma', id: '6s59-027f-4C54-98a3-3af0b00a', type: 'Member', typeColor: '#7c3aed', score: 'Gold', scoreColor: '#059669' },
                { name: 'Priya Mehta', id: '2d77-027f-5B23-96V9-3D9ed00a', type: 'Premium', typeColor: '#3d68f5', score: 'Gold', scoreColor: '#059669' },
                { name: 'Amit Kumar', id: '1dj0-d7dd-5090-ab709-5912b02z', type: 'Premium', typeColor: '#3d68f5', score: 'Platinum', scoreColor: '#7c3aed' },
                { name: 'Sunita Patel', id: '9bc0-3abd-8990-dj36-7698b02z', type: 'Member', typeColor: '#7c3aed', score: 'Inactive', scoreColor: '#9ca3af' },
              ].map((row, i) => (
                <tr key={i}>
                  <td>
                    <div className="ws-dm-row-avatar">
                      {row.name.split(' ').map(w => w[0]).join('')}
                    </div>
                  </td>
                  <td className="ws-td-name">{row.name}</td>
                  <td className="ws-td-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                    {row.id}
                  </td>
                  <td>
                    <span className="ws-dm-type-chip" style={{ background: row.typeColor + '18', color: row.typeColor }}>
                      {row.type}
                    </span>
                  </td>
                  <td>
                    <span className="ws-dm-type-chip" style={{ background: row.scoreColor + '18', color: row.scoreColor }}>
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
