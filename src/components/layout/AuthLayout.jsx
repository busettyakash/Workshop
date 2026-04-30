import React from 'react'
import { Link } from 'react-router-dom'
import WorkshopLogo from '../WorkshopLogo'
import './AuthLayout.css'

export default function AuthLayout({ children, rightPanel }) {
  return (
    <div className="ws-auth-layout">
      {/* Top brand bar */}
      <div className="ws-auth-topbar">
        <Link to="/" className="ws-auth-brand">
          <WorkshopLogo size={26} />
          <span className="ws-auth-brand-name">workshop</span>
        </Link>
      </div>

      {/* Card */}
      <main className="ws-auth-main">
        <div className="ws-auth-card">
          {/* Left — form area */}
          <div className="ws-auth-left">
            {children}
          </div>

          {/* Right — info panel */}
          <div className="ws-auth-right">
            {rightPanel || (
              <>
                <h2 className="ws-auth-right-title">Welcome to Workshop.</h2>
                <p className="ws-auth-right-body">
                  Workshop is a radically new type of retail platform. Built on an
                  entirely new data architecture, you'll have profiles and records for
                  every interaction within your store in minutes, always updated in
                  real-time.
                </p>
                <p className="ws-auth-right-body" style={{ marginTop: 12 }}>
                  You'll be able to customize and build your platform{' '}
                  <em>exactly</em> as you want it.
                </p>
                <p className="ws-auth-right-body" style={{ marginTop: 20, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Let's begin.
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="ws-auth-footer">
        <span>© {new Date().getFullYear()} Workshop Limited</span>
        <a href="#">Privacy Policy</a>
        <a href="#">Support</a>
        <a href="#">Sign out</a>
      </footer>
    </div>
  )
}
