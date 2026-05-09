import React from 'react'
import { CircleDollarSign, GitBranch, Send, Plus, Target, RefreshCw, Star, Anchor, Sparkles, FileText, Heart, Search } from 'lucide-react'

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
        {/* Flow diagram */}
        <div className="ws-automate-canvas" style={{ width: '500px', height: '520px', position: 'relative' }}>

          {/* SVG connector lines */}
          <svg className="ws-automate-svg" viewBox="0 0 500 520" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>

            {/* Trigger → Switch */}
            <circle cx="150" cy="110" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 150 114 L 150 125 Q 150 135 160 135 L 280 135 Q 290 135 290 145 L 290 156" stroke="#10b981" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 286 152 L 290 156 L 294 152" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />

            {/* Switch → Branches split */}
            <circle cx="290" cy="250" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />

            {/* Common trunk going down from Switch */}
            <path d="M 290 254 L 290 270" stroke="#10b981" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />

            {/* Left Branch (Upsell) */}
            <path d="M 290 270 Q 290 285 275 285 L 115 285 Q 100 285 100 300 L 100 316" stroke="#10b981" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 96 312 L 100 316 L 104 312" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />

            {/* Right Branch (Nurture) */}
            <path d="M 290 270 Q 290 285 305 285 L 385 285 Q 400 285 400 300 L 400 316" stroke="#d1d5db" strokeWidth="1.5" fill="none" pathLength="1" className="ws-svg-draw" />
            <path d="M 396 312 L 400 316 L 404 312" stroke="#d1d5db" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ws-svg-fade" />

            {/* Left node → Plus */}
            <circle cx="100" cy="420" r="4" fill="#fff" stroke="#10b981" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 100 424 L 100 460" stroke="#d1d5db" strokeWidth="1.5" pathLength="1" className="ws-svg-draw" />

            {/* Right node → Circle */}
            <circle cx="400" cy="420" r="4" fill="#fff" stroke="#d1d5db" strokeWidth="1.5" className="ws-svg-fade" />
            <path d="M 400 424 L 400 460" stroke="#d1d5db" strokeWidth="1.5" pathLength="1" className="ws-svg-draw" />
          </svg>

          {/* Branch labels */}
          <div className="ws-path-label ws-svg-fade" style={{ top: '285px', left: '195px', color: '#10b981', border: '1px solid #10b981', position: 'absolute', transform: 'translate(-50%, -50%)', zIndex: 2, background: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 600 }}>Upsell</div>
          <div className="ws-path-label ws-svg-fade" style={{ top: '285px', left: '345px', color: '#9ca3af', border: '1px solid #e5e7eb', position: 'absolute', transform: 'translate(-50%, -50%)', zIndex: 2, background: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 600 }}>Nurture</div>

          {/* Trigger Node */}
          <div className="ws-abs-node ws-node-fade-in" style={{ top: '0px', left: '50px', width: '200px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node ws-automate-node--trigger">
              <div className="ws-automate-floating-label" style={{ left: '12px' }}>
                <Target size={12} strokeWidth={2.5} style={{ color: '#9ca3af' }} />
                <span>Trigger</span>
              </div>
              <div className="ws-automate-node-status ws-automate-status-green ws-abs-status" style={{ right: '12px', top: '-10px' }}>✓ Triggered</div>
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue">
                  <CircleDollarSign size={14} strokeWidth={2.5} />
                </div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">
                    When Deal updated <span className="ws-automate-node-badge">Deals</span>
                  </div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Trigger when a Deal's status is updated</div>
            </div>
          </div>

          {/* Switch Node */}
          <div className="ws-abs-node ws-node-fade-in ws-delay-1" style={{ top: '160px', left: '190px', width: '200px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node-status ws-automate-status-green ws-abs-status" style={{ right: '12px', top: '-10px' }}>✓ Completed</div>
            <div className="ws-automate-node ws-automate-node--switch">
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue">
                  <GitBranch size={14} strokeWidth={2.5} />
                </div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">
                    Switch <span className="ws-automate-node-badge">Condition</span>
                  </div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Route to upsell or nurture</div>
            </div>
          </div>

          {/* Left Bottom Node — Upsell */}
          <div className="ws-abs-node ws-node-fade-in ws-delay-2" style={{ top: '320px', left: '0px', width: '200px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node-status ws-automate-status-green ws-abs-status" style={{ left: '12px', top: '-10px' }}>✓ Completed</div>
            <div className="ws-automate-node ws-automate-node--trigger">
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-blue">
                  <Send size={14} strokeWidth={2.5} />
                </div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">
                    Enroll in sequence <span className="ws-automate-node-badge">Sequences</span>
                  </div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Enroll person in "Power user upsell"</div>
            </div>
          </div>

          {/* Right Bottom Node — Nurture (faded) */}
          <div className="ws-abs-node ws-automate-node--faded ws-node-fade-in ws-delay-2" style={{ top: '320px', left: '300px', width: '200px', position: 'absolute', zIndex: 3 }}>
            <div className="ws-automate-node">
              <div className="ws-automate-node-main">
                <div className="ws-automate-icon-box ws-automate-icon-gray">
                  <Send size={14} strokeWidth={2.5} />
                </div>
                <div className="ws-automate-node-info">
                  <div className="ws-automate-node-name">
                    Enroll in sequence <span className="ws-automate-node-badge">Sequences</span>
                  </div>
                </div>
              </div>
              <div className="ws-automate-node-sub">Enroll person in "Nurture"</div>
            </div>
          </div>

          {/* Plus button — left */}
          <div className="ws-abs-plus ws-node-fade-in ws-delay-3" style={{ top: '460px', left: '88px', position: 'absolute', zIndex: 3, background: '#3b82f6', color: '#fff', border: 'none' }}>
            <Plus size={14} strokeWidth={3} />
          </div>

          {/* Circle button — right (faded) */}
          <div className="ws-abs-plus ws-automate-plus-btn--faded ws-node-fade-in ws-delay-3" style={{ top: '460px', left: '388px', position: 'absolute', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', border: '2px solid var(--color-gray-300)', borderRadius: '50%' }}></div>
          </div>

        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="cds-right" style={{ overflow: 'hidden', position: 'relative' }}>
        <div className="ws-automate-right-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: '40px' }}>
          <div className="ws-automate-pill-stack ws-animate-scroll">

            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.35 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-red"><RefreshCw size={12} /></div>
              Re-engage cold leads
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.6 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-yellow"><Star size={12} /></div>
              MQL lead routing
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.85 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-blue"><Anchor size={12} /></div>
              Onboarding hand-off
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.85 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-green"><Sparkles size={12} color="#10b981" /></div>
              New Deal email campaign
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.85 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-purple"><FileText size={12} /></div>
              Lead form submissions
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.6 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-red"><Heart size={12} /></div>
              Monitor customer health
            </div>
            <div className="ws-automate-pill ws-automate-pill--faded" style={{ opacity: 0.4 }}>
              <div className="ws-automate-pill-icon-box ws-pill-icon-green-light"><Search size={12} /></div>
              Identify expansion opportunity
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}