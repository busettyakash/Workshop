import React from 'react'
import { Link } from 'react-router-dom'
import WorkshopLogo from '../../components/WorkshopLogo'
import HeroSection from './HeroSection'
import AutomateSection from './AutomateSection'
import AskWorkshopSection from './AskWorkshopSection'
import ConnectDataSection from './ConnectDataSection'
import DataModelSection from './DataModelSection'
import ReportingSection from './ReportingSection'
import BuildFastSection from './BuildFastSection'
import FinalCTASection from './FinalCTASection'
import LandingFooter from './LandingFooter'
import './Landing.css'

export default function Landing() {
  return (
    <div className="ws-landing">
      {/* ── Navbar ── */}
      <nav className="ws-nav">
        <div className="ws-nav-inner">
          <Link to="/" className="ws-nav-brand">
            <WorkshopLogo size={28} />
            <span className="ws-nav-brand-name">workshop</span>
          </Link>

          <div className="ws-nav-links">
            <a href="#platform" className="ws-nav-link">Platform</a>
            <a href="#resources" className="ws-nav-link">Resources</a>
            <a href="#customers" className="ws-nav-link">Customers</a>
            <a href="#pricing" className="ws-nav-link">Pricing</a>
          </div>

          <div className="ws-nav-cta">
            <Link to="/login" className="ws-nav-signin">Sign in</Link>
            <Link to="/signup" className="ws-nav-start">Start for free</Link>
          </div>
        </div>
      </nav>

      {/* ── 1. Hero ── */}
      <HeroSection />

      {/* ── 2. "Retail at full throttle" + Automate workflow ── */}
      <AutomateSection />

      {/* ── 3. Deploy AI / Ask Workshop ── */}
      <AskWorkshopSection />

      {/* ── 4. Connect any type of data ── */}
      <ConnectDataSection />

      {/* ── 5. Data Model ── */}
      <DataModelSection />

      {/* ── 6. Powerful Reporting ── */}
      <ReportingSection />

      {/* ── 7. Build fast ── */}
      <BuildFastSection />

      {/* ── 8. Final CTA ── */}
      <FinalCTASection />

      {/* ── 9. Footer ── */}
      <LandingFooter />
    </div>
  )
}
