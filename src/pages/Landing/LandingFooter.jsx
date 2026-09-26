import React from 'react'
import { Link } from 'react-router'
import WorkshopLogo from '../../components/WorkshopLogo'
import './Landing.css'

const FOOTER_COLS = [
  {
    heading: 'Platform',
    links: [
      { name: 'Billing', href: '/#platform' },
      { name: 'Inventory', href: '/#platform' },
      { name: 'Customers', href: '/#platform' },
      { name: 'Reports', href: '/#platform' },
      { name: 'Automations', href: '/#platform' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { name: 'About', href: '/#platform' },
      { name: 'Customers', href: '/#customers' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { name: 'Privacy Policy', to: '/privacy' },
      { name: 'Terms of Service', to: '/terms' },
    ],
  },
]

export default function LandingFooter() {
  return (
    <footer className="ws-footer">
      <div className="ws-footer-inner">
        <div className="ws-footer-top">
          <div className="ws-footer-brand-col">
            <div className="ws-footer-brand">
              <WorkshopLogo size={20} />
              <span>workshop</span>
            </div>
            <p className="ws-footer-tagline">
              The retail operating platform for modern Indian businesses.
            </p>
          </div>

          {FOOTER_COLS.map(col => (
            <div className="ws-footer-col" key={col.heading}>
              <div className="ws-footer-col-label">{col.heading}</div>
              {col.links.map(link => {
                if (link.to) {
                  return (
                    <Link to={link.to} key={link.name} className="ws-footer-link">
                      {link.name}
                    </Link>
                  )
                }
                return (
                  <a href={link.href} key={link.name} className="ws-footer-link">
                    {link.name}
                  </a>
                )
              })}
            </div>
          ))}
        </div>

        <div className="ws-footer-bottom">
          <span>© {new Date().getFullYear()} Workshop Limited. All rights reserved.</span>
          <div className="ws-footer-bottom-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
