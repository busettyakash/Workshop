import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Filter, ArrowUpDown, X, Loader2, Search, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails, formatStockDisplay } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'
import TablePagination from '../../components/ui/TablePagination'

const formatINR = (val) => {
  if (val === null || val === undefined || val === '') return '—'
  const num = Number.parseFloat(val)
  if (Number.isNaN(num)) return '—'
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const parseUtcDate = (raw) => {
  if (!raw) return null
  if (raw instanceof Date) return raw
  let s = String(raw).trim()
  if (!s.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(s) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    s = s.replace(' ', 'T') + 'Z'
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date(raw) : d
}

const formatIndianDateTime = (raw) => {
  if (!raw) return 'N/A'
  try {
    const d = parseUtcDate(raw)
    if (!d || Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return String(raw)
  }
}

const formatIndianDateOnly = (raw) => {
  if (!raw) return 'N/A'
  try {
    const d = parseUtcDate(raw)
    if (!d || Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return String(raw)
  }
}

// Helper: compute effective display price (per price_covers qty) from raw DB value
const getDisplayPrice = (rawP, bw, pc) => {
  const p = Number.parseFloat(rawP)
  if (!rawP || Number.isNaN(p) || p <= 0) return 0
  const bagW = Number.parseFloat(bw) || 1
  const priceC = Number.parseFloat(pc) || 0
  if (priceC > 0 && bagW > 0 && priceC !== bagW) {
    return (p / bagW) * priceC
  }
  return p
}


const getItemPriceDetails = (rawP, bw, pc) => {
  if (rawP === null || rawP === undefined || rawP === '') return null
  const p = Number.parseFloat(rawP)
  if (Number.isNaN(p) || p <= 0) return null
  const bagW = Number.parseFloat(bw) || 1
  const priceC = Number.parseFloat(pc) || 0

  const packPrice = p
  const price100 = (priceC > 0 && bagW > 0 && priceC !== bagW) ? (p / bagW) * priceC : p
  const unitRate = bagW > 0 ? (packPrice / bagW) : packPrice

  return { price100, unitRate, packPrice }
}

// Accepts already-computed display prices (per price_covers qty) so the trend matches what the user sees
const renderPriceTrendGraph = (baseDisplayPrice, updatedDisplayPrice, rowId) => {
  const b = Number.parseFloat(baseDisplayPrice) || 0
  const u = updatedDisplayPrice != null && Number.parseFloat(updatedDisplayPrice) > 0 ? Number.parseFloat(updatedDisplayPrice) : null
  const diff = (u !== null && b > 0) ? (u - b) : 0
  const pct = b > 0 && u !== null ? ((diff / b) * 100).toFixed(1) : '0.0'
  const isUp = diff > 0
  const isDrop = diff < 0

  let color = '#6366f1'
  let pathD = 'M 4 15 Q 22 10, 42 15 T 80 15'
  let areaD = 'M 4 15 Q 22 10, 42 15 T 80 15 L 80 26 L 4 26 Z'
  let endX = 80
  let endY = 15

  if (isUp) {
    color = '#10b981'
    pathD = 'M 4 21 C 22 19, 32 13, 52 14 C 62 15, 70 7, 80 5'
    areaD = 'M 4 21 C 22 19, 32 13, 52 14 C 62 15, 70 7, 80 5 L 80 26 L 4 26 Z'
    endY = 5
  } else if (isDrop) {
    color = '#ef4444'
    pathD = 'M 4 5 C 22 7, 32 13, 52 12 C 62 11, 70 19, 80 21'
    areaD = 'M 4 5 C 22 7, 32 13, 52 12 C 62 11, 70 19, 80 21 L 80 26 L 4 26 Z'
    endY = 21
  }

  const gradId = `spark-grad-${rowId}`
  const absDiffFormatted = Math.abs(diff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ minWidth: 105 }}>
        {isUp ? (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#15803d',
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            padding: '2px 7px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap'
          }}>
            Price Up +₹{absDiffFormatted} ({pct}%)
          </span>
        ) : isDrop ? (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#dc2626',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            padding: '2px 7px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap'
          }}>
            Price Drop -₹{absDiffFormatted} ({pct}%)
          </span>
        ) : (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#475467',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            padding: '2px 7px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap'
          }}>
            Stable (0.0%)
          </span>
        )}
      </div>

      <svg width="84" height="26" viewBox="0 0 84 26" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={endX} cy={endY} r="3" fill={color} />
      </svg>
    </div>
  )
}

function ProductPriceHistoryDetail({ product, onBack }) {
  const [activeTab, setActiveTab] = useState('price') // 'price' | 'stock'
  const [history, setHistory] = useState([])
  const [stockHistory, setStockHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)

  const bulkUnit = getBulkUnitDetails(product.unit)
  const bagWeight = Number.parseFloat(product.bag_weight || 1)
  const pc = Number.parseFloat(product.price_covers || 0)
  const rawP = Number.parseFloat(product.price || 0)
  const rawUP = Number.parseFloat(product.updated_price || 0)

  const basePriceVal = getDisplayPrice(rawP, bagWeight, pc)
  const updatedPriceVal = rawUP > 0 ? getDisplayPrice(rawUP, bagWeight, pc) : basePriceVal

  const activeCoveragePrice = (product.updated_price && updatedPriceVal > 0) ? updatedPriceVal : basePriceVal
  const perUnitRate = (pc > 0)
    ? (activeCoveragePrice / pc)
    : (bagWeight > 0 ? (activeCoveragePrice / bagWeight) : activeCoveragePrice)

  const unitPrice = perUnitRate.toFixed(2)
  const latestLog = history.find(h => h.notes !== 'Initial Base Price') || history[0]
  const updatedDateStr = formatIndianDateOnly(latestLog?.created_at || latestLog?.effective_date || product.updated_at || product.updated_price_date)
  const catStyle = getCategoryTagStyle(product.category)

  useEffect(() => {
    let isMounted = true
    setLoadingHistory(true)
    api.get(`/products/${product.id}/price-history`)
      .then(res => {
        if (isMounted) {
          const items = res.data || []
          items.sort((a, b) => new Date(b.created_at || b.effective_date || 0) - new Date(a.created_at || a.effective_date || 0))
          setHistory(items)
        }
      })
      .catch(() => {
        if (isMounted) {
          const defaultItems = []
          const createdTime = product.created_at || new Date().toISOString()
          const updatedTime = product.updated_at || product.updated_price_date || createdTime

          if (product.updated_price) {
            defaultItems.push({
              id: 'h2',
              old_price: product.price,
              new_price: product.updated_price,
              effective_date: updatedTime,
              created_at: updatedTime,
              notes: 'Updated Price'
            })
          }
          if (product.price) {
            defaultItems.push({
              id: 'h1',
              old_price: null,
              new_price: product.price,
              effective_date: createdTime,
              created_at: createdTime,
              notes: 'Initial Base Price'
            })
          }
          defaultItems.sort((a, b) => new Date(b.created_at || b.effective_date || 0) - new Date(a.created_at || a.effective_date || 0))
          setHistory(defaultItems)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false)
      })

    setLoadingStock(true)
    api.get(`/products/${product.id}/stock-history`)
      .then(res => {
        if (isMounted) {
          setStockHistory(res.data || [])
        }
      })
      .catch(() => {
        if (isMounted) setStockHistory([])
      })
      .finally(() => {
        if (isMounted) setLoadingStock(false)
      })

    return () => { isMounted = false }
  }, [product.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Navigation & Product Title Header */}
      <div className="ws-unified-page-header" style={{ margin: '12px 0 0', padding: '8px 4px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 16 }}>
          <div className="attio-avatar" style={{ background: getAvatarColor(product.name), width: 32, height: 32, borderRadius: 6, fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            {getSingleLetter(product.name)}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{product.name}</h2>
          <span style={{
            background: catStyle.bg,
            color: catStyle.text,
            border: `1px solid ${catStyle.border}`,
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {product.category || 'General'}
          </span>
          <span style={{
            background: '#e0e7ff',
            color: '#3730a3',
            border: '1px solid #c7d2fe',
            padding: '3px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'lowercase'
          }}>
            {product.status || 'active'}
          </span>
        </div>

        <div className="ws-unified-header-actions">
          <button
            className="attio-btn attio-btn-primary"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} /> Back to Product History
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Symbols Removed) */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('price')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'price' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'price' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Price History ({history.length})
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'stock' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'stock' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Stock Movement & Deductions ({stockHistory.length})
        </button>
      </div>

      {activeTab === 'price' ? (
        <>
          {/* Top 3 Summary Cards (Symbols Removed) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Base Benchmark Price</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{formatINR(basePriceVal)}</p>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {pc > 0 ? `${pc} ${bulkUnit?.short || product.unit || 'kgs'} price` : (bagWeight > 1 ? `${bagWeight} ${bulkUnit?.short || product.unit || 'kgs'} pack price` : 'Original master list price')}
              </span>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Active Updated Price</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>
                {formatINR(updatedPriceVal)}
              </p>
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>
                {product.updated_price ? `Updated on ${updatedDateStr}${pc > 0 ? ` (${pc} ${bulkUnit?.short || product.unit || 'kgs'})` : (bagWeight > 1 ? ` (${bagWeight} ${bulkUnit?.short || product.unit || 'kgs'})` : '')}` : 'No price revision yet'}
              </span>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>Unit Rate Breakdown</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>
                {formatINR(unitPrice)} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e40af' }}>/ {bulkUnit ? bulkUnit.short : 'pcs'}</span>
              </p>
              <span style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                {bagWeight > 1 ? `${bulkUnit?.name || 'Pack'} (${bagWeight}${bulkUnit?.short || product.unit || 'kg'} pack)` : 'Individual Unit'}
              </span>
            </div>
          </div>

          {/* Full Page Table Card */}
          <div className="attio-table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Historical Price Log Table</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>Complete chronological record of all price updates and stock restock revisions.</p>
              </div>
              <span className="ws-unified-header-badge">{history.length} records</span>
            </div>

            <div className="attio-table-wrap">
              {loadingHistory ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                  <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : history.length === 0 ? (
                <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                  No price history records logged for this product yet.
                </div>
              ) : (
                <table className="attio-table">
                  <thead>
                    <tr>
                      <th>EFFECTIVE DATE</th>
                      <th>REVISED PRICE</th>
                      <th>PREVIOUS PRICE</th>
                      <th>PRICE CHANGE</th>
                      <th>UNIT RATE</th>
                      <th>REASON & NOTES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, idx) => {
                      const bw = Number.parseFloat(bagWeight || 1)
                      const pc = Number.parseFloat(product.price_covers || 0)
                      const uomShort = bulkUnit?.short || product.unit || 'unit'

                      const currDetails = getItemPriceDetails(row.new_price, bw, pc)

                      let oldRaw = row.old_price !== null && row.old_price !== undefined ? row.old_price : null
                      if ((oldRaw === null || oldRaw === row.new_price) && idx < history.length - 1) {
                        const nextOldItem = history[idx + 1]
                        if (nextOldItem && nextOldItem.new_price) {
                          oldRaw = nextOldItem.new_price
                        }
                      }
                      const prevDetails = getItemPriceDetails(oldRaw, bw, pc)

                      const diff100 = (currDetails && prevDetails) ? (currDetails.price100 - prevDetails.price100) : 0
                      const diffPack = (currDetails && prevDetails) ? (currDetails.packPrice - prevDetails.packPrice) : 0
                      const isUp = diff100 > 0
                      const dateStr = formatIndianDateTime(row.created_at || row.effective_date)

                      return (
                        <tr key={row.id || idx}>
                          <td>
                            <div style={{ color: '#334155', fontWeight: 600, fontSize: '0.8125rem' }}>
                              {dateStr}
                            </div>
                          </td>
                          <td>
                            {currDetails ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>
                                  {formatINR(currDetails.price100)} <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>/ {pc} {uomShort}</span>
                                </span>
                                {bw > 1 && (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    {formatINR(currDetails.packPrice)} / {bw} {uomShort} pack
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>—</span>
                            )}
                          </td>
                          <td>
                            {prevDetails ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                                  {formatINR(prevDetails.price100)} / {pc} {uomShort}
                                </span>
                                {bw > 1 && (
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    {formatINR(prevDetails.packPrice)} / {bw} {uomShort}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            {prevDetails && diff100 !== 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: isUp ? '#15803d' : '#dc2626',
                                  background: isUp ? '#dcfce7' : '#fee2e2',
                                  border: `1px solid ${isUp ? '#bbf7d0' : '#fecaca'}`,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}>
                                  {isUp ? `Price Up +${formatINR(diff100)} / ${pc} ${uomShort}` : `Price Drop -${formatINR(Math.abs(diff100))} / ${pc} ${uomShort}`}
                                </span>
                                {bw > 1 && (
                                  <span style={{ fontSize: '0.7rem', color: isUp ? '#166534' : '#b91c1c', marginTop: 2, fontWeight: 500 }}>
                                    {isUp ? `+${formatINR(diffPack)} (${bw}${uomShort} pack)` : `-${formatINR(Math.abs(diffPack))} (${bw}${uomShort} pack)`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Initial Benchmark</span>
                            )}
                          </td>
                          <td>
                            {currDetails ? (
                              <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.85rem' }}>
                                {formatINR(currDetails.unitRate)} / {uomShort}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ color: '#475467', fontSize: '0.8125rem' }}>
                              {row.notes || 'Price adjustment'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Stock Movement Tab */
        <div className="attio-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Stock Movement & Deduction History</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>Tracks how stock was deducted from Quotes, Billing, or added from Stock Imports.</p>
            </div>
            <span className="ws-unified-header-badge">{stockHistory.length} events</span>
          </div>

          <div className="attio-table-wrap">
            {loadingStock ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : stockHistory.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                No stock movement logs recorded yet for this product. Stock deductions will automatically appear here when quotes are accepted or billing is created.
              </div>
            ) : (
              <table className="attio-table">
                <thead>
                  <tr>
                    <th>DATE & TIME</th>
                    <th>TYPE</th>
                    <th>QTY CHANGE</th>
                    <th>STOCK AFTER</th>
                    <th>SOURCE</th>
                    <th>DETAILS / REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {stockHistory.map((s, idx) => {
                    const isDeducted = s.change_type === 'deducted' || Number.parseFloat(s.qty_change) < 0
                    const qtyVal = Math.abs(Number.parseFloat(s.qty_change || 0))
                    const dateStr = formatIndianDateTime(s.created_at)

                    return (
                      <tr key={s.id || idx}>
                        <td>
                          <div style={{ color: '#334155', fontWeight: 600, fontSize: '0.8125rem' }}>
                            {dateStr}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: isDeducted ? '#fee2e2' : '#dcfce7',
                            color: isDeducted ? '#dc2626' : '#15803d',
                            border: `1px solid ${isDeducted ? '#fecaca' : '#bbf7d0'}`
                          }}>
                            {isDeducted ? 'Stock Deducted' : 'Stock Added'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: isDeducted ? '#dc2626' : '#15803d' }}>
                            {(() => {
                              const sign = isDeducted ? '- ' : '+ '
                              const notes = s.notes || ''
                              let unitLabel = ''

                              if (notes) {
                                const matchUnit = notes.match(/(?:Deducted|Added|Adjusted|Imported)\s+\d+(?:\.\d+)?\s+([a-z]+)/i)
                                if (matchUnit && matchUnit[1]) {
                                  const u = matchUnit[1].trim()
                                  if (['bag', 'bags', 'kg', 'kgs', 'ltr', 'ltrs', 'box', 'boxes', 'pc', 'pcs', 'roll', 'rolls', 'drum', 'drums'].includes(u.toLowerCase())) {
                                    unitLabel = u
                                  }
                                }
                              }

                              if (!unitLabel) {
                                const bw = Number.parseFloat(product?.bag_weight || 1)
                                if (bw > 1) {
                                  unitLabel = qtyVal === 1 ? 'Bag' : 'Bags'
                                } else {
                                  unitLabel = product?.unit || 'pcs'
                                }
                              }

                              return `${sign}${qtyVal} ${unitLabel}`
                            })()}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {formatStockDisplay(s.stock_after ?? product.stock, product.bag_weight, product.unit, s.loose_kg_after !== undefined && s.loose_kg_after !== null ? s.loose_kg_after : 0)}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {s.source || 'Quote / Order'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#475467', fontSize: '0.8125rem' }}>
                            {(s.notes || 'Automated stock deduction on quotation acceptance').replace(/\.00\b/g, '')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PriceHistory() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPricing, setSelectedPricing] = useState(null)

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [showFilterBar, setShowFilterBar] = useState(false)

  const totalPages = Math.ceil(total / limit) || 1
  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 2) {
        pages.push(1, 2, 3, '...', totalPages)
      } else if (page >= totalPages - 1) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
      }
    }
    return pages
  }

  const fetchProducts = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await api.get(`/products?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&category=${filterCategory}&status=${filterStatus}`)
      setProducts(res.data?.data || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Unknown error'
      dispatch(addToast({ message: `Failed to load product history: ${errMsg}`, type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    dispatch(setActiveNav('Product History'))
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterCategory, filterStatus])

  const getStockBadgeClass = (stock, looseKg = 0, bagWeight = 1) => {
    const s = Number.parseFloat(stock || 0)
    const l = Number.parseFloat(looseKg || 0)
    const bw = Number.parseFloat(bagWeight || 1)
    const totalBase = (bw > 1 ? s * bw : s) + l
    if (totalBase > 10) return 'attio-stock-high'
    if (totalBase > 0) return 'attio-stock-low'
    return 'attio-stock-out'
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">
            {selectedPricing ? (
              <ProductPriceHistoryDetail
                product={selectedPricing}
                onBack={() => setSelectedPricing(null)}
              />
            ) : (
              <>
                {/* Top Toolbar */}
                <div className="ws-unified-page-header">
                  <div className="ws-unified-header-left">
                    <span className="ws-unified-header-title">Product History</span>
                    <span className="ws-unified-header-badge">{total} products</span>
                  </div>
                  <div className="ws-unified-header-actions">
                    {/* Search box */}
                    <div className="attio-search-box">
                      <Search size={14} className="attio-search-icon" />
                      <input
                        type="text"
                        className="attio-input-search"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      />
                    </div>

                    {/* Sort button */}
                    <button
                      className="attio-btn"
                      onClick={() => {
                        setSort(prev => prev === 'name_asc' ? 'name_desc' : prev === 'name_desc' ? '' : 'name_asc');
                        setPage(1);
                      }}
                      style={{
                        background: sort ? '#f1f5f9' : '#ffffff',
                        borderColor: sort ? '#0f172a' : '#cbd5e1',
                        fontWeight: sort ? 600 : 500
                      }}
                    >
                      <ArrowUpDown size={13} />
                      Sort {sort === 'name_asc' ? 'A-Z' : sort === 'name_desc' ? 'Z-A' : ''}
                    </button>

                    {/* Filter button */}
                    <button
                      className="attio-btn"
                      onClick={() => setShowFilterBar(prev => !prev)}
                      style={{
                        background: showFilterBar || filterCategory || filterStatus !== 'active' ? '#f1f5f9' : '#ffffff',
                        borderColor: showFilterBar || filterCategory || filterStatus !== 'active' ? '#0f172a' : '#cbd5e1',
                        fontWeight: showFilterBar || filterCategory || filterStatus !== 'active' ? 600 : 500
                      }}
                    >
                      <Filter size={13} /> Filter
                    </button>

                    <button className="attio-btn attio-btn-primary" onClick={() => navigate('/import-stock')}>
                      Return to Import Stock
                    </button>
                  </div>
                </div>

                {/* Expandable Filter Box */}
                {showFilterBar && (
                  <div className="attio-filter-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                      <span>Category:</span>
                      <select
                        className="attio-select"
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                      >
                        <option value="">All Categories</option>
                        <option value="Food">Food</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Grocery">Grocery</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                      <span>Status:</span>
                      <select
                        className="attio-select"
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {(filterCategory || filterStatus !== 'active') && (
                      <button
                        className="attio-btn"
                        onClick={() => { setFilterCategory(''); setFilterStatus('active'); setPage(1); }}
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      >
                        <X size={12} /> Clear Filters
                      </button>
                    )}
                  </div>
                )}

                {/* Main Table Card */}
                <div className="attio-table-card">
                  <div className="attio-table-wrap">
                    {loading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                        <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : products.length === 0 ? (
                      <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                        No product history records found.
                      </div>
                    ) : (
                      <table className="attio-table">
                        <thead>
                          <tr>
                            <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                              <input type="checkbox" className="attio-chk" readOnly />
                            </th>
                            <th>PRODUCT NAME</th>
                            <th>CATEGORY</th>
                            <th>PRICE</th>
                            <th>UPDATED PRICE</th>
                            <th>PRICE TREND</th>
                            <th>STOCK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map(row => {
                            const catStyle = getCategoryTagStyle(row.category)

                            return (
                              <tr key={row.id}>
                                <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                                  <input type="checkbox" className="attio-chk" readOnly />
                                </td>
                                <td>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                    onClick={() => setSelectedPricing(row)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPricing(row) }}
                                    title="Click to view detailed price & stock history"
                                  >
                                    <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                      {getSingleLetter(row.name)}
                                    </div>
                                    <span
                                      style={{
                                        fontWeight: 535,
                                        fontSize: '0.89rem',
                                        color: '#2563eb',
                                        transition: 'color 0.15s ease'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                      {row.name}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span style={{
                                    background: catStyle.bg,
                                    color: catStyle.text,
                                    border: `1px solid ${catStyle.border}`,
                                    padding: '4px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    display: 'inline-block'
                                  }}>
                                    {row.category || 'General'}
                                  </span>
                                </td>
                                <td>
                                  {(() => {
                                    const bulkUnit = getBulkUnitDetails(row.unit)
                                    const uomShort = (bulkUnit?.short || row.unit || 'kg').toLowerCase().replace(/s$/, '')
                                    const pc = Number.parseFloat(row.price_covers || 0)
                                    const bw = Number.parseFloat(row.bag_weight || 1)
                                    const priceVal = getDisplayPrice(row.price, bw, pc)

                                    const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                          {formatINR(priceVal)}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                          {subtext}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </td>
                                <td>
                                  {(() => {
                                    if (!row.updated_price) return <span style={{ color: '#9ca3af' }}>—</span>
                                    const bulkUnit = getBulkUnitDetails(row.unit)
                                    const uomShort = (bulkUnit?.short || row.unit || 'kg').toLowerCase().replace(/s$/, '')
                                    const pc = Number.parseFloat(row.price_covers || 0)
                                    const bw = Number.parseFloat(row.bag_weight || 1)
                                    const updatedPriceVal = getDisplayPrice(row.updated_price, bw, pc)

                                    const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, color: '#2563eb' }}>
                                          {formatINR(updatedPriceVal)}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                          {subtext}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </td>
                                <td>
                                  {(() => {
                                    const pc = Number.parseFloat(row.price_covers || 100)
                                    const bw = Number.parseFloat(row.bag_weight || 1)
                                    const baseDisplay = getDisplayPrice(row.price, bw, pc)
                                    const updDisplay = row.updated_price ? getDisplayPrice(row.updated_price, bw, pc) : null

                                    return renderPriceTrendGraph(baseDisplay, updDisplay, row.id)
                                  })()}
                                </td>
                                <td>
                                  <span className={`attio-stock-badge ${getStockBadgeClass(row.stock, row.loose_kg, row.bag_weight)}`}>
                                    {formatStockDisplay(row.stock, row.bag_weight, row.unit, row.loose_kg)}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Table Footer */}
                  <TablePagination
                    page={page}
                    setPage={setPage}
                    total={total}
                    limit={limit}
                    getPageNumbers={getPageNumbers}
                    totalPages={totalPages}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
