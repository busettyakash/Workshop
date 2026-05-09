import React from 'react';
import './Landing.css';

/* ─── Integration logos ─── */
const ZapierLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <circle cx="20" cy="20" r="20" fill="#FF4A00" />
    <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">Z</text>
  </svg>
);
const SlackLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <path fill="#E01E5A" d="M15 5a4 4 0 0 0-4 4v6h8V9a4 4 0 0 0-4-4z" />
    <path fill="#ECB22E" d="M35 15a4 4 0 0 0-4-4h-6v8h6a4 4 0 0 0 4-4z" />
    <path fill="#2EB67D" d="M25 35a4 4 0 0 0 4-4v-6h-8v6a4 4 0 0 0 4 4z" />
    <path fill="#36C5F0" d="M5 25a4 4 0 0 0 4 4h6v-8H9a4 4 0 0 0-4 4z" />
  </svg>
);
const GmailLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <rect width="40" height="40" rx="6" fill="#fff" />
    <path fill="#EA4335" d="M6 30V14l14 9 14-9v16H6z" />
    <path fill="#4285F4" d="M6 14l14 9 14-9H6z" />
    <path fill="#FBBC05" d="M6 14v16l6-8-6-8z" />
    <path fill="#34A853" d="M34 14v16l-6-8 6-8z" />
    <path fill="#C5221F" d="M6 30l6-8 8 5 8-5 6 8H6z" />
  </svg>
);
const OutlookLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <rect width="40" height="40" rx="6" fill="#0078D4" />
    <rect x="22" y="10" width="13" height="19" rx="2" fill="#50D9FF" opacity="0.9" />
    <rect x="5" y="9" width="18" height="22" rx="2.5" fill="white" opacity="0.15" />
    <text x="14" y="23" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">O</text>
  </svg>
);
const SegmentLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <circle cx="20" cy="20" r="20" fill="#52BD94" />
    <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">S</text>
  </svg>
);
const NotionLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <rect width="40" height="40" rx="6" fill="#fff" stroke="#e5e5e5" />
    <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="#1a1a1a" fontSize="17" fontWeight="bold">N</text>
  </svg>
);
const HubspotLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <circle cx="20" cy="20" r="20" fill="#FF7A59" />
    <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">hs</text>
  </svg>
);
const MixpanelLogo = () => (
  <svg viewBox="0 0 40 40" width="20" height="20">
    <circle cx="20" cy="20" r="20" fill="#7856FF" />
    <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">M</text>
  </svg>
);

/* ─── Label icons ─── */
const SalesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2.5" stroke="#999" strokeWidth="1.3" />
    <path d="M4 11l2.5-3L9 10l2-2.5L13 5" stroke="#999" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const EmailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="#999" strokeWidth="1.3" />
    <path d="M1 6l7 4.5L15 6" stroke="#999" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const DataIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <ellipse cx="8" cy="4" rx="6" ry="2" stroke="#999" strokeWidth="1.3" />
    <path d="M2 4v4c0 1.1 2.69 2 6 2s6-.9 6-2V4" stroke="#999" strokeWidth="1.3" />
    <path d="M2 8v4c0 1.1 2.69 2 6 2s6-.9 6-2V8" stroke="#999" strokeWidth="1.3" />
  </svg>
);
const SupportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5.5" r="2.5" stroke="#999" strokeWidth="1.3" />
    <path d="M1.5 14c0-3 2.46-4.5 4.5-4.5s4.5 1.5 4.5 4.5" stroke="#999" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="12.5" cy="5" r="1.8" stroke="#999" strokeWidth="1.1" />
  </svg>
);
const BillingIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="#999" strokeWidth="1.3" />
    <path d="M8 4.5v1M8 10v1.5M6.5 9.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1-1.5-1.2C7.17 8.1 6.5 7.67 6.5 6.8c0-.83.67-1.3 1.5-1.3s1.5.47 1.5 1.3" stroke="#999" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const ProductIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5L14 4.5V8c0 3.5-3 5.5-6 6-3-.5-6-2.5-6-6V4.5L8 1.5z" stroke="#999" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M5.5 8l1.5 1.5L10.5 6" stroke="#999" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Card icons ─── */
const WorkspaceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="5" fill="#3B82F6" />
    <rect x="4" y="4" width="5.5" height="5.5" rx="1.2" fill="white" />
    <rect x="10.5" y="4" width="5.5" height="5.5" rx="1.2" fill="white" />
    <rect x="4" y="10.5" width="5.5" height="5.5" rx="1.2" fill="white" />
    <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.2" fill="white" />
  </svg>
);
const CompanyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="5" fill="#3B82F6" />
    <circle cx="10" cy="7.5" r="2.8" fill="white" />
    <path d="M3.5 18c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" fill="white" />
  </svg>
);
const DealIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="5" fill="#F97316" />
    <rect x="4.5" y="3.5" width="11" height="13" rx="1.5" fill="white" />
    <rect x="6.5" y="6.5" width="7" height="1.3" rx="0.65" fill="#F97316" />
    <rect x="6.5" y="9.5" width="7" height="1.3" rx="0.65" fill="#F97316" />
    <rect x="6.5" y="12.5" width="4.5" height="1.3" rx="0.65" fill="#F97316" />
  </svg>
);

/* ─── Workshop logo node ─── */
const WorkshopLogo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="3" y="10" width="4.5" height="14" rx="2.2" fill="#111" />
    <rect x="13.5" y="14" width="4.5" height="10" rx="2.2" fill="#111" />
    <rect x="24" y="10" width="4.5" height="14" rx="2.2" fill="#111" />
  </svg>
);



const LABELS = [
  { icon: <SalesIcon />, text: 'Sales engagement' },
  { icon: <EmailIcon />, text: 'Email & calendar' },
  { icon: <DataIcon />, text: 'Data warehouses' },
  { icon: <SupportIcon />, text: 'Customer support' },
  { icon: <BillingIcon />, text: 'Billing & invoicing' },
  { icon: <ProductIcon />, text: 'Product data' },
];

const INTEGRATIONS = [
  <ZapierLogo />, <SlackLogo />,
  <GmailLogo />, <OutlookLogo />,
  <SegmentLogo />, <NotionLogo />,
  <HubspotLogo />, <MixpanelLogo />,
];

/* ════════════════════════════════════════
   SINGLE-PAGE EXPORT
════════════════════════════════════════ */
export default function ConnectDataSection() {
  return (
    <div className="cds-split">

      {/* ── LEFT ── */}
      <div className="cds-left">
        <div className="cds-left-top">
          <h2 className="cds-heading">Continuous context<br />for everyone.</h2>
          <p className="cds-sub">
            Sales, success, finance, and every agent in the company,
            all running on the same live picture of the customer.
          </p>
        </div>
        <a href="#explore" className="cds-link">Explore data →</a>
      </div>

      {/* ── CENTER ── */}
      <div className="cds-center">
        <div className="cds-grid-bg" />

        {/* Label grid — top 50% */}
        <div className="cds-labels-grid">
          {LABELS.map((l, i) => (
            <div key={i} className="cds-label-cell" style={{ animationDelay: `${0.04 + i * 0.07}s` }}>
              {l.icon}
              <span>{l.text}</span>
            </div>
          ))}
        </div>

        {/* Graph area — bottom 50% */}
        <div className="cds-graph-area">
          {/*
                SVG: 600 × 300, preserveAspectRatio="none" so it stretches exactly.
                Logo sits at (300, 0) — on the divider.

                Card positions in CSS (left %, bottom px), graph-area height = 320px:
                  Workspace : left 20%  → SVG x = 0.20 × 600 = 120  |  bottom 80px → SVG y = (320-80)/320 × 300 = 225
                  Company   : left 80%  → SVG x = 0.80 × 600 = 480  |  bottom 80px → SVG y = 225
                  Deal      : left 50%  → SVG x = 300                |  bottom 16px → SVG y = (320-16)/320 × 300 = 285

                Lines end at top-centre of each card (card ~64px tall, ~148px wide):
                  Workspace  → (120, 185)
                  Company    → (480, 185)
                  Deal       → (300, 248)
              */}
          <svg
            className="cds-connector-svg"
            viewBox="0 0 600 300"
            preserveAspectRatio="none"
          >
            <path className="cds-line cds-line-1" d="M300,0 C300,100 120,100 120,185" />
            <path className="cds-line cds-line-2" d="M300,0 C300,100 480,100 480,185" />
            <path className="cds-line cds-line-3" d="M300,0 L300,248" />
          </svg>

          {/* Logo node */}
          <div className="cds-logo-node">
            <div className="cds-pulse-ring" />
            <WorkshopLogo />
          </div>

          {/* Workspace — left 20% */}
          <div className="cds-card cds-card-l">
            <div className="cds-card-head">
              <WorkspaceIcon />
              <span className="cds-card-name">Workspace</span>
              <span className="cds-badge">Standard</span>
            </div>
            <div className="cds-card-count"><strong>2,857</strong> Records</div>
          </div>

          {/* Company — left 80% */}
          <div className="cds-card cds-card-r">
            <div className="cds-card-head">
              <CompanyIcon />
              <span className="cds-card-name">Company</span>
              <span className="cds-badge">Standard</span>
            </div>
            <div className="cds-card-count"><strong>3,096</strong> Records</div>
          </div>

          {/* Deal — bottom centre */}
          <div className="cds-card cds-card-b">
            <div className="cds-card-head">
              <DealIcon />
              <span className="cds-card-name">Deal</span>
              <span className="cds-badge">Standard</span>
            </div>
            <div className="cds-card-count"><strong>5,490</strong> Records</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="cds-right">
        <div className="cds-dot-bg" />

        <div className="cds-dash-wrap">
          <div className="cds-dash-v" />
          <div className="cds-dash-h" style={{ top: '22%' }} />
          <div className="cds-dash-h" style={{ top: '46%' }} />
          <div className="cds-dash-h" style={{ top: '70%' }} />
        </div>

        <div className="cds-integrations">
          <div className="cds-int-grid">
            {INTEGRATIONS.map((logo, i) => (
              <div key={i} className="cds-int-icon" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                {logo}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}