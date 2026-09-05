import React, { useState, useEffect } from 'react'
import { Filter, ChevronDown, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import './Dashboard.css'

function buildDonutPaths(segments, cx, cy, r, gap = 2) {
  if (!segments || segments.length === 0) return []
  const paths = []
  let startAngle = -90
  const total = segments.reduce((s, seg) => s + (seg.pct || 0), 0)
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

const DAY_OPTIONS = ['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months', 'This year', 'Custom date']

export default function BusinessMetrics({
  selectedCategory: propSelectedCategory,
  setSelectedCategory: propSetSelectedCategory,
  productFilter: propProductFilter,
  setProductFilter: propSetProductFilter
} = {}) {
  const [hoveredBar, setHoveredBar]             = useState(null)
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState(null)
  const [pinnedBar, setPinnedBar]               = useState(null)
  const [dayFilter, setDayFilter]               = useState('Last 7 days')
  const [customStartDate, setCustomStartDate]   = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [customEndDate, setCustomEndDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customerFilter, setCustomerFilter]     = useState('All Customers')
  const [localProductFilter, setLocalProductFilter] = useState('All Products')
  const [showDayDrop, setShowDayDrop]           = useState(false)
  const [showCustDrop, setShowCustDrop]         = useState(false)
  const [showProdDrop, setShowProdDrop]         = useState(false)
  const [people, setPeople]                     = useState([])
  const [allProducts, setAllProducts]           = useState([])

  const productFilter = propProductFilter !== undefined ? propProductFilter : localProductFilter
  const setProductFilter = propSetProductFilter || setLocalProductFilter

  // Category drill-down state
  const [localSelectedCategory, setLocalSelectedCategory] = useState(null)
  const selectedCategory = propSelectedCategory !== undefined ? propSelectedCategory : localSelectedCategory
  const setSelectedCategory = propSetSelectedCategory || setLocalSelectedCategory

  const [categoryBreakdown, setCategoryBreakdown] = useState(null)

  // Real-time backend states
  const [series, setSeries] = useState([])
  const [barData, setBarData] = useState([])
  const [donutSegments, setDonutSegments] = useState([])
  const [tooltipData, setTooltipData] = useState([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 1. Fetch Main Overview Metrics
  useEffect(() => {
    let active = true
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        const params = { dayFilter, customerFilter, productFilter }
        if (dayFilter === 'Custom date') {
          params.startDate = customStartDate
          params.endDate = customEndDate
        }
        const res = await api.get('/reports/business-metrics', { params })
        if (active) {
          if (res.data.series) {
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
  }, [dayFilter, customerFilter, productFilter, customStartDate, customEndDate, refreshTrigger])

  // 2. Fetch Category Breakdown when selectedCategory is set
  useEffect(() => {
    if (!selectedCategory) {
      setCategoryBreakdown(null)
      return
    }
    let active = true
    const fetchCatBreakdown = async () => {
      try {
        setLoading(true)
        const params = { category: selectedCategory, dayFilter, customerFilter, productFilter }
        if (dayFilter === 'Custom date') {
          params.startDate = customStartDate
          params.endDate = customEndDate
        }
        const res = await api.get('/reports/category-breakdown', { params })
        if (active) {
          setCategoryBreakdown(res.data)
        }
      } catch (err) {
        console.error('Error loading category breakdown:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchCatBreakdown()
    return () => { active = false }
  }, [selectedCategory, dayFilter, customerFilter, productFilter, customStartDate, customEndDate, refreshTrigger])

  // Fetch People / Customers
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

  // Fetch All Products for dropdown
  useEffect(() => {
    let active = true
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products')
        if (active && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data.data || [])
          setAllProducts(list)
        }
      } catch (err) {
        console.error('Error loading products for filter:', err)
      }
    }
    fetchProducts()
    return () => { active = false }
  }, [refreshTrigger])

  const customerOptions = [
    'All Customers',
    'Walking Customer',
    ...Array.from(new Set(people.map(p => p?.name).filter(Boolean))).filter(n => !n.toLowerCase().includes('walk'))
  ]

  // Compute product options based on current view
  const isDrilldown = Boolean(selectedCategory && categoryBreakdown)
  const productOptions = isDrilldown
    ? ['All Products', ...(categoryBreakdown?.allCategoryProducts || categoryBreakdown?.series?.map(s => s.label) || [])]
    : ['All Products', ...Array.from(new Set(allProducts.map(p => p.name)))]

  // Compute active dataset
  const displaySeries = isDrilldown ? (categoryBreakdown?.series || []) : series
  const displayBarData = isDrilldown ? (categoryBreakdown?.barData || []) : barData
  const displayDonutSegments = isDrilldown ? (categoryBreakdown?.donutData || []) : donutSegments
  const displayTooltipData = isDrilldown ? (categoryBreakdown?.tooltipData || []) : tooltipData

  const maxRawRevenue = Math.max(
    ...displayBarData.flatMap(grp => displaySeries.map(s => Number(grp[s.key]) || 0)),
    0
  )
  const ticksAsc = getScaleTicks(maxRawRevenue)
  const ticksDesc = [...ticksAsc].reverse()
  const yLabels = ticksDesc.map(formatYAxisLabel)

  const donutPaths = buildDonutPaths(displayDonutSegments, 90, 90, 75)
  const donutInner = buildDonutPaths(displayDonutSegments, 90, 90, 50)
  const hasDonutData = displayDonutSegments.length > 0 && displayDonutSegments.some(s => (s.count || 0) > 0 || (s.pct || 0) > 0 || (s.revenue || 0) > 0)

  const closeDrops = () => { setShowDayDrop(false); setShowCustDrop(false); setShowProdDrop(false); setPinnedBar(null) }

  if (loading && barData.length === 0 && !categoryBreakdown) {
    return (
      <div className="ws-bm-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 20px' }}>
        <div style={{ color: '#3b82f6', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw className="ws-bm-spinner" size={16} /> Loading real-time records...
        </div>
      </div>
    )
  }

  return (
    <div className="ws-bm-section" role="presentation" onClick={closeDrops} onKeyDown={(e) => { if (e.key === 'Escape') closeDrops() }} style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s' }}>

      {/* ── Header (Above all charts & cards) ── */}
      <div className="ws-bm-header" style={{ marginBottom: isDrilldown ? 20 : 16 }}>
        <div className="ws-bm-header-left">
          {isDrilldown ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 className="ws-bm-title" style={{ margin: 0 }}>
                  {selectedCategory}
                </h2>
                <span style={{ fontSize: '0.74rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                  Product Breakdown
                </span>
              </div>
              <p className="ws-bm-sub" style={{ margin: 0 }}>Sales performance, volume and product growth for {selectedCategory}.</p>
            </div>
          ) : (
            <div>
              <h2 className="ws-bm-title">Business Metrics</h2>
              <p className="ws-bm-sub">Overview of sales pipeline, revenue growth, product performance, and more.</p>
            </div>
          )}
        </div>

        <div className="ws-bm-header-right" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Filters */}
          <Filter size={13} style={{ color: '#9ca3af' }} />

          {/* 1. Date Filter Dropdown */}
          <div className="ws-bm-filter-wrap">
            <button
              className="ws-bm-filter-btn"
              onClick={() => {
                setShowDayDrop(v => !v)
                setShowCustDrop(false)
                setShowProdDrop(false)
                if (dayFilter === 'Custom date') {
                  setShowCustomPicker(true)
                }
              }}
            >
              {dayFilter === 'Custom date' && customStartDate && customEndDate ? (
                `${new Date(customStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(customEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
              ) : (
                dayFilter
              )}{' '}
              <ChevronDown size={11} />
            </button>
            {showDayDrop && (
              <div className="ws-bm-dropdown" style={{ minWidth: showCustomPicker ? 230 : 160, padding: 6 }}>
                {DAY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`ws-bm-dropdown-item ${dayFilter === opt && !showCustomPicker ? 'active' : ''}`}
                    onClick={() => {
                      if (opt === 'Custom date') {
                        setShowCustomPicker(true)
                      } else {
                        setDayFilter(opt)
                        setShowCustomPicker(false)
                        setShowDayDrop(false)
                      }
                    }}
                  >
                    {opt}
                  </button>
                ))}

                {showCustomPicker && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '0.78rem',
                          padding: '5px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          outline: 'none',
                          color: '#0f172a'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '0.78rem',
                          padding: '5px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          outline: 'none',
                          color: '#0f172a'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          setDayFilter('Custom date')
                          setShowDayDrop(false)
                        }
                      }}
                      style={{
                        marginTop: 4,
                        padding: '6px 12px',
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Product Filter Dropdown (Only shown in Category Drilldown) */}
          {isDrilldown && (
            <div className="ws-bm-filter-wrap">
              <button
                className="ws-bm-filter-btn"
                onClick={() => { setShowProdDrop(v => !v); setShowDayDrop(false); setShowCustDrop(false) }}
              >
                {productFilter} <ChevronDown size={11} />
              </button>
              {showProdDrop && (
                <div className="ws-bm-dropdown" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {productOptions.map(opt => (
                    <button
                      key={opt}
                      className={`ws-bm-dropdown-item ${productFilter === opt ? 'active' : ''}`}
                      onClick={() => { setProductFilter(opt); setShowProdDrop(false) }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Refresh button */}
          <div className="ws-bm-actions">
            <button className="ws-bm-btn-refresh" onClick={() => setRefreshTrigger(prev => prev + 1)} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'ws-bm-spinner' : ''} /> Refresh data
            </button>
          </div>
        </div>
      </div>

      {/* ── Category KPI Summary Cards (When drilled down) ── */}
      {isDrilldown && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Revenue</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              ₹{(categoryBreakdown?.totalRevenue || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Volume Sold</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {(categoryBreakdown?.totalUnits || 0).toLocaleString('en-IN')} units
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Orders</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {categoryBreakdown?.totalOrders || 0}
            </span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Products in {selectedCategory}</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {categoryBreakdown?.totalProductsCount || displaySeries.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="ws-bm-charts-row">

        {/* Left: Bar chart */}
        <div className="ws-bm-card">
          <div className="ws-bm-card-header">
            <div className="ws-bm-card-title-row">
              <span className="ws-bm-card-title">
                {isDrilldown ? `Revenue growth by product (${selectedCategory})` : 'Revenue growth by category'}
              </span>
            </div>
            <div className="ws-bm-legend">
              {displaySeries.map(s => (
                <div 
                  key={s.key} 
                  className="ws-bm-legend-item"
                  style={{
                    cursor: 'default',
                    padding: '3px 8px',
                    borderRadius: 6,
                    transition: 'all 0.15s ease',
                    background: (!isDrilldown && hoveredSeriesKey === s.key) ? '#f1f5f9' : 'transparent'
                  }}
                >
                  <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                  <span style={{ fontWeight: 500 }}>{s.label}</span>
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
                {displayBarData.map((grp, gi) => {
                  const tip = displayTooltipData[gi]
                  const isVisible = hoveredBar === gi || pinnedBar === gi
                  const periodTotal = displaySeries.reduce((sum, s) => sum + (Number(grp[s.key]) || 0), 0)

                  return (
                    <div
                      key={grp.label}
                      className="ws-bm-bar-group"
                      role="button"
                      tabIndex={0}
                      aria-label={`Metrics for ${grp.label}`}
                      onMouseEnter={() => setHoveredBar(gi)}
                      onMouseLeave={() => { setHoveredBar(null); setHoveredSeriesKey(null) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPinnedBar(pinnedBar === gi ? null : gi)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          setPinnedBar(pinnedBar === gi ? null : gi)
                        }
                      }}
                    >
                      {displaySeries.map(s => {
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
                            onClick={(e) => {
                              if (!isDrilldown) {
                                e.stopPropagation()
                                setSelectedCategory(s.label)
                              }
                            }}
                            style={{
                              height: `${heightPct}%`,
                              background: s.color,
                              opacity: barOpacity,
                              transform: isThisBarHovered ? 'scaleX(1.2)' : 'none',
                              cursor: !isDrilldown ? 'pointer' : 'default',
                              transition: 'all 0.15s ease'
                            }}
                            title={`${s.label}: ₹${val.toLocaleString('en-IN')}`}
                          />
                        )
                      })}

                      {isVisible && (
                        <div 
                          className="ws-bm-tooltip"
                          role="region"
                          aria-label={`${grp.label} details`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          style={{
                            minWidth: 230,
                            zIndex: 100,
                            left: gi === displayBarData.length - 1 ? 'auto' : '50%',
                            right: gi === displayBarData.length - 1 ? '0px' : 'auto',
                            transform: gi === displayBarData.length - 1 ? 'none' : 'translateX(-50%)',
                            pointerEvents: 'auto'
                          }}
                        >
                          <div className="ws-bm-tooltip-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span>{grp.label}</span>
                            <span className="ws-bm-tooltip-badge">
                              ₹{periodTotal.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                            {displaySeries.map(s => {
                              const val = Number(grp[s.key]) || 0
                              const pct = periodTotal > 0 ? Math.round((val / periodTotal) * 100) : 0
                              const isHighlighted = hoveredSeriesKey === s.key

                              return (
                                <div 
                                  key={s.key}
                                  onClick={(e) => {
                                    if (!isDrilldown) {
                                      e.stopPropagation()
                                      setSelectedCategory(s.label)
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    background: isHighlighted ? '#e2e8f0' : '#f8fafc',
                                    fontWeight: isHighlighted ? 700 : 500,
                                    cursor: !isDrilldown ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                    border: '1px solid #e2e8f0'
                                  }}
                                  title={!isDrilldown ? `Click to view ${s.label} products breakdown` : ''}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{s.label}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>₹{val.toLocaleString('en-IN')}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.70rem', minWidth: 26, textAlign: 'right' }}>{pct}%</span>
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

                          {!isDrilldown && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation()
                                const catToUse = (tip?.product && tip.product !== 'N/A') ? tip.product : (displaySeries[0]?.label || 'Grains')
                                setSelectedCategory(catToUse)
                              }}
                              style={{
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: '#2563eb',
                                cursor: 'pointer'
                              }}
                            >
                              Click to view product breakdown →
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="ws-bm-xaxis">
                {displayBarData.map(g => (
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
              <span className="ws-bm-card-title">
                {isDrilldown ? `Product sales share (${selectedCategory})` : 'Sales by product category'}
              </span>
            </div>
            <div className="ws-bm-legend">
              {displayDonutSegments.map(s => (
                <div 
                  key={s.label} 
                  className="ws-bm-legend-item"
                  style={{
                    cursor: 'default',
                    padding: '3px 8px',
                    borderRadius: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                  <span style={{ fontWeight: 500 }}>
                    {s.label} {s.pct > 0 ? `(${s.pct}%)` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ws-bm-donut-wrap">
            {hasDonutData ? (
              <svg viewBox="0 0 180 180" className="ws-bm-donut-svg">
                {donutPaths.map((p, i) => (
                  <path 
                    key={i} 
                    d={p.d} 
                    fill={p.color} 
                    opacity="0.9" 
                    style={{ cursor: !isDrilldown ? 'pointer' : 'default', transition: 'transform 0.15s ease' }}
                    onClick={() => {
                      if (!isDrilldown) setSelectedCategory(p.label)
                    }}
                  />
                ))}
                {donutInner.map((p, i) => (
                  <path key={`inner-${i}`} d={p.d} fill={p.color} opacity="0.35" />
                ))}
                <circle cx="90" cy="90" r="38" fill="white" />
              </svg>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: '#94a3b8', fontSize: '0.84rem' }}>
                <span>No sales recorded for this period</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Product Performance Table (When inside category drilldown) ── */}
      {isDrilldown && (
        <div style={{ marginTop: 24, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {selectedCategory} — Individual Products Breakdown
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {displayDonutSegments.length} Products
            </span>
          </div>
          <table className="ws-table-styled" style={{ margin: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Product Name</th>
                <th style={{ width: '25%', textAlign: 'right' }}>Units Sold</th>
                <th style={{ width: '25%', textAlign: 'right' }}>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {displayDonutSegments.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No sales recorded for {selectedCategory} in this period
                  </td>
                </tr>
              ) : (
                displayDonutSegments.map((prod, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: prod.color }} />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{prod.label}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {Number(prod.units_sold || 0).toLocaleString('en-IN')} <span style={{ color: '#64748b', fontSize: '0.80rem' }}>{prod.unit || ''}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      ₹{Number(prod.revenue || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
