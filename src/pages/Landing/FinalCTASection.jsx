import React from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

/**
 * Final CTA section — matching Screenshot 134421
 * "The platform behind thousands of shops" + CTA buttons + avatar bubbles
 */
export default function FinalCTASection() {
  return (
    <section className="ws-cta-section">
      <div className="ws-cta-inner">
        {/* Avatar bubbles */}
        <div className="ws-cta-avatars">
          {[
            { initials: 'RS', bg: '#6366f1' },
            { initials: 'PM', bg: '#059669' },
            { initials: 'AK', bg: '#3d68f5' },
            { initials: 'SP', bg: '#d97706' },
            { initials: 'VS', bg: '#7c3aed' },
          ].map((a, i) => (
            <div
              key={i}
              className="ws-cta-avatar-bubble"
              style={{
                background: a.bg,
                animationDelay: `${i * 0.1}s`,
              }}
            >
              {a.initials}
            </div>
          ))}
        </div>

        <h2 className="ws-cta-headline">
          The platform behind<br />
          <span className="ws-text-muted">thousands of shops.</span>
        </h2>

        <div className="ws-cta-buttons">
          <Link to="/signup" className="ws-hero-btn-primary">Start for free</Link>
          <a href="#" className="ws-hero-btn-outline">Talk to sales</a>
        </div>
      </div>
    </section>
  )
}
