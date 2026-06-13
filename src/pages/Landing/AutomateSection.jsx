import React from 'react'
import {
  CircleDollarSign, GitBranch, Send, Plus, Target,
  RefreshCw, Star, Anchor, Sparkles, FileText, Heart,
  Search, Bell, Zap, Users, Mail, TrendingUp, Package, Clock
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

      {/* ── CENTER ── */}
      <div className="cds-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '500px', height: '520px', position: 'relative' }}>

          <svg viewBox="0 0 500 540" xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            <circle cx="155" cy="130" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 155 134 C 155 158, 295 158, 295 175" stroke="#10b981" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 291 171 L 295 175 L 299 171" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />
            <circle cx="295" cy="270" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 295 274 C 295 308, 105 308, 105 340" stroke="#10b981" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 101 336 L 105 340 L 109 336" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />
            <path d="M 295 274 C 295 308, 400 308, 400 340" stroke="#d1d5db" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 396 336 L 400 340 L 404 336" stroke="#d1d5db" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />
            <circle cx="105" cy="445" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 105 449 L 105 480" stroke="#d1d5db" strokeWidth="1.5" pathLength="1" className="ws-svg-draw" />
            <circle cx="400" cy="445" r="4" fill="#fff" stroke="#d1d5db" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 400 449 L 400 480" stroke="#d1d5db" strokeWidth="1.5" pathLength="1" className="ws-svg-draw" />
          </svg>

          {[
            { label: 'Upsell', left: '200px', color: '#10b981', border: '#10b981' },
            { label: 'Nurture', left: '350px', color: '#9ca3af', border: '#e5e7eb' },
          ].map(({ label, left, color, border }) => (
            <div key={label} style={{
              top: '308px', left, position: 'absolute',
              transform: 'translate(-50%, -50%)', zIndex: 2,
              background: '#fff', padding: '2px 10px', borderRadius: '12px',
              fontSize: '0.65rem', fontWeight: 600, color, border: `1px solid ${border}`,
            }}>{label}</div>
          ))}

          {/* Trigger Node */}
          <div className="ws-node-fade-in" style={{ top: '20px', left: '50px', width: '210px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node ws-automate-node--trigger">
              {/* Top bar: label + green line + status */}
              <div className="ws-automate-topbar ws-automate-topbar--green">
                <span className="ws-automate-toplabel">
                  <Target size={11} strokeWidth={2.5} />
                  Trigger
                </span>
                <span className="ws-automate-topstatus ws-automate-topstatus--green">✓ Triggered</span>
              </div>
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue"><CircleDollarSign size={14} strokeWidth={2.5} /></div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">When Deal updated <span className="ws-automate-node-badge">Deals</span></div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Trigger when a Deal's status is updated</div>
            </div>
          </div>

          {/* Switch Node */}
          <div className="ws-node-fade-in ws-delay-1" style={{ top: '175px', left: '190px', width: '210px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node ws-automate-node--switch">
              {/* Status only, right-aligned */}
              <div className="ws-automate-topbar ws-automate-topbar--green ws-automate-topbar--right">
                <span className="ws-automate-topstatus ws-automate-topstatus--green">✓ Completed</span>
              </div>
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue"><GitBranch size={14} strokeWidth={2.5} /></div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">Switch <span className="ws-automate-node-badge">Condition</span></div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Route to upsell or nurture</div>
            </div>
          </div>

          {/* Upsell Node */}
          <div className="ws-node-fade-in ws-delay-2" style={{ top: '340px', left: '0px', width: '210px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node ws-automate-node--trigger">
              {/* Status only, left-aligned */}
              <div className="ws-automate-topbar ws-automate-topbar--green ws-automate-topbar--left">
                <span className="ws-automate-topstatus ws-automate-topstatus--green">✓ Completed</span>
              </div>
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue"><Send size={14} strokeWidth={2.5} /></div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">Enroll in sequence <span className="ws-automate-node-badge">Sequences</span></div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Enroll person in "Power user upsell"</div>
            </div>
          </div>

          {/* Nurture Node (faded) */}
          <div className="ws-automate-node--faded ws-node-fade-in ws-delay-2" style={{ top: '340px', left: '300px', width: '200px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node">
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-gray"><Send size={14} strokeWidth={2.5} /></div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">Enroll in sequence <span className="ws-automate-node-badge">Sequences</span></div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Enroll person in "Nurture"</div>
            </div>
          </div>

          {/* Plus — left */}
          <div className="ws-abs-plus ws-node-fade-in ws-delay-3" style={{ top: '480px', left: '93px', position: 'absolute', zIndex: 3, background: '#3b82f6', color: '#fff', border: 'none' }}>
            <Plus size={14} strokeWidth={3} />
          </div>

          {/* Circle — right faded */}
          <div className="ws-abs-plus ws-automate-plus-btn--faded ws-node-fade-in ws-delay-3" style={{ top: '480px', left: '388px', position: 'absolute', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', border: '2px solid var(--color-gray-300)', borderRadius: '50%' }} />
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