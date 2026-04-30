import React from 'react'
import './Landing.css'

/**
 * "Build fast" section — matching Screenshot 134408
 * Center: big headline + CTA + filter tabs + customer profile card
 */
export default function BuildFastSection() {
  return (
    <section className="ws-section">
      <div className="ws-section-inner">

        {/* ── Big headline ── */}
        <div className="ws-big-headline ws-big-headline--centered">
          <h2 className="ws-big-headline-title" style={{ maxWidth: 750, margin: '0 auto' }}>
            <strong>Build fast.</strong>{' '}
            <span className="ws-text-muted">
              Forget months of setup. Workshop syncs immediately with your
              inventory and billing, building a powerful platform right before your eyes.
            </span>
          </h2>
          <div style={{ marginTop: 20 }}>
            <a href="/signup" className="ws-outline-btn">Start for free</a>
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="ws-dm-tabs" style={{ marginTop: 40 }}>
          {['📧 Email events', '📅 Calendar events', '⚡ Segment events', '🌐 Data sources'].map((tab, i) => (
            <button key={i} className={`ws-dm-tab ${i === 0 ? 'ws-dm-tab--active' : ''}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Customer profile card ── */}
        <div className="ws-build-profile">
          {/* Left — contact info */}
          <div className="ws-build-contact">
            <div className="ws-build-contact-top">
              <div className="ws-build-avatar">RS</div>
              <div>
                <div className="ws-build-name">Rahul Sharma</div>
                <div className="ws-build-role">Manager at Electronics Hub</div>
              </div>
            </div>

            <button className="ws-build-compose">✉ Compose email</button>

            <div className="ws-build-details">
              <div className="ws-build-detail-label">▾ Details</div>
              <div className="ws-build-detail-row">
                <span>📋 Name</span>
                <span>Rahul Sharma</span>
              </div>
              <div className="ws-build-detail-row">
                <span>💼 Description</span>
                <span>Manager at Electronics Hub</span>
              </div>
              <div className="ws-build-detail-row">
                <span>📧 Email</span>
                <a href="#" className="ws-build-detail-link">rahul@electronichub.com</a>
              </div>
              <div className="ws-build-detail-row">
                <span>📍 Location</span>
                <span>Mumbai, India</span>
              </div>
              <div className="ws-build-detail-row">
                <span>🏢 Company</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Electronics Hub
                </span>
              </div>
              <div className="ws-build-detail-row">
                <span>🕐 Last interaction</span>
                <span>6 hours ago</span>
              </div>
            </div>
          </div>

          {/* Right — highlights + activity */}
          <div className="ws-build-highlights">
            <div className="ws-build-highlights-header">🔍 Highlights</div>

            <div className="ws-build-highlight-grid">
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Summary <span style={{ opacity: 0.4 }}>✦</span></div>
                <p className="ws-build-highlight-card-body">
                  Rahul Sharma, the Manager at Electronics Hub, is leading the
                  initiative to modernize their data infrastructure....
                </p>
              </div>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">LinkedIn <span style={{ color: '#0077b5' }}>🔗</span></div>
                <a href="#" className="ws-build-highlight-link">rahulsharma</a>
              </div>
            </div>

            <div className="ws-build-highlight-grid">
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Upcoming</div>
                <div className="ws-build-highlight-event">
                  <span className="ws-build-highlight-event-name">Demo Call</span>
                  <span className="ws-build-highlight-event-time">Nov 29, 10:40 AM</span>
                </div>
              </div>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Company</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Electronics Hub
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Mumbai, India</div>
              </div>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Sales Outreach</div>
                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Step 2</strong> Automated email
                </div>
                <div className="ws-build-progress-bar">
                  <div className="ws-build-progress-fill" style={{ width: '60%' }} />
                </div>
              </div>
            </div>

            {/* Activity feed */}
            <div className="ws-build-activity">
              <div className="ws-build-activity-header">✦ Activity ›</div>
              {[
                { who: 'Amit Kumar', action: 'attended an', what: 'in-person meeting', time: '6 hours ago' },
                { who: 'Rahul Sharma', action: 'attended an', what: 'event', time: '2 days ago' },
                { who: 'Amit Kumar', action: 'made an', what: 'outbound phone call', time: '4 days ago' },
              ].map((act, i) => (
                <div key={i} className="ws-build-activity-item">
                  <span className="ws-build-activity-dot" />
                  <div className="ws-build-activity-text">
                    <strong>{act.who}</strong> {act.action} <a href="#">{act.what}</a>
                  </div>
                  <span className="ws-build-activity-time">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
