import React from 'react'
import './Landing.css'

const FEATURES = [
  {
    title: 'Smart Inventory',
    desc: 'Track every product in real-time. Get low-stock alerts before you run out and automate reorder workflows.',
  },
  {
    title: 'GST Billing',
    desc: 'Generate GST-compliant invoices instantly. Full support for GSTIN, HSN codes, and e-invoicing.',
  },
  {
    title: 'Customer CRM',
    desc: 'Build lasting relationships. Track purchase history, preferences, and automate loyalty rewards.',
  },
  {
    title: 'Powerful Reports',
    desc: 'Real-time dashboards with sales trends, product performance, and custom date range analysis.',
  },
  {
    title: 'Automate Everything',
    desc: 'Set up workflows for reorders, notifications, and customer communication — all on autopilot.',
  },
  {
    title: 'Enterprise Security',
    desc: 'Bank-grade encryption, role-based access control, and automatic audit logs for every action.',
  },
]

export default function FeaturesSection() {
  return (
    <section className="ws-features" id="platform">
      <div className="ws-features-inner">
        <div className="ws-features-header">
          <span className="ws-features-eyebrow">Platform</span>
          <h2 className="ws-features-title">
            Everything your store<br />needs to grow.
          </h2>
          <p className="ws-features-sub">
            From billing to inventory to customer relationships — Workshop brings your entire
            retail operation into one beautifully unified platform.
          </p>
        </div>

        <div className="ws-features-grid">
          {FEATURES.map((f) => (
            <div className="ws-feature-card" key={f.title}>
              <h3 className="ws-feature-title">{f.title}</h3>
              <p className="ws-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="ws-stats-row">
          {[
            { value: '10,000+', label: 'Shops registered' },
            { value: '₹500Cr+', label: 'Processed in billing' },
            { value: '99.9%',   label: 'Uptime SLA' },
            { value: '4.9★',   label: 'Average rating' },
          ].map(s => (
            <div className="ws-stat-item" key={s.label}>
              <div className="ws-stat-value">{s.value}</div>
              <div className="ws-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
