import React from 'react'
import { Link } from 'react-router'
import './Landing.css'
import {
  FileText,
  Receipt,
  Sparkles,
  CheckCircle2,
  Send
} from 'lucide-react'

/**
 * "Build fast" section — showcases Workshop's real GST billing,
 * quotation dispatch, and live inventory sync operations.
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
            <Link to="/signup" className="ws-outline-btn">Start for free</Link>
          </div>
        </div>

        {/* ── Customer & Billing Operations Card ── */}
        <div className="ws-build-profile">
          {/* Left — Business / Customer Info */}
          <div className="ws-build-contact">
            <div className="ws-build-contact-top">
              <div className="ws-build-avatar" style={{ background: '#2563eb', color: '#ffffff' }}>SV</div>
              <div>
                <div className="ws-build-name">Sri Venkateswara Traders</div>
                <div className="ws-build-role">Wholesale &amp; Retail Partner · GST Registered</div>
              </div>
            </div>

            <Link to="/billing/new" className="ws-build-compose" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} style={{ marginRight: 6 }} /> Create GST Invoice
            </Link>

            <div className="ws-build-details">
              <div className="ws-build-detail-label">▾ Customer Details</div>
              <div className="ws-build-detail-row">
                <span>Contact Person</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Rajesh Kumar</span>
              </div>
              <div className="ws-build-detail-row">
                <span>GSTIN</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#1e40af' }}>36AAACR1234F1Z5</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Phone</span>
                <span style={{ color: 'var(--color-text-primary)' }}>+91 98490 12345</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Location</span>
                <span>Hyderabad, Telangana</span>
              </div>
              <div className="ws-build-detail-row">
                <span>Account Status</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#059669' }}>
                  <CheckCircle2 size={13} /> Verified GSTIN
                </span>
              </div>
              <div className="ws-build-detail-row">
                <span>Ledger Balance</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>₹0 (All Invoices Paid)</span>
              </div>
            </div>
          </div>

          {/* Right — Highlights & Live Operations */}
          <div className="ws-build-highlights">
            <div className="ws-build-highlights-header">
              Operations Overview
            </div>

            <div className="ws-build-highlight-card" style={{ marginBottom: 10 }}>
              <div className="ws-build-highlight-card-label">
                Summary
              </div>
              <p className="ws-build-highlight-card-body" style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                Active wholesale buyer with 24 GST Tax Invoices. Quotation <strong>QT-8204</strong> for 100 Bags (Sona Masoori Rice &amp; Wheat) was emailed with a secure HMAC token, confirmed by the customer, and converted to <strong>INV-10482</strong> with automatic inventory deduction.
              </p>
            </div>

            <div className="ws-build-highlight-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Latest GST Invoice</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                  INV-10482
                  <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>PAID</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2, fontWeight: 500 }}>
                  ₹54,200 · CGST (9%) + SGST (9%)
                </div>
              </div>

              <div className="ws-build-highlight-card">
                <div className="ws-build-highlight-card-label">Quote &amp; Inventory Sync</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                  <strong>QT-8204</strong> Accepted &amp; Deducted
                </div>
                <div className="ws-build-progress-bar" style={{ marginTop: 6 }}>
                  <div className="ws-build-progress-fill" style={{ width: '100%', background: '#059669' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 3, fontWeight: 600 }}>
                  100 Bags Auto-Deducted from Stock
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
