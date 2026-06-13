import React, { useState } from 'react'
import { Package, Tag } from 'lucide-react'
import './Landing.css'

/* ── Bar chart data: Products / Deals / Revenue per month ── */
const BAR_DATA = [
  { label: 'July',      products: 62, deals: 45, revenue: 88 },
  { label: 'August',    products: 78, deals: 92, revenue: 110 },
  { label: 'September', products: 50, deals: 38, revenue: 70 },
]

const BAR_SERIES = [
  { key: 'products', label: 'Products',  color: '#3b82f6' },
  { key: 'deals',    label: 'Deals',     color: '#f43f5e' },
  { key: 'revenue',  label: 'Revenue',   color: '#10b981' },
]

/* ── Donut: Products breakdown ── */
const DONUT_SEGMENTS = [
  { label: 'Electronics',  pct: 32, color: '#f43f5e' },
  { label: 'Apparel',      pct: 22, color: '#38bdf8' },
  { label: 'Grocery',      pct: 18, color: '#10b981' },
  { label: 'Appliances',   pct: 16, color: '#a78bfa' },
  { label: 'Others',       pct: 12, color: '#fb923c' },
]

function buildDonutPaths(segments, cx, cy, r, gap = 2) {
  const paths = []
  let startAngle = -90
  const total = segments.reduce((s, seg) => s + seg.pct, 0)
  segments.forEach((seg) => {
    const angleDeg = (seg.pct / total) * 360 - gap
    const endAngle = startAngle + angleDeg
    const toRad = (d) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(endAngle))
    const y2 = cy + r * Math.sin(toRad(endAngle))
    const largeArc = angleDeg > 180 ? 1 : 0
    paths.push({
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: seg.color,
      label: seg.label,
    })
    startAngle = endAngle + gap
  })
  return paths
}

/* ── Per-group tooltip data (INR + USD) ── */
const TOOLTIP_DATA = [
  {
    month: 'Aug 2024',
    product: 'Electronics',
    inr: '₹1,87,450',
    usd: 'USD 2,249.40',
    change: '+63%',
  },
  {
    month: 'May 2024',
    product: 'Apparel',
    inr: '₹1,15,800',
    usd: 'USD 1,389.60',
    change: '+28%',
  },
  {
    month: 'Jul 2024',
    product: 'Grocery',
    inr: '₹76,200',
    usd: 'USD 914.40',
    change: '+11%',
  },
]

export default function ReportingSection() {
  const [hoveredBar, setHoveredBar] = useState(null)

  const donutPaths  = buildDonutPaths(DONUT_SEGMENTS, 90, 90, 75)
  const donutInner  = buildDonutPaths(DONUT_SEGMENTS, 90, 90, 50)
  const MAX_H = 120

  return (
    <section className="ws-section ws-section--white ws-rpt-section">
      <div className="ws-section-inner">

        {/* ── Section header ── */}
        <div className="ws-rpt-top-header">
          <div>
            <h2 className="ws-rpt-main-title">Business Metrics</h2>
            <p className="ws-rpt-main-sub">
              Overview of our sales pipeline, revenue growth, product performance, and more.
            </p>
          </div>
        </div>

        {/* ── Two charts side by side ── */}
        <div className="ws-rpt-charts-row">

          {/* ── Left: Bar chart ── */}
          <div className="ws-rpt-card">
            <div className="ws-rpt-card-header">
              <div className="ws-rpt-card-title-row">
                <span className="ws-rpt-card-title">Revenue growth by category</span>
                <span className="ws-rpt-entity-badge ws-rpt-entity-badge--ws">
                  <Package size={11} /> Products
                </span>
              </div>

              {/* Legend */}
              <div className="ws-rpt-legend">
                {BAR_SERIES.map(s => (
                  <div key={s.key} className="ws-rpt-legend-item">
                    <span className="ws-rpt-legend-dot" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Chart area */}
            <div className="ws-rpt-bar-area">
              {/* Y-axis */}
              <div className="ws-rpt-yaxis">
                {['₹2.8L', '₹2.4L', '₹2.0L', '₹1.6L', '₹1.2L', '₹0.8L', '₹0.4L'].map(l => (
                  <span key={l} className="ws-rpt-yaxis-label">{l}</span>
                ))}
              </div>

              <div className="ws-rpt-bar-chart">
                <div className="ws-rpt-gridlines">
                  {[0,1,2,3,4,5,6].map(i => <div key={i} className="ws-rpt-gridline" />)}
                </div>

                <div className="ws-rpt-bar-groups">
                  {BAR_DATA.map((grp, gi) => {
                    const tip = TOOLTIP_DATA[gi]
                    return (
                      <div
                        key={grp.label}
                        className="ws-rpt-bar-group"
                        onMouseEnter={() => setHoveredBar(gi)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {BAR_SERIES.map(s => (
                          <div
                            key={s.key}
                            className="ws-rpt-bar"
                            style={{
                              height: `${(grp[s.key] / MAX_H) * 100}%`,
                              background: s.color,
                              opacity: hoveredBar === gi ? 1 : 0.82,
                            }}
                          />
                        ))}

                        {/* Bilingual Tooltip */}
                        {hoveredBar === gi && tip && (
                          <div className="ws-rpt-tooltip">
                            <div className="ws-rpt-tooltip-title">
                              Revenue Contribution
                              <span className="ws-rpt-tooltip-badge">↗ {tip.change}</span>
                            </div>
                            <div className="ws-rpt-tooltip-block">
                              <div className="ws-rpt-tooltip-month">{tip.month}</div>
                              <div className="ws-rpt-tooltip-row">
                                <span className="ws-rpt-tooltip-lbl">Product</span>
                                <span className="ws-rpt-tooltip-val">{tip.product}</span>
                              </div>
                              <div className="ws-rpt-tooltip-row">
                                <span className="ws-rpt-tooltip-lbl">Revenue (INR)</span>
                                <span className="ws-rpt-tooltip-val ws-rpt-tooltip-inr">{tip.inr}</span>
                              </div>
                              <div className="ws-rpt-tooltip-row">
                                <span className="ws-rpt-tooltip-lbl">Revenue (USD)</span>
                                <span className="ws-rpt-tooltip-val">{tip.usd}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* X-axis */}
                <div className="ws-rpt-xaxis">
                  {BAR_DATA.map(g => (
                    <span key={g.label} className="ws-rpt-xaxis-label">{g.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Donut — Products ── */}
          <div className="ws-rpt-card">
            <div className="ws-rpt-card-header">
              <div className="ws-rpt-card-title-row">
                <span className="ws-rpt-card-title">Closed deals by product category</span>
                <span className="ws-rpt-entity-badge ws-rpt-entity-badge--deal">
                  <Tag size={11} /> Deals
                </span>
              </div>

              {/* Legend */}
              <div className="ws-rpt-legend">
                {DONUT_SEGMENTS.map(s => (
                  <div key={s.label} className="ws-rpt-legend-item">
                    <span className="ws-rpt-legend-dot" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="ws-rpt-donut-wrap">
              <svg viewBox="0 0 180 180" className="ws-rpt-donut-svg">
                {donutPaths.map((p, i) => (
                  <path key={i} d={p.d} fill={p.color} opacity="0.9" />
                ))}
                {donutInner.map((p, i) => (
                  <path key={`inner-${i}`} d={p.d} fill={p.color} opacity="0.35" />
                ))}
                <circle cx="90" cy="90" r="38" fill="white" />
              </svg>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
