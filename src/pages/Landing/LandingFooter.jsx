import React from 'react'
import { Link } from 'react-router-dom'
import WorkshopLogo from '../../components/WorkshopLogo'
import './Landing.css'

const FOOTER_COLS = [
  {
    heading: 'Platform',
    links: ['Billing', 'Inventory', 'Customers', 'Reports', 'Automations'],
  },
  {
    heading: 'Company',
    links: ['About', 'Customers', 'Changelog', 'Careers'],
  },
  {
    heading: 'Resources',
    links: ['Documentation', 'Help center', 'Blog', 'System status'],
  },
  {
    heading: 'Legal',
    links: ['Privacy Policy', 'Terms of Service', 'Security'],
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
              {col.links.map(link => (
                <a href="#" key={link} className="ws-footer-link">{link}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="ws-footer-bottom">
          <span>© {new Date().getFullYear()} Workshop Limited. All rights reserved.</span>
          <div className="ws-footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
