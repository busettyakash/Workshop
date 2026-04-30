import React from 'react'
import './Landing.css'

/**
 * "Connect any type of data" — matching Screenshot 134334
 * Left: text + explore link
 * Center: Integration categories + Workshop logo + data model cards
 * Right: Integration brand logos grid
 */
export default function ConnectDataSection() {
  return (
    <section className="ws-section ws-section--gray">
      <div className="ws-section-inner">
        <div className="ws-split-section">

          {/* Left text */}
          <div className="ws-split-text">
            <h3 className="ws-split-title">Connect any type of data</h3>
            <p className="ws-split-desc">
              Sync product data, billing data, and everything in between, for a
              real-time single source of truth for your business.
            </p>
            <a href="#" className="ws-explore-link">Explore data →</a>
          </div>

          {/* Center — Integration hub */}
          <div className="ws-connect-hub">
            {/* Category labels */}
            <div className="ws-connect-categories">
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">📦</span> Sales engagement
              </div>
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">📧</span> Email & calendar
              </div>
            </div>

            <div className="ws-connect-categories">
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">🗃</span> Data warehouses
              </div>
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">🎧</span> Customer support
              </div>
            </div>

            <div className="ws-connect-categories">
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">💳</span> Billing & invoicing
              </div>
              <div className="ws-connect-cat">
                <span className="ws-connect-cat-dot">🛒</span> Product data
              </div>
            </div>

            {/* Central logo */}
            <div className="ws-connect-center-logo">
              <div className="ws-connect-logo-circle">W</div>
            </div>

            {/* Data model cards */}
            <div className="ws-connect-model-cards">
              <div className="ws-connect-model-card">
                <span className="ws-connect-model-icon ws-connect-model-icon--blue">🏬</span>
                <span className="ws-connect-model-name">Workspace</span>
                <span className="ws-connect-model-badge">Standard</span>
                <div className="ws-connect-model-count">2,860 Records</div>
              </div>
              <div className="ws-connect-model-card">
                <span className="ws-connect-model-icon ws-connect-model-icon--purple">🏢</span>
                <span className="ws-connect-model-name">Company</span>
                <span className="ws-connect-model-badge">Standard</span>
                <div className="ws-connect-model-count">3,097 Records</div>
              </div>
              <div className="ws-connect-model-card ws-connect-model-card--center">
                <span className="ws-connect-model-icon ws-connect-model-icon--green">📋</span>
                <span className="ws-connect-model-name">Deal</span>
                <span className="ws-connect-model-badge">Standard</span>
                <div className="ws-connect-model-count">5,493 Records</div>
              </div>
            </div>
          </div>

          {/* Right — Brand logos grid */}
          <div className="ws-connect-brands">
            {[
              { emoji: '✳', color: '#ff6b6b', label: 'Tally' },
              { emoji: '⬡', color: '#6c5ce7', label: 'Slack' },
              { emoji: 'M', color: '#ea4335', label: 'Gmail' },
              { emoji: '📊', color: '#4285f4', label: 'Sheets' },
              { emoji: '🔄', color: '#1DB954', label: 'Sync' },
              { emoji: '◐', color: '#111', label: 'Notion' },
              { emoji: '●', color: '#7c3aed', label: 'Razorpay' },
              { emoji: '〰', color: '#e91e63', label: 'Stripe' },
            ].map((brand, i) => (
              <div key={i} className="ws-brand-icon" title={brand.label}>
                <span style={{ color: brand.color, fontSize: '1.4rem' }}>{brand.emoji}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
