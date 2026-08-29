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

function formatYAxisLabel(val) {
  if (val <= 0) return '₹0'
  if (val >= 100000) {
    const inLakhs = val / 100000
    if (Number.isInteger(inLakhs)) {
      return `₹${inLakhs}L`
    }
    return `₹${parseFloat(inLakhs.toFixed(1))}L`
  }
  if (val >= 1000) {
    return `₹${Math.round(val / 1000)}k`
  }
  return `₹${Math.round(val)}`
}

function getScaleTicks(maxVal) {
  if (maxVal <= 50000) {
    return [0, 10000, 20000, 30000, 40000, 50000]
  }
  if (maxVal <= 100000) {
    return [0, 10000, 40000, 60000, 80000, 100000]
  }
  if (maxVal <= 250000) {
    return [0, 10000, 40000, 80000, 100000, 150000, 200000, 250000]
  }
  const topCeil = Math.max(Math.ceil(maxVal / 100000) * 100000, 500000)
  const midTop = Math.round((topCeil * 0.5) / 100000) * 100000
  return [0, 10000, 50000, 100000, 150000, 200000, Math.max(midTop, 300000), topCeil]
}

function getBarHeightPct(val, ticksAsc) {
  if (!val || val <= 0) return 0
  const n = ticksAsc.length - 1
  if (n <= 0) return 0
  if (val >= ticksAsc[n]) return 100
  for (let i = 0; i < n; i++) {
    if (val <= ticksAsc[i + 1]) {
      const span = ticksAsc[i + 1] - ticksAsc[i]
      const frac = span > 0 ? (val - ticksAsc[i]) / span : 0
      return Math.min(100, Math.max(3, ((i + frac) / n) * 100))
    }
  }
  return 100
}

const DAY_OPTIONS      = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months', 'This year']

export default function BusinessMetrics() {
  const [hoveredBar, setHoveredBar]             = useState(null)
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState(null)
  const [pinnedBar, setPinnedBar]               = useState(null)
  const [dayFilter, setDayFilter]               = useState('Last 30 days')
  const [customerFilter, setCustomerFilter]     = useState('All Customers')
  const [showDayDrop, setShowDayDrop]           = useState(false)
  const [showCustDrop, setShowCustDrop]         = useState(false)
  const [people, setPeople]                     = useState([])

  // Real-time backend states
  const [series, setSeries] = useState(BAR_SERIES)
  const [barData, setBarData] = useState([])
  const [donutSegments, setDonutSegments] = useState([])
  const [tooltipData, setTooltipData] = useState([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState(null)
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
          if (res.data.series && res.data.series.length > 0) {
            setSeries(res.data.series)
          }
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

  const activeSeries = series && series.length > 0 ? series : BAR_SERIES
  const maxRawRevenue = Math.max(
    ...barData.flatMap(grp => activeSeries.map(s => Number(grp[s.key]) || 0)),
    0
  )
  const ticksAsc = getScaleTicks(maxRawRevenue)
  const ticksDesc = [...ticksAsc].reverse()
  const yLabels = ticksDesc.map(formatYAxisLabel)

  const donutPaths = buildDonutPaths(donutSegments, 90, 90, 75)
  const donutInner = buildDonutPaths(donutSegments, 90, 90, 50)
  const hasDonutData = donutSegments.length > 0 && donutSegments.some(s => (s.count || 0) > 0 || (s.pct || 0) > 0)

  const closeDrops = () => { setShowDayDrop(false); setShowCustDrop(false); setPinnedBar(null) }

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
    <div className="ws-bm-section" role="presentation" onClick={closeDrops} onKeyDown={(e) => { if (e.key === 'Escape') closeDrops() }} style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>

      {/* ── Header ── */}
      <div className="ws-bm-header">
        <div className="ws-bm-header-left">
          <h2 className="ws-bm-title">Business Metrics</h2>
          <p className="ws-bm-sub">Overview of sales pipeline, revenue growth, product performance, and more.</p>
        </div>
        <div className="ws-bm-header-right" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
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
              {activeSeries.map(s => (
                <div key={s.key} className="ws-bm-legend-item">
                  <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="ws-bm-bar-area">
            <div className="ws-bm-yaxis">
              {yLabels.map((l, i) => (
                <span key={`${l}-${i}`} className="ws-bm-yaxis-label">{l}</span>
              ))}
            </div>

            <div className="ws-bm-bar-chart">
              <div className="ws-bm-gridlines">
                {ticksDesc.map((_, i) => (
                  <div key={i} className="ws-bm-gridline" />
                ))}
              </div>

              <div className="ws-bm-bar-groups">
                {barData.map((grp, gi) => {
                  const tip = tooltipData[gi]
                  const isVisible = hoveredBar === gi || pinnedBar === gi
                  const monthTotal = activeSeries.reduce((sum, s) => sum + (Number(grp[s.key]) || 0), 0)

                  return (
                    <div
                      key={grp.label}
                      className="ws-bm-bar-group"
                      onMouseEnter={() => setHoveredBar(gi)}
                      onMouseLeave={() => { setHoveredBar(null); setHoveredSeriesKey(null) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPinnedBar(pinnedBar === gi ? null : gi)
                      }}
                    >
                      {activeSeries.map(s => {
                        const val = Number(grp[s.key]) || 0
                        const heightPct = getBarHeightPct(val, ticksAsc)
                        const isThisBarHovered = hoveredSeriesKey === s.key
                        let barOpacity = 0.85
                        if (hoveredSeriesKey) {
                          barOpacity = isThisBarHovered ? 1 : 0.4
                        } else if (isVisible) {
                          barOpacity = 1
                        }

                        return (
                          <div
                            key={s.key}
                            className="ws-bm-bar"
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              setHoveredSeriesKey(s.key)
                            }}
                            style={{
                              height: `${heightPct}%`,
                              background: s.color,
                              opacity: barOpacity,
                              transform: isThisBarHovered ? 'scaleX(1.2)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                            title={`${s.label}: ₹${val.toLocaleString('en-IN')}`}
                          />
                        )
                      })}

                      {isVisible && (
                        <div 
                          className="ws-bm-tooltip"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            minWidth: 230,
                            zIndex: 100,
                            left: gi === barData.length - 1 ? 'auto' : '50%',
                            right: gi === barData.length - 1 ? '0px' : 'auto',
                            transform: gi === barData.length - 1 ? 'none' : 'translateX(-50%)',
                            pointerEvents: 'auto'
                          }}
                        >
                          <div className="ws-bm-tooltip-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span>{grp.label}</span>
                            <span className="ws-bm-tooltip-badge">
                              ₹{monthTotal.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                            {activeSeries.map(s => {
                              const val = Number(grp[s.key]) || 0
                              const pct = monthTotal > 0 ? Math.round((val / monthTotal) * 100) : 0
                              const isHighlighted = hoveredSeriesKey === s.key

                              return (
                                <div 
                                  key={s.key}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    padding: '3px 6px',
                                    borderRadius: 4,
                                    background: isHighlighted ? '#f1f5f9' : 'transparent',
                                    fontWeight: isHighlighted ? 700 : 500
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                                    <span style={{ color: isHighlighted ? '#0f172a' : '#334155' }}>{s.label}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>₹{val.toLocaleString('en-IN')}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '0.70rem', minWidth: 26, textAlign: 'right' }}>{pct}%</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {tip?.product && tip.product !== 'N/A' && (
                            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                              <span>Top: <strong>{tip.product}</strong></span>
                              <span>USD: <strong>{tip.usd}</strong></span>
                            </div>
                          )}
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
                  {s.label} {s.pct > 0 ? `(${s.pct}%)` : ''}
                </div>
              ))}
            </div>
          </div>

          <div className="ws-bm-donut-wrap">
            {hasDonutData ? (
              <svg viewBox="0 0 180 180" className="ws-bm-donut-svg">
                {donutPaths.map((p, i) => (
                  <path key={i} d={p.d} fill={p.color} opacity="0.9" />
                ))}
                {donutInner.map((p, i) => (
                  <path key={`inner-${i}`} d={p.d} fill={p.color} opacity="0.35" />
                ))}
                <circle cx="90" cy="90" r="38" fill="white" />
              </svg>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: '#94a3b8', fontSize: '0.84rem' }}>
                <span>No deals recorded for this period</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
