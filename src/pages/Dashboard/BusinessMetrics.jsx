import React, { useState, useEffect } from 'react'
import { Package, Tag, Filter, ChevronDown, RefreshCw, PlusSquare } from 'lucide-react'
import api from '../../api/client'
import './Dashboard.css'

const BAR_SERIES = [
  { key: 'electronics', label: 'Electronics', color: '#f43f5e' },
  { key: 'apparel',     label: 'Apparel',     color: '#38bdf8' },
  { key: 'grocery',     label: 'Grocery',     color: '#10b981' },
  { key: 'appliances',  label: 'Appliances',  color: '#a78bfa' },
  { key: 'others',      label: 'Others',      color: '#fb923c' },
]

function buildDonutPaths(segments, cx, cy, r, gap = 2) {
  if (!segments || segments.length === 0) return []
  const paths = []
  let startAngle = -90
  const total = segments.reduce((s, seg) => s + seg.pct, 0)
  if (total === 0) return []
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

const DAY_OPTIONS      = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months', 'This year']

export default function BusinessMetrics() {
  const [hoveredBar, setHoveredBar]         = useState(null)
  const [dayFilter, setDayFilter]           = useState('Last 30 days')
  const [customerFilter, setCustomerFilter] = useState('All Customers')
  const [showDayDrop, setShowDayDrop]       = useState(false)
  const [showCustDrop, setShowCustDrop]     = useState(false)
  const [people, setPeople]                 = useState([])

  // Real-time backend states
  const [barData, setBarData] = useState([])
  const [donutSegments, setDonutSegments] = useState([])
  const [tooltipData, setTooltipData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let active = true
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        const res = await api.get('/reports/business-metrics', {
          params: { dayFilter, customerFilter }
        })
        if (active) {
          setBarData(res.data.barData || [])
          setDonutSegments(res.data.donutData || [])
          setTooltipData(res.data.tooltipData || [])
          setError(null)
        }
      } catch (err) {
        console.error('Error loading business metrics:', err)
        if (active) {
          setError(err.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchMetrics()
    return () => { active = false }
  }, [dayFilter, customerFilter, refreshTrigger])

  useEffect(() => {
    let active = true
    const fetchPeople = async () => {
      try {
        const res = await api.get('/people')
        if (active && res.data && res.data.data) {
          setPeople(res.data.data)
        }
      } catch (err) {
        console.error('Error loading people for metrics:', err)
      }
    }
    fetchPeople()
    return () => { active = false }
  }, [refreshTrigger])

  const customerOptions = ['All Customers', ...Array.from(new Set(people.map(p => p.name)))]

  const donutPaths = buildDonutPaths(donutSegments, 90, 90, 75)
  const donutInner = buildDonutPaths(donutSegments, 90, 90, 50)
  const MAX_H = 120

  const closeDrops = () => { setShowDayDrop(false); setShowCustDrop(false) }

  if (loading && barData.length === 0) {
    return (
      <div className="ws-bm-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 20px' }}>
        <div style={{ color: '#3b82f6', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw className="ws-bm-spinner" size={16} /> Loading real-time records...
        </div>
      </div>
    )
  }

  return (
    <div className="ws-bm-section" onClick={closeDrops} style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>

      {/* ── Header ── */}
      <div className="ws-bm-header">
        <div className="ws-bm-header-left">
          <h2 className="ws-bm-title">Business Metrics</h2>
          <p className="ws-bm-sub">Overview of sales pipeline, revenue growth, product performance, and more.</p>
        </div>
        <div className="ws-bm-header-right" onClick={e => e.stopPropagation()}>
          {/* Filters */}
          <Filter size={13} style={{ color: '#9ca3af' }} />

          <div className="ws-bm-filter-wrap">
            <button
              className="ws-bm-filter-btn"
              onClick={() => { setShowDayDrop(v => !v); setShowCustDrop(false) }}
            >
              {dayFilter} <ChevronDown size={11} />
            </button>
            {showDayDrop && (
              <div className="ws-bm-dropdown">
                {DAY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`ws-bm-dropdown-item ${dayFilter === opt ? 'active' : ''}`}
                    onClick={() => { setDayFilter(opt); setShowDayDrop(false) }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ws-bm-filter-wrap">
            <button
              className="ws-bm-filter-btn"
              onClick={() => { setShowCustDrop(v => !v); setShowDayDrop(false) }}
            >
              {customerFilter} <ChevronDown size={11} />
            </button>
            {showCustDrop && (
              <div className="ws-bm-dropdown">
                {customerOptions.map(opt => (
                  <button
                    key={opt}
                    className={`ws-bm-dropdown-item ${customerFilter === opt ? 'active' : ''}`}
                    onClick={() => { setCustomerFilter(opt); setShowCustDrop(false) }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons — only in dashboard */}
          <div className="ws-bm-actions">
            <button className="ws-bm-btn-refresh" onClick={() => setRefreshTrigger(prev => prev + 1)} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'ws-bm-spinner' : ''} /> Refresh data
            </button>
            <button className="ws-bm-btn-add">
              <PlusSquare size={13} /> Add report
            </button>
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="ws-bm-charts-row">

        {/* Left: Bar chart */}
        <div className="ws-bm-card">
          <div className="ws-bm-card-header">
            <div className="ws-bm-card-title-row">
              <span className="ws-bm-card-title">Revenue growth by category</span>
              <span className="ws-bm-entity-badge ws-bm-entity-badge--ws">
                <Package size={11} /> Products
              </span>
            </div>
            <div className="ws-bm-legend">
              {BAR_SERIES.map(s => (
                <div key={s.key} className="ws-bm-legend-item">
                  <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="ws-bm-bar-area">
            <div className="ws-bm-yaxis">
              {['₹2.8L', '₹2.4L', '₹2.0L', '₹1.6L', '₹1.2L', '₹0.8L', '₹0.4L'].map(l => (
                <span key={l} className="ws-bm-yaxis-label">{l}</span>
              ))}
            </div>

            <div className="ws-bm-bar-chart">
              <div className="ws-bm-gridlines">
                {[0,1,2,3,4,5,6].map(i => <div key={i} className="ws-bm-gridline" />)}
              </div>

              <div className="ws-bm-bar-groups">
                {barData.map((grp, gi) => {
                  const tip = tooltipData[gi]
                  return (
                    <div
                      key={grp.label}
                      className="ws-bm-bar-group"
                      onMouseEnter={() => setHoveredBar(gi)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {BAR_SERIES.map(s => (
                        <div
                          key={s.key}
                          className="ws-bm-bar"
                          style={{
                            height: `${(grp[s.key] / MAX_H) * 100}%`,
                            background: s.color,
                            opacity: hoveredBar === gi ? 1 : 0.82,
                          }}
                        />
                      ))}

                      {hoveredBar === gi && tip && (
                        <div className="ws-bm-tooltip">
                          <div className="ws-bm-tooltip-title">
                            Revenue Contribution
                            <span className="ws-bm-tooltip-badge">↗ {tip.change}</span>
                          </div>
                          <div className="ws-bm-tooltip-block">
                            <div className="ws-bm-tooltip-month">{tip.month}</div>
                            <div className="ws-bm-tooltip-row">
                              <span className="ws-bm-tooltip-lbl">Product</span>
                              <span className="ws-bm-tooltip-val">{tip.product}</span>
                            </div>
                            <div className="ws-bm-tooltip-row">
                              <span className="ws-bm-tooltip-lbl">Revenue (INR)</span>
                              <span className="ws-bm-tooltip-val ws-bm-tooltip-inr">{tip.inr}</span>
                            </div>
                            <div className="ws-bm-tooltip-row">
                              <span className="ws-bm-tooltip-lbl">Revenue (USD)</span>
                              <span className="ws-bm-tooltip-val">{tip.usd}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="ws-bm-xaxis">
                {barData.map(g => (
                  <span key={g.label} className="ws-bm-xaxis-label">{g.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Donut */}
        <div className="ws-bm-card">
          <div className="ws-bm-card-header">
            <div className="ws-bm-card-title-row">
              <span className="ws-bm-card-title">Closed deals by product category</span>
              <span className="ws-bm-entity-badge ws-bm-entity-badge--deal">
                <Tag size={11} /> Deals
              </span>
            </div>
            <div className="ws-bm-legend">
              {donutSegments.map(s => (
                <div key={s.label} className="ws-bm-legend-item">
                  <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="ws-bm-donut-wrap">
            <svg viewBox="0 0 180 180" className="ws-bm-donut-svg">
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
  )
}
