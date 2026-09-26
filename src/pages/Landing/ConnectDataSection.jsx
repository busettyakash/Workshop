import React from 'react'
import { Link } from 'react-router'
import {
  FileText,
  Package,
  Send,
  Users,
  TrendingUp,
  Mail,
  Receipt,
  Boxes
} from 'lucide-react'
import WorkshopLogo from '../../components/WorkshopLogo'

/* ── Customer-Facing Retail & Business Integrations ── */
const INTEGRATIONS = [
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
        GST
      </div>
    ),
    label: 'GST & E-Way Bill Portal',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#5f259f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
        UPI
      </div>
    ),
    label: 'UPI & QR Payments',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#107c41', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
        XLS
      </div>
    ),
    label: 'Excel & CSV Stock Import',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e11d48', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
        TLY
      </div>
    ),
    label: 'Tally Accounting Export',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
        WA
      </div>
    ),
    label: 'WhatsApp Bill Sharing',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ea4335', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
        <Mail size={20} />
      </div>
    ),
    label: 'Gmail & Business Email',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
        <FileText size={20} />
      </div>
    ),
    label: 'PDF Invoices & Barcodes',
  },
  {
    logo: (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
        SMS
      </div>
    ),
    label: 'SMS & Payment Reminders',
  },
]

const LABELS = [
  { icon: <FileText size={15} style={{ color: '#2563eb' }} />, text: 'GST Tax Invoicing' },
  { icon: <Package size={15} style={{ color: '#16a34a' }} />, text: 'Live Inventory & Stock Sync' },
  { icon: <Send size={15} style={{ color: '#ea580c' }} />, text: 'Quotations & Estimations' },
  { icon: <Users size={15} style={{ color: '#9333ea' }} />, text: 'Customer Ledgers & Balances' },
  { icon: <TrendingUp size={15} style={{ color: '#0d9488' }} />, text: 'Profit Margins & Pricing' },
  { icon: <Mail size={15} style={{ color: '#e11d48' }} />, text: 'Automated Invoice Dispatch' },
]

export default function ConnectDataSection() {
  return (
    <div className="cds-split">

      {/* ── LEFT — Real Retail & Wholesale Operations ── */}
      <div className="cds-left">
        <div className="cds-left-top">
          <h2 className="cds-heading">Continuous context for your business.</h2>
          <p className="cds-sub">
            Billing, inventory, quotations, and customer ledgers—all running on the same live picture of your retail operations.
          </p>

          {/* Core Feature List */}
          <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {LABELS.map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.82rem', color: '#374151', fontWeight: 600,
              }}>
                {l.icon}
                {l.text}
              </div>
            ))}
          </div>
        </div>
        <Link to="/signup" className="cds-link" style={{ marginTop: '24px', textDecoration: 'none' }}>Explore features →</Link>
      </div>

      {/* ── CENTER — Core Data Architecture Diagram ── */}
      <div className="cds-center" style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Dot grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          pointerEvents: 'none',
        }} />

        {/* Diagram container */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'relative', width: '440px', height: '420px' }}>

            {/* SVG connectors */}
            <svg viewBox="0 0 440 420" fill="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
              <path d="M220 76 L220 130" stroke="#cbd5e1" strokeWidth="1.5" />
              <path d="M90 130 L350 130" stroke="#cbd5e1" strokeWidth="1.5" />
              <path d="M90 130 L90 180" stroke="#cbd5e1" strokeWidth="1.5" />
              <path d="M350 130 L350 180" stroke="#cbd5e1" strokeWidth="1.5" />
              <path d="M220 130 L220 295" stroke="#cbd5e1" strokeWidth="1.5" />
            </svg>

            {/* Logo node */}
            <div style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translateX(-50%)',
              width: '76px', height: '76px',
              background: '#fff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              zIndex: 4,
            }}>
              <WorkshopLogo size={36} />
            </div>

            {/* Invoices card — top left */}
            <div style={{
              position: 'absolute', top: '180px', left: '0',
              width: '190px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px 18px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              zIndex: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                  ₹
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>GST Invoices</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', color: '#16a34a',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  padding: '2px 6px', borderRadius: '5px', fontWeight: 700,
                }}>Live</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.98rem' }}>4,892</strong> Bills Issued
              </div>
            </div>

            {/* Inventory card — top right */}
            <div style={{
              position: 'absolute', top: '180px', right: '0',
              width: '190px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px 18px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              zIndex: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={14} />
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Stock &amp; Items</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', color: '#2563eb',
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  padding: '2px 6px', borderRadius: '5px', fontWeight: 700,
                }}>Synced</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.98rem' }}>1,240</strong> Active SKUs
              </div>
            </div>

            {/* Customer Ledgers — bottom center */}
            <div style={{
              position: 'absolute', top: '295px', left: '50%',
              transform: 'translateX(-50%)',
              width: '195px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px 18px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              zIndex: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={14} />
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Customer Ledgers</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', color: '#9333ea',
                  background: '#f3e8ff', border: '1px solid #e9d5ff',
                  padding: '2px 6px', borderRadius: '5px', fontWeight: 700,
                }}>Verified</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.98rem' }}>856</strong> Accounts &amp; GSTINs
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── RIGHT — Real Tech & Service Ecosystem ── */}
      <div className="cds-right" style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Dot background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#d4d4d4 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }} />

        {/* 2-col icon grid */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px',
          zIndex: 2,
        }}>
          {INTEGRATIONS.map(({ logo, label }, i) => (
            <div key={i} style={{
              width: '64px', height: '64px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.18s, box-shadow 0.18s',
            }}
              title={label}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              {logo}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}