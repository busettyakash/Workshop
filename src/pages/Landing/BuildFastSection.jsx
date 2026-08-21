import React from 'react'
import './Landing.css'
import {
  Mail,
  Search,
  Sparkles
} from 'lucide-react'

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

            <button className="ws-build-compose">
              <Mail size={14} style={{ marginRight: 6 }} /> Compose email
            </button>

            <div className="ws-build-details">
              <div className="ws-build-detail-label">▾ Details</div>
              <div className="ws-build-detail-row">
                <span>Name</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Rahul Sharma</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Description</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Manager at Electronics Hub</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Email</span>
                <a href="#" onClick={e => e.preventDefault()} className="ws-build-detail-link">rahul@electronichub.com</a>
              </div>
              <div className="ws-build-detail-row">
                <span>Location</span>
                <span>Mumbai, India</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Company</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Electronics Hub
                </span>
              </div>
              <div className="ws-build-detail-row">
                <span>Last interaction</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>6 hours ago</span>
              </div>
            </div>
          </div>

          {/* Right — highlights */}
          <div className="ws-build-highlights">
            <div className="ws-build-highlights-header">
              <Search size={14} style={{ marginRight: 6 }} /> Highlights
            </div>

            <div className="ws-build-highlight-card" style={{ marginBottom: 10 }}>
              <div className="ws-build-highlight-card-label">Summary <Sparkles size={12} style={{ opacity: 0.4, marginLeft: 4 }} /></div>
              <p className="ws-build-highlight-card-body" style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                Rahul Sharma, the Manager at Electronics Hub, is leading the
                initiative to modernize their data infrastructure and inventory pipeline.
              </p>
            </div>

            <div className="ws-build-highlight-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Company</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.84rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Electronics Hub
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Mumbai, India</div>
              </div>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Sales Outreach</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                  <strong>Step 2</strong> Automated email
                </div>
                <div className="ws-build-progress-bar">
                  <div className="ws-build-progress-fill" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
