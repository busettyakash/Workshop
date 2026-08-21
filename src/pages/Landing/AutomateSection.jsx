import React from 'react'
import {
  CircleDollarSign, GitBranch, Send, Plus, Target,
  RefreshCw, Star, Anchor, Sparkles, FileText, Heart,
  Search, Bell, Zap, Users, Mail, TrendingUp, Package, Clock,
  Disc, Layers
} from 'lucide-react'

const pills = [
  { icon: <Zap size={13} />, label: 'Auto-assign hot leads', iconBg: '#fef9c3', iconColor: '#eab308' },
  { icon: <Bell size={13} />, label: 'Notify team on deal close', iconBg: '#dbeafe', iconColor: '#3b82f6' },
  { icon: <Users size={13} />, label: 'Sync contacts from HubSpot', iconBg: '#ede9fe', iconColor: '#8b5cf6' },
  { icon: <Mail size={13} />, label: 'Send welcome email sequence', iconBg: '#ecfdf5', iconColor: '#10b981' },
  { icon: <TrendingUp size={13} />, label: 'Score leads by behaviour', iconBg: '#fee2e2', iconColor: '#ef4444' },
  { icon: <Package size={13} />, label: 'Update inventory on order', iconBg: '#fff7ed', iconColor: '#f97316' },
  { icon: <Clock size={13} />, label: 'Follow up after 3 days', iconBg: '#f0fdf4', iconColor: '#22c55e' },
  { icon: <Search size={13} />, label: 'Identify expansion opportunity', iconBg: '#fdf4ff', iconColor: '#c026d3' },
  { icon: <Heart size={13} />, label: 'Monitor customer health score', iconBg: '#fff1f2', iconColor: '#f43f5e' },
  { icon: <RefreshCw size={13} />, label: 'Re-engage cold accounts', iconBg: '#f0f9ff', iconColor: '#0ea5e9' },
]

// Duplicate for seamless infinite loop
const allPills = [...pills, ...pills]

function PillCard({ icon, label, iconBg, iconColor }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 13px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      width: '100%',
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '7px',
        background: iconBg, color: iconColor, flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{
        fontSize: '0.8rem',
        fontWeight: 500,
        color: '#374151',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function AutomateSection() {
  return (
    <div className="cds-split">

      {/* ── LEFT ── */}
      <div className="cds-left">
        <div className="cds-left-top">
          <h2 className="cds-heading">Automate everything</h2>
          <p className="cds-sub">
            You're in control. Automate even the most complex business
            processes with our powerful, intelligent automation engine.
          </p>
        </div>
        <a href="#" className="cds-link">Explore automations →</a>
      </div>

      {/* ── CENTER: New Quotation Sequential Workflow Diagram ── */}
      <div className="cds-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 15px 35px', overflow: 'hidden' }}>
        <div style={{
          position: 'relative',
          width: '660px',
          minHeight: '700px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
          transform: 'scale(0.92)',
          transformOrigin: 'top center'
        }}>

          {/* ── SVG Curved Cable Overlay for Switch Branching ── */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
              overflow: 'visible'
            }}
          >
            <defs>
              <marker
                id="landing-green-arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 1 2 L 8 5 L 1 8 z" fill="#10b981" />
              </marker>
              <marker
                id="landing-gray-arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 1 2 L 8 5 L 1 8 z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Cable: Short vertical line between Trigger (y: 64) and Switch (y: 108) */}
            <path
              d="M 330 64 L 330 108"
              stroke="#10b981"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />

            {/* Cable (Accepted Branch): Smooth S-curve passing through Accepted badge (x: 239, y: 214) to Step 1 Top Center (x: 148, y: 256) */}
            <path
              d="M 330 172 C 330 214, 148 214, 148 256"
              stroke="#10b981"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#landing-green-arrow)"
            />

            {/* Cable (Right Branch): Smooth S-curve passing through Declined badge (x: 421, y: 214) to Log Record Top Center (x: 512, y: 256) */}
            <path
              d="M 330 172 C 330 214, 512 214, 512 256"
              stroke="#94a3b8"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#landing-gray-arrow)"
            />

            {/* Split Connector Circle directly at Switch bottom center (x: 330, y: 172) */}
            <circle cx="330" cy="172" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" />
          </svg>

          {/* ── Absolute Pill Badges Centered Exactly on Branch Curve Wires ── */}
          <div
            style={{
              position: 'absolute',
              left: 239,
              top: 214,
              transform: 'translate(-50%, -50%)',
              zIndex: 4,
              pointerEvents: 'none',
              background: '#ffffff',
              border: '1.5px solid #10b981',
              borderRadius: 12,
              padding: '2px 9px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#059669',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap'
            }}
          >
            Accepted
          </div>

          <div
            style={{
              position: 'absolute',
              left: 421,
              top: 214,
              transform: 'translate(-50%, -50%)',
              zIndex: 4,
              pointerEvents: 'none',
              background: '#ffffff',
              border: '1.5px solid #94a3b8',
              borderRadius: 12,
              padding: '2px 9px',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: '#475569',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap'
            }}
          >
            Declined / Draft
          </div>

          {/* ── ROW 1: TRIGGER NODE (Centered) ── */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', zIndex: 2, position: 'relative' }}>
            <div
              style={{
                width: 260,
                background: '#ffffff',
                border: '1.5px solid #2563eb',
                borderRadius: 12,
                padding: '10px 14px',
                position: 'relative',
                boxShadow: '0 0 0 3px rgba(37,99,235,0.10), 0 4px 14px rgba(0,0,0,0.04)',
                cursor: 'default'
              }}
            >
              {/* Top Left Badge: Trigger */}
              <div style={{
                position: 'absolute', top: -10, left: 14,
                background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: 10, padding: '1px 7px', fontSize: '0.66rem',
                fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <Disc size={10} color="#64748b" /> Trigger
              </div>

              {/* Node Inner Content */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 2 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.95rem', flexShrink: 0
                }}>
                  $
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                      When Quote updated
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 4 }}>
                      Quotes
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                    Trigger when Quote status updates
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: SWITCH / CONDITION NODE (Centered) ── */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 44, zIndex: 2, position: 'relative' }}>
            <div
              style={{
                width: 260,
                background: '#ffffff',
                border: '1.5px solid #10b981',
                borderRadius: 12,
                padding: '10px 14px',
                position: 'relative',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                cursor: 'default'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <GitBranch size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                      Switch
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 4 }}>
                      Condition
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                    Route if Quote is Accepted or Draft
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 3: BRANCH CONTENT (Left = 3 Connected Steps, Right = Log Record) ── */}
          <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', padding: '0 25px', marginTop: 84, zIndex: 2, position: 'relative' }}>
            
            {/* ── LEFT COLUMN: 3 SEQUENTIAL STEPS WITH SOLID CONTIGUOUS WIRING ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 246 }}>
              
              {/* STEP 1: Inventory Stock Deduction */}
              <div
                style={{
                  width: 246,
                  background: '#ffffff',
                  border: '1.5px solid #10b981',
                  borderRadius: 12,
                  padding: '10px 12px',
                  position: 'relative',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Layers size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#0f172a' }}>
                        1. Inventory Deduction
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', padding: '1px 4px', borderRadius: 4 }}>
                        Inventory
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                      Decreases stock & records stock history log
                    </div>
                  </div>
                </div>
              </div>

              {/* In-Flow Wire from Step 1 to Step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 24, width: 20, justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: 2.2, height: 18, background: '#10b981' }} />
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '5px solid #10b981',
                  marginTop: -1
                }} />
              </div>

              {/* STEP 2: Auto-generate Official Bill */}
              <div
                style={{
                  width: 246,
                  background: '#ffffff',
                  border: '1.5px solid #10b981',
                  borderRadius: 12,
                  padding: '10px 12px',
                  position: 'relative',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#0f172a' }}>
                        2. Auto-generate Bill
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: '#eff6ff', color: '#2563eb', padding: '1px 4px', borderRadius: 4 }}>
                        Billing
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                      Generates Tax Invoice #INV-... & Order in Unpaid Bills
                    </div>
                  </div>
                </div>
              </div>

              {/* In-Flow Wire from Step 2 to Step 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 24, width: 20, justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: 2.2, height: 18, background: '#10b981' }} />
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '5px solid #10b981',
                  marginTop: -1
                }} />
              </div>

              {/* STEP 3: Send Tax Invoice PDF Email */}
              <div
                style={{
                  width: 246,
                  background: '#ffffff',
                  border: '1.5px solid #10b981',
                  borderRadius: 12,
                  padding: '10px 12px',
                  position: 'relative',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Send size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#0f172a' }}>
                        3. Send Invoice Email
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: '#fdf4ff', color: '#c026d3', padding: '1px 4px', borderRadius: 4 }}>
                        Email
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                      Emails official PDF invoice & barcode guidelines
                    </div>
                  </div>
                </div>
              </div>

              {/* Wire to Plus Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 20, width: 20, justifyContent: 'center' }}>
                <div style={{ width: 2, height: '100%', background: '#cbd5e1' }} />
              </div>

              {/* Plus Button Underneath Step 3 */}
              <div style={{ zIndex: 3 }}>
                <div
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#3b82f6', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(59,130,246,0.35)'
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: LOG QUOTATION RECORD (DECLINED / DRAFT) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 246 }}>
              <div
                style={{
                  width: 246,
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '10px 12px',
                  position: 'relative',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#1e293b' }}>
                        Log Quote Record
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 4px', borderRadius: 4 }}>
                        Records
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                      Update quote status in database (no bill issued)
                    </div>
                  </div>
                </div>
              </div>

              {/* Wire from Log Record to Port */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 20, width: 20, justifyContent: 'center' }}>
                <div style={{ width: 2, height: '100%', background: '#cbd5e1' }} />
              </div>

              {/* Terminal Port Underneath */}
              <div style={{ zIndex: 3 }}>
                <div
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#ffffff', border: '1.5px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd5e1' }} />
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ── RIGHT — all-white pills, infinite scroll ── */}
      <div className="cds-right" style={{ overflow: 'hidden', position: 'relative' }}>

        {/* Top & bottom fade */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, #fdfdfd 0%, transparent 18%, transparent 82%, #fdfdfd 100%)',
        }} />

        <style>{`
          @keyframes pillScroll {
            0%   { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
        `}</style>

        <div style={{ position: 'absolute', inset: 0, padding: '0 14px', overflow: 'hidden' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            paddingTop: '24px',
            animation: 'pillScroll 18s linear infinite',
          }}>
            {allPills.map(({ icon, label, iconBg, iconColor }, i) => (
              <PillCard key={i} icon={icon} label={label} iconBg={iconBg} iconColor={iconColor} />
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}