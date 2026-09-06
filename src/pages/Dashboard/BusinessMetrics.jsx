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
    return `₹${Number.parseFloat(inLakhs.toFixed(1))}L`
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
const STATUS_OPTIONS = ['All Bills', 'Paid Only', 'Unpaid Only']

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
  const [statusFilter, setStatusFilter]         = useState('All Bills')
  const [taxMode, setTaxMode]                   = useState('Without GST')
  const [customStartDate, setCustomStartDate]   = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [customEndDate, setCustomEndDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [localProductFilter, setLocalProductFilter] = useState('All Products')
  const [showDayDrop, setShowDayDrop]           = useState(false)
  const [showStatusDrop, setShowStatusDrop]     = useState(false)
  const [showCustDrop, setShowCustDrop]         = useState(false)
  const [showProdDrop, setShowProdDrop]         = useState(false)
  const [people, setPeople]                     = useState([])
  const [allProducts, setAllProducts]           = useState([])

  const customerFilter = 'All Customers'
  const productFilter = propProductFilter !== undefined ? propProductFilter : localProductFilter
  const setProductFilter = propSetProductFilter || setLocalProductFilter

  // Category drill-down state
  const [localSelectedCategory, setLocalSelectedCategory] = useState(null)
  const selectedCategory = propSelectedCategory !== undefined ? propSelectedCategory : localSelectedCategory
  const setSelectedCategory = propSetSelectedCategory || setLocalSelectedCategory

  const [categoryBreakdown, setCategoryBreakdown] = useState(null)

  // Reset pinned and hovered tooltip when drilldown category changes
  useEffect(() => {
    setPinnedBar(null)
    setHoveredBar(null)
    setHoveredSeriesKey(null)
  }, [selectedCategory])

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
        const params = { dayFilter, customerFilter, productFilter, statusFilter }
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
  }, [dayFilter, customerFilter, productFilter, statusFilter, customStartDate, customEndDate, refreshTrigger])

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
        const params = { category: selectedCategory, dayFilter, customerFilter, productFilter, statusFilter }
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
  }, [selectedCategory, dayFilter, customerFilter, productFilter, statusFilter, customStartDate, customEndDate, refreshTrigger])

  // Fetch People / Customers (lazy-loaded on dropdown open or after idle)
  useEffect(() => {
    let active = true
    let timer = null
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

    if (showCustDrop) {
      fetchPeople()
    } else if (people.length === 0) {
      // Background preload after initial chart render
      timer = setTimeout(fetchPeople, 1500)
    }

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [showCustDrop, refreshTrigger])

  // Fetch All Products for dropdown (lazy-loaded on dropdown open or after idle)
  useEffect(() => {
    let active = true
    let timer = null
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

    if (showProdDrop) {
      fetchProducts()
    } else if (allProducts.length === 0) {
      // Background preload after initial chart render
      timer = setTimeout(fetchProducts, 2000)
    }

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [showProdDrop, refreshTrigger])

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

  const activeSeriesKey = (s) => (taxMode === 'With GST' ? `${s.key}_with_gst` : s.key)

  const maxRawRevenue = Math.max(
    ...displayBarData.flatMap(grp => displaySeries.map(s => Number(grp[activeSeriesKey(s)]) || Number(grp[s.key]) || 0)),
    0
  )
  const ticksAsc = getScaleTicks(maxRawRevenue)
  const ticksDesc = [...ticksAsc].reverse()
  const yLabels = ticksDesc.map(formatYAxisLabel)

  const adjustedDonutSegments = displayDonutSegments.map(s => {
    const rev = taxMode === 'With GST' ? (s.revenue_with_gst || s.revenue || 0) : (s.revenue || 0)
    return { ...s, currentRevenue: rev }
  })
  const donutTotalRev = adjustedDonutSegments.reduce((sum, s) => sum + (s.currentRevenue || 0), 0)
  const finalDonutSegments = adjustedDonutSegments.map(s => ({
    ...s,
    pct: donutTotalRev > 0 ? Math.round(((s.currentRevenue || 0) / donutTotalRev) * 100) : (s.pct || 0)
  }))

  const donutPaths = buildDonutPaths(finalDonutSegments, 90, 90, 75)
  const donutInner = buildDonutPaths(finalDonutSegments, 90, 90, 50)
  const hasDonutData = displayDonutSegments.length > 0 && displayDonutSegments.some(s => (s.count || 0) > 0 || (s.pct || 0) > 0 || (s.revenue || 0) > 0)

  const closeDrops = () => { setShowDayDrop(false); setShowStatusDrop(false); setShowCustDrop(false); setShowProdDrop(false); setPinnedBar(null) }

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
          {/* Tax Mode Selector (Without GST / With GST / Both) */}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
            {['Without GST', 'With GST', 'Both'].map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setTaxMode(mode)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: taxMode === mode ? 700 : 500,
                  color: taxMode === mode ? (mode === 'With GST' ? '#059669' : mode === 'Both' ? '#2563eb' : '#1e293b') : '#64748b',
                  background: taxMode === mode ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  boxShadow: taxMode === mode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

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
                    role="presentation"
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
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

          {/* 2. Status Filter Dropdown */}
          <div className="ws-bm-filter-wrap">
            <button
              type="button"
              className="ws-bm-filter-btn"
              onClick={() => {
                setShowStatusDrop(v => !v)
                setShowDayDrop(false)
                setShowCustDrop(false)
                setShowProdDrop(false)
              }}
            >
              {statusFilter}{' '}
              <ChevronDown size={11} />
            </button>
            {showStatusDrop && (
              <div className="ws-bm-dropdown" style={{ minWidth: 120, padding: 6 }}>
                {STATUS_OPTIONS.map(opt => (
                  <button
                    type="button"
                    key={opt}
                    className={`ws-bm-dropdown-item ${statusFilter === opt ? 'active' : ''}`}
                    onClick={() => {
                      setStatusFilter(opt)
                      setShowStatusDrop(false)
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Product Filter Dropdown (Only shown in Category Drilldown) */}
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
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
              {(() => {
                const segs = categoryBreakdown?.donutData || []
                const hasW = segs.some(p => ['kgs', 'kg', 'kilogram', 'kilograms'].includes(String(p.unit || '').toLowerCase().trim()) && Number(p.bag_weight || 1) > 1)
                if (hasW) {
                  const bags = segs.reduce((sum, p) => {
                    const bw = Number(p.bag_weight || 1)
                    const tw = Number(p.total_weight_kg) || ((Number(p.units_sold) || 0) * bw)
                    return sum + Math.floor(tw / bw)
                  }, 0)
                  const w = segs.reduce((sum, p) => {
                    const bw = Number(p.bag_weight || 1)
                    return sum + (Number(p.total_weight_kg) || ((Number(p.units_sold) || 0) * bw))
                  }, 0)
                  return `${bags} Bags (${Math.round(w).toLocaleString('en-IN')} kgs)`
                }
                return `${(categoryBreakdown?.totalUnits || 0).toLocaleString('en-IN')} units`
              })()}
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
                  const periodTotalWithoutGst = displaySeries.reduce((sum, s) => sum + (Number(grp[s.key]) || 0), 0)
                  const periodTotalWithGst = displaySeries.reduce((sum, s) => sum + (Number(grp[`${s.key}_with_gst`]) || Number(grp[s.key]) || 0), 0)
                  const periodGstDiff = Math.max(0, periodTotalWithGst - periodTotalWithoutGst)

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
                        const valWithoutGst = Number(grp[s.key]) || 0
                        const valWithGst = Number(grp[`${s.key}_with_gst`]) || valWithoutGst
                        const val = taxMode === 'With GST' ? valWithGst : valWithoutGst
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
                            role={!isDrilldown ? "button" : undefined}
                            tabIndex={!isDrilldown ? 0 : undefined}
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
                            onKeyDown={(e) => {
                              if (!isDrilldown && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault()
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
                            title={
                              taxMode === 'Without GST'
                                ? `${s.label}: ₹${valWithoutGst.toLocaleString('en-IN')}`
                                : taxMode === 'With GST'
                                  ? `${s.label} (With GST): ₹${valWithGst.toLocaleString('en-IN')}`
                                  : `${s.label}: ₹${valWithoutGst.toLocaleString('en-IN')} (With GST: ₹${valWithGst.toLocaleString('en-IN')})`
                            }
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
                            minWidth: taxMode === 'Both' ? 275 : 240,
                            zIndex: 100,
                            left: gi === displayBarData.length - 1 ? 'auto' : '50%',
                            right: gi === displayBarData.length - 1 ? '0px' : 'auto',
                            transform: gi === displayBarData.length - 1 ? 'none' : 'translateX(-50%)',
                            pointerEvents: 'auto'
                          }}
                        >
                          <div className="ws-bm-tooltip-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>{grp.label}</span>
                            {taxMode !== 'Both' ? (
                              <span className="ws-bm-tooltip-badge" style={{
                                background: taxMode === 'With GST' ? '#dcfce7' : '#f1f5f9',
                                color: taxMode === 'With GST' ? '#16a34a' : '#0f172a',
                                fontWeight: 700
                              }}>
                                ₹{(taxMode === 'With GST' ? (tip?.withGst ?? periodTotalWithGst) : (tip?.withoutGst ?? periodTotalWithoutGst)).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.70rem', color: '#64748b', background: '#f1f5f9', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                                {statusFilter}
                              </span>
                            )}
                          </div>

                          {/* Dual Summary Box: ONLY rendered when taxMode === 'Both' */}
                          {taxMode === 'Both' && (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 6,
                              padding: '6px 10px',
                              background: '#f8fafc',
                              borderRadius: 7,
                              border: '1px solid #e2e8f0',
                              marginBottom: 8
                            }}>
                              <div>
                                <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Without GST</div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  ₹{(tip?.withoutGst ?? periodTotalWithoutGst).toLocaleString('en-IN')}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.64rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase' }}>With GST</div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669' }}>
                                  ₹{(tip?.withGst ?? periodTotalWithGst).toLocaleString('en-IN')}
                                </div>
                              </div>
                              {((tip?.gstAmount ?? periodGstDiff) > 0) && (
                                <div style={{ gridColumn: '1 / -1', paddingTop: 4, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#64748b' }}>
                                  <span>GST (Tax):</span>
                                  <span style={{ fontWeight: 700, color: '#d97706' }}>+₹{(tip?.gstAmount ?? periodGstDiff).toLocaleString('en-IN')}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                            {displaySeries.map(s => {
                              const valWithout = Number(grp[s.key]) || 0
                              const valWith = Number(grp[`${s.key}_with_gst`]) || valWithout
                              const currentVal = taxMode === 'With GST' ? valWith : valWithout
                              const totalRef = taxMode === 'With GST' ? periodTotalWithGst : periodTotalWithoutGst
                              const pct = totalRef > 0 ? Math.round((currentVal / totalRef) * 100) : 0
                              const isHighlighted = hoveredSeriesKey === s.key

                              return (
                                <div 
                                  key={s.key}
                                  role={!isDrilldown ? "button" : undefined}
                                  tabIndex={!isDrilldown ? 0 : undefined}
                                  onClick={(e) => {
                                    if (!isDrilldown) {
                                      e.stopPropagation()
                                      setPinnedBar(null)
                                      setHoveredBar(null)
                                      setSelectedCategory(s.label)
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (!isDrilldown && (e.key === 'Enter' || e.key === ' ')) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setPinnedBar(null)
                                      setHoveredBar(null)
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, marginRight: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                                    <span style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ color: '#0f172a', fontWeight: 700 }}>₹{currentVal.toLocaleString('en-IN')}</span>
                                      <span style={{ color: '#64748b', fontSize: '0.68rem', minWidth: 24, textAlign: 'right' }}>{pct}%</span>
                                    </div>
                                    {taxMode === 'Both' && valWith !== valWithout && (
                                      <span style={{ color: '#059669', fontSize: '0.66rem', fontWeight: 600 }}>
                                        Incl. GST: ₹{valWith.toLocaleString('en-IN')}
                                      </span>
                                    )}
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
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPinnedBar(null)
                                setHoveredBar(null)
                                const catToUse = (tip?.product && tip.product !== 'N/A') ? tip.product : (displaySeries[0]?.label || 'Grains')
                                setSelectedCategory(catToUse)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setPinnedBar(null)
                                  setHoveredBar(null)
                                  const catToUse = (tip?.product && tip.product !== 'N/A') ? tip.product : (displaySeries[0]?.label || 'Grains')
                                  setSelectedCategory(catToUse)
                                }
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
                {isDrilldown ? `Product sales breakdown (${selectedCategory})` : 'Sales by product category'}
              </span>
            </div>
            <div className="ws-bm-legend">
              {finalDonutSegments.map(s => {
                const revWithout = s.revenue || 0
                const revWith = s.revenue_with_gst || s.revenue || 0
                const revToShow = taxMode === 'With GST' ? revWith : revWithout
                const titleText = taxMode === 'Both'
                  ? `Without GST: ₹${Math.round(revWithout).toLocaleString('en-IN')}\nWith GST: ₹${Math.round(revWith).toLocaleString('en-IN')}`
                  : taxMode === 'With GST'
                    ? `With GST: ₹${Math.round(revWith).toLocaleString('en-IN')}`
                    : `Without GST: ₹${Math.round(revWithout).toLocaleString('en-IN')}`
                return (
                  <div 
                    key={s.label} 
                    className="ws-bm-legend-item"
                    title={titleText}
                    style={{
                      cursor: 'default',
                      padding: '3px 8px',
                      borderRadius: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span className="ws-bm-legend-dot" style={{ background: s.color }} />
                    <span style={{ fontWeight: 500 }}>
                      {s.label} {s.pct > 0 ? `(${s.pct}%)` : ''} <span style={{ color: '#0f172a', fontWeight: 600 }}>₹{Math.round(revToShow).toLocaleString('en-IN')}</span>
                    </span>
                  </div>
                )
              })}
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
        <ProductPerformanceTable 
          selectedCategory={selectedCategory} 
          displayDonutSegments={displayDonutSegments} 
          taxMode={taxMode} 
        />
      )}

    </div>
  )
}

function formatProductUnits(prod) {
  const isWeightUnit = ['kgs', 'kg', 'kilogram', 'kilograms'].includes(String(prod.unit || '').toLowerCase().trim())
  const bw = Number(prod.bag_weight || 1)

  if (isWeightUnit && bw > 1) {
    const totalWeight = Number(prod.total_weight_kg) || ((Number(prod.units_sold) || 0) * bw)
    const fullBags = Math.floor(totalWeight / bw)
    const looseKg = Math.round((totalWeight % bw) * 100) / 100

    const bagsPart = fullBags > 0 ? `${fullBags.toLocaleString('en-IN')} ${fullBags === 1 ? 'Bag' : 'Bags'}` : ''
    const loosePart = looseKg > 0 ? `${looseKg.toLocaleString('en-IN')} kgs` : ''
    const bagsText = [bagsPart, loosePart].filter(Boolean).join(' ') || '0 Bags'
    const weightText = `${Math.round(totalWeight).toLocaleString('en-IN')} kgs`

    return { isWeight: true, bagsText, weightText }
  }

  return {
    isWeight: false,
    bagsText: `${Number(prod.units_sold || 0).toLocaleString('en-IN')} ${prod.unit || 'pcs'}`,
    weightText: null
  }
}

function calculateCategoryTotals(segments) {
  const totalRevWithout = segments.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0)
  const totalRevWith = segments.reduce((sum, p) => sum + (Number(p.revenue_with_gst || p.revenue) || 0), 0)
  const hasWeightItems = segments.some(p =>
    ['kgs', 'kg', 'kilogram', 'kilograms'].includes(String(p.unit || '').toLowerCase().trim()) && Number(p.bag_weight || 1) > 1
  )

  let totalWeightAll = 0
  let totalBagsAll = 0
  let totalLooseAll = 0

  if (hasWeightItems) {
    segments.forEach(p => {
      const bw = Number(p.bag_weight || 1)
      const isW = ['kgs', 'kg', 'kilogram', 'kilograms'].includes(String(p.unit || '').toLowerCase().trim())
      if (isW && bw > 1) {
        const tw = Number(p.total_weight_kg) || ((Number(p.units_sold) || 0) * bw)
        totalWeightAll += tw
        totalBagsAll += Math.floor(tw / bw)
        totalLooseAll += (tw % bw)
      }
    })
    totalLooseAll = Math.round(totalLooseAll)
  }

  const totalUnitsCount = segments.reduce((sum, p) => sum + (Number(p.units_sold) || 0), 0)

  return {
    totalRevWithout,
    totalRevWith,
    hasWeightItems,
    totalWeightAll,
    totalBagsAll,
    totalLooseAll,
    totalUnitsCount
  }
}

function ProductPerformanceTable({ selectedCategory, displayDonutSegments, taxMode }) {
  const totals = calculateCategoryTotals(displayDonutSegments)
  const totalRevToShow = taxMode === 'With GST' ? totals.totalRevWith : totals.totalRevWithout

  return (
    <div style={{ marginTop: 24, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
      {/* Table Header Row */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{selectedCategory}</span>
            <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>
            <span style={{ color: '#334155' }}>Individual Products Breakdown</span>
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Sales volume, quantities (bags & kgs), and revenue breakdown for {selectedCategory}.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
            {displayDonutSegments.length} {displayDonutSegments.length === 1 ? 'Product' : 'Products'}
          </span>
          <span style={{ fontSize: '0.74rem', background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
            {totals.hasWeightItems 
              ? `${totals.totalBagsAll} Bags (${Math.round(totals.totalWeightAll).toLocaleString('en-IN')} kgs)`
              : `${totals.totalUnitsCount.toLocaleString('en-IN')} units`}
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', width: taxMode === 'Both' ? '40%' : '50%' }}>
                Product Name
              </th>
              <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', width: taxMode === 'Both' ? '28%' : '25%' }}>
                Units Sold (Bags & kgs)
              </th>
              {taxMode === 'Both' ? (
                <>
                  <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', width: '16%' }}>
                    Without GST
                  </th>
                  <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', width: '16%' }}>
                    With GST
                  </th>
                </>
              ) : (
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: taxMode === 'With GST' ? '#059669' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', width: '25%' }}>
                  {taxMode === 'With GST' ? 'Revenue (With GST)' : 'Revenue (Excl. GST)'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayDonutSegments.length === 0 ? (
              <tr>
                <td colSpan={taxMode === 'Both' ? 4 : 3} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No sales recorded for {selectedCategory} in this period
                </td>
              </tr>
            ) : (
              displayDonutSegments.map((prod, idx) => {
                const revWithout = Math.round(Number(prod.revenue) || 0)
                const revWith = Math.round(Number(prod.revenue_with_gst || prod.revenue) || 0)
                const revToShow = taxMode === 'With GST' ? revWith : revWithout
                const unitsData = formatProductUnits(prod)

                return (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span 
                          style={{ 
                            width: 9, 
                            height: 9, 
                            borderRadius: '50%', 
                            background: prod.color, 
                            flexShrink: 0,
                            boxShadow: `0 0 0 2px ${prod.color}20` 
                          }} 
                        />
                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                          {prod.label}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                      {unitsData.isWeight ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                            {unitsData.bagsText}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                            ({unitsData.weightText})
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                            {Number(prod.units_sold || 0).toLocaleString('en-IN')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                            {prod.unit || 'pcs'}
                          </span>
                        </div>
                      )}
                    </td>
                    {taxMode === 'Both' ? (
                      <>
                        <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                          ₹{revWithout.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '0.85rem' }}>
                          ₹{revWith.toLocaleString('en-IN')}
                        </td>
                      </>
                    ) : (
                      <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: taxMode === 'With GST' ? '#059669' : '#0f172a', fontSize: '0.86rem' }}>
                        ₹{revToShow.toLocaleString('en-IN')}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
          {displayDonutSegments.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td style={{ padding: '13px 20px', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  Total {selectedCategory}
                </td>
                <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  {totals.hasWeightItems ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                        {totals.totalBagsAll} Bags {totals.totalLooseAll > 0 ? `${totals.totalLooseAll} kgs` : ''}
                      </span>
                      <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                        ({Math.round(totals.totalWeightAll).toLocaleString('en-IN')} kgs)
                      </span>
                    </div>
                  ) : (
                    <span>{totals.totalUnitsCount.toLocaleString('en-IN')} units</span>
                  )}
                </td>
                {taxMode === 'Both' ? (
                  <>
                    <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                      ₹{Math.round(totals.totalRevWithout).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '0.88rem' }}>
                      ₹{Math.round(totals.totalRevWith).toLocaleString('en-IN')}
                    </td>
                  </>
                ) : (
                  <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 700, color: taxMode === 'With GST' ? '#059669' : '#0f172a', fontSize: '0.88rem' }}>
                    ₹{Math.round(totalRevToShow).toLocaleString('en-IN')}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
