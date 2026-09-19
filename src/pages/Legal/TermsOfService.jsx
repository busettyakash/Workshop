import React, { useEffect } from 'react'
import { Link } from 'react-router'
import WorkshopLogo from '../../components/WorkshopLogo'
import LandingFooter from '../Landing/LandingFooter'
import '../Landing/Landing.css'

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="ws-landing" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="ws-nav">
        <div className="ws-nav-inner">
          <Link to="/" className="ws-nav-brand">
            <WorkshopLogo size={28} />
            <span className="ws-nav-brand-name">workshop</span>
          </Link>

          <div className="ws-nav-links">
            <Link to="/" className="ws-nav-link">Home</Link>
            <a href="/#platform" className="ws-nav-link">Platform</a>
            <a href="/#pricing" className="ws-nav-link">Pricing</a>
          </div>

          <div className="ws-nav-cta">
            <Link to="/login" className="ws-nav-signin">Sign in</Link>
            <Link to="/signup" className="ws-nav-start">Start for free</Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: '840px', margin: '0 auto', padding: '60px 24px 80px', width: '100%' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Terms of Service
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7, color: '#334155', fontSize: '1rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>1. Agreement to Terms</h2>
            <p>
              By accessing or using Workshop, you agree to be bound by these Terms of Service. If you are using the platform on behalf of a company or retail business, you represent that you have authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>2. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your workspace account. You agree to notify us immediately of any unauthorized access or security breach.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>3. Acceptable Use</h2>
            <p>
              You agree not to misuse the platform, attempt unauthorized access to platform servers, inject harmful scripts, or generate fraudulent billing documents. We reserve the right to suspend accounts that violate acceptable use guidelines.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>4. Data Ownership &amp; Intellectual Property</h2>
            <p>
              You retain full ownership of all customer, inventory, pricing, and invoice data you upload to Workshop. Workshop retains all rights and intellectual property in the software, interfaces, designs, and platform algorithms.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>5. Limitation of Liability</h2>
            <p>
              Workshop provides tools for billing and calculations. You are responsible for ensuring that the GST rates, item descriptions, and statutory details entered into your bills comply with applicable tax and local commerce laws.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>6. Modifications &amp; Termination</h2>
            <p>
              We may update these terms periodically. Continued use of Workshop following any updates constitutes acceptance of the modified Terms.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
