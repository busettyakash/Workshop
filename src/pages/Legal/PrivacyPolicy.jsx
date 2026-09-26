import React, { useEffect } from 'react'
import { Link } from 'react-router'
import WorkshopLogo from '../../components/WorkshopLogo'
import LandingFooter from '../Landing/LandingFooter'
import '../Landing/Landing.css'

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, lineHeight: 1.7, color: '#334155', fontSize: '1rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>1. Overview</h2>
            <p>
              At Workshop (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), we take data privacy and security seriously. This Privacy Policy describes how we collect, process, and protect your personal and business data when you use our retail management platform, billing services, and related applications.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>2. Information We Collect</h2>
            <p>We only collect information necessary to provide and improve our retail platform services:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Account Information:</strong> Name, business email, phone number, and encrypted credentials.</li>
              <li><strong>Business &amp; Billing Data:</strong> Shop name, GSTIN, business address, line items, quotations, and invoice records created within the app.</li>
              <li><strong>Customer Records:</strong> Names, phone numbers, and transactional records saved by your workspace for invoice generation.</li>
              <li><strong>Usage &amp; Diagnostic Logs:</strong> Anonymized telemetry, error reports, and request latencies to maintain platform reliability.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>3. How We Use Your Data</h2>
            <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>To provide billing, invoicing, and inventory tracking operations.</li>
              <li>To compute GST reports and export compliance documents.</li>
              <li>To authenticate workspace users and secure account access.</li>
              <li>To send critical system notifications and transactional emails (such as quotes and receipts).</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>4. Data Protection &amp; Security</h2>
            <p>
              We implement industry-standard cryptographic practices. Passwords are securely hashed with salted scrypt encryption, web communication is strictly encrypted over HTTPS (TLS 1.3), and sensitive backend access is shielded behind verified session tokens.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>5. Third-Party Services</h2>
            <p>
              We do not sell, rent, or trade your personal or business data. We partner only with trusted infrastructure providers (such as cloud hosting, database platforms, and transactional email providers) bound by strict data processing agreements.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>6. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy or wish to request data deletion, please contact us at <a href="mailto:support@workshop.app" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>support@workshop.app</a>.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
