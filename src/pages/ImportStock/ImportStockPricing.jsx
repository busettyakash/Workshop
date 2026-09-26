import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Loader2, ArrowLeft } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails, formatStockDisplay } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'

const formatINR = (val) => {
  if (val === null || val === undefined || val === '') return '—'
  const num = Number.parseFloat(val)
  if (Number.isNaN(num)) return '—'
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatIndianDateTime = (raw) => {
  if (!raw) return 'N/A'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return String(raw)
  }
}

function computeBuyRatePerUnit(rawBP, pc, bagWeight) {
  if (rawBP <= 0) return '0.00'
  if (pc > 0) return (rawBP / pc).toFixed(2)
  if (bagWeight > 0) return (rawBP / bagWeight).toFixed(2)
  return '0.00'
}

function computeSellRatePerUnit(sellingPriceVal, pc, bagWeight) {
  if (pc > 0) return (sellingPriceVal / pc).toFixed(2)
  if (bagWeight > 0) return (sellingPriceVal / bagWeight).toFixed(2)
  return sellingPriceVal.toFixed(2)
}

function getStatusBadgeStyle(status) {
  if (status === 'active') {
    return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
  }
  if (status === 'added') {
    return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }
  }
  return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }
}

function getBuyingPriceSubtext(rawBP, pc, buyRatePerUnit, uomShort) {
  if (rawBP <= 0) return 'Purchase price from supplier'
  if (pc > 0) return `₹${buyRatePerUnit} / ${uomShort} cost (${pc} ${uomShort} batch)`
  return `₹${buyRatePerUnit} / ${uomShort} cost`
}

function computeHistoryUnitRate(curPrice, displayCoveragePrice, pc, bagWeight) {
  if (pc > 0) return (displayCoveragePrice / pc).toFixed(2)
  if (bagWeight > 0) return (curPrice / bagWeight).toFixed(2)
  return curPrice.toFixed(2)
}

export default function ImportStockPricing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [item, setItem] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    fetchItem()
  }, [id, dispatch])

  const fetchItem = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/import-stock/${id}`)
      const stockItem = res.data?.data
      if (stockItem) {
        setItem(stockItem)
        fetchHistory(stockItem)
      } else {
        dispatch(addToast({ message: 'Stock product not found', type: 'error' }))
        navigate('/import-stock')
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error loading stock'
      dispatch(addToast({ message: `Failed to load stock details: ${msg}`, type: 'error' }))
      navigate('/import-stock')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (stockItem) => {
    setLoadingHistory(true)
    const targetId = stockItem?.product_id || stockItem?.id
    try {
      const res = await api.get(`/products/${targetId}/price-history`)
      if (Array.isArray(res.data) && res.data.length > 0) {
        const sorted = [...res.data].sort((a, b) => new Date(b.created_at || b.effective_date || 0) - new Date(a.created_at || a.effective_date || 0))
        setHistory(sorted)
      } else {
        createDefaultHistory(stockItem)
      }
    } catch {
      createDefaultHistory(stockItem)
    } finally {
      setLoadingHistory(false)
    }
  }

  const createDefaultHistory = (stockItem) => {
    const defaultItems = []
    const updatedDate = stockItem?.updated_price_date || stockItem?.updated_at || new Date().toISOString()
    const createdDate = stockItem?.created_at || new Date().toISOString()

    if (stockItem?.updated_price) {
      defaultItems.push({
        id: 'h2',
        old_price: stockItem.price,
        new_price: stockItem.updated_price,
        effective_date: updatedDate,
        created_at: updatedDate,
        notes: 'Active Updated Price'
      })
    }
    if (stockItem?.price) {
      defaultItems.push({
        id: 'h1',
        old_price: null,
        new_price: stockItem.price,
        effective_date: createdDate,
        created_at: createdDate,
        notes: 'Initial Base Price'
      })
    }
    setHistory(defaultItems)
  }

  if (loading) {
    return (
      <div className="ws-dash-layout">
        <Sidebar />
        <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Topbar />
          <main className="ws-dash-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <Loader2 size={32} className="ws-chat-loader-spin" style={{ color: '#2563eb' }} />
          </main>
        </div>
      </div>
    )
  }

  if (!item) return null

  // Unit and weight calculations
  const bulkUnit = getBulkUnitDetails(item.unit)
  const uomShort = (bulkUnit?.short || item.unit || 'kg').toLowerCase().replace(/s$/, '')
  const bagWeight = Number.parseFloat(item.bag_weight || 1)
  const pc = Number.parseFloat(item.price_covers || 0)

  // Prices
  const rawBP = Number.parseFloat(item.buying_price || 0)
  const rawP = Number.parseFloat(item.price || 0)
  const rawUP = Number.parseFloat(item.updated_price || 0)

  // Selling rate (per price_covers, e.g. 100 kg)
  let sellingPriceVal = rawP
  if (pc > 0 && bagWeight > 0 && pc !== bagWeight) {
    sellingPriceVal = (rawP / bagWeight) * pc
  }

  // Updated rate (per price_covers, e.g. 100 kg)
  let updatedPriceVal = rawUP
  if (pc > 0 && bagWeight > 0 && pc !== bagWeight && rawUP > 0) {
    updatedPriceVal = (rawUP / bagWeight) * pc
  }

  // Per bag price (single pack / bag)
  const perBagPriceVal = rawP

  // Rates per 1 unit (e.g. per 1 kg)
  const buyRatePerUnit = computeBuyRatePerUnit(rawBP, pc, bagWeight)
  const sellRatePerUnit = computeSellRatePerUnit(sellingPriceVal, pc, bagWeight)
  const activeRatePerUnit = (rawUP > 0 && pc > 0) ? (updatedPriceVal / pc).toFixed(2) : sellRatePerUnit

  const catStyle = getCategoryTagStyle(item.category)
  const statusBadgeStyle = getStatusBadgeStyle(item.status)
  const stockDisplay = formatStockDisplay(item.stock, item.bag_weight, item.unit, item.loose_kg)

  const renderHistoryTable = () => {
    if (loadingHistory) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={24} className="ws-chat-loader-spin" style={{ color: '#2563eb' }} />
        </div>
      )
    }
    if (history.length === 0) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          No historical price records found.
        </div>
      )
    }
    return (
      <table className="attio-table">
        <thead>
          <tr>
            <th>EFFECTIVE DATE</th>
            <th>PRICE / RATE</th>
            <th>PER BAG PRICE</th>
            <th>UNIT RATE</th>
            <th>DIFFERENCE</th>
            <th>REVISION NOTES</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row, idx) => {
            const prevRow = history[idx + 1]
            const curPrice = Number.parseFloat(row.new_price || 0)
            const prevPrice = prevRow ? Number.parseFloat(prevRow.new_price || 0) : null
            const diff = prevPrice !== null ? (curPrice - prevPrice) : 0
            const isUp = diff > 0

            // Calculate rates
            const bagPrice = curPrice
            let displayCoveragePrice = curPrice
            if (pc > 0 && bagWeight > 0 && pc !== bagWeight) {
              displayCoveragePrice = (curPrice / bagWeight) * pc
            }
            const unitRate = computeHistoryUnitRate(curPrice, displayCoveragePrice, pc, bagWeight)

            const dateStr = formatIndianDateTime(row.created_at || row.effective_date)

            return (
              <tr key={row.id || idx}>
                <td>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                    {dateStr}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                      {formatINR(displayCoveragePrice)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                      {pc > 0 ? `${pc} ${uomShort} rate` : `Per ${uomShort}`}
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: '#15803d', fontSize: '0.88rem' }}>
                      {formatINR(bagPrice)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                      Per {bagWeight} {uomShort} bag
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.85rem' }}>
                    ₹{unitRate} / {uomShort}
                  </span>
                </td>
                <td>
                  {prevPrice !== null && diff !== 0 ? (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: isUp ? '#dcfce7' : '#fee2e2',
                      color: isUp ? '#15803d' : '#dc2626',
                      border: `1px solid ${isUp ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      {isUp ? `+${formatINR(diff)}` : `-${formatINR(Math.abs(diff))}`}
                    </span>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
                      Initial Benchmark
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ color: '#475569', fontSize: '0.8125rem' }}>
                    {row.notes || 'Price adjustment'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body" style={{ padding: '24px 32px' }}>
          
          {/* Top Bar Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="attio-avatar" style={{ background: getAvatarColor(item.name), width: 34, height: 34, fontSize: '0.95rem' }}>
                {getSingleLetter(item.name)}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {item.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                    HSN: <strong style={{ color: '#334155' }}>{item.hsn_code || item.sku || '—'}</strong>
                  </span>
                  <span className="attio-category-tag" style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, borderRadius: 4, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                    {item.category || 'General'}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '1px 8px',
                    borderRadius: 4,
                    background: statusBadgeStyle.background,
                    color: statusBadgeStyle.color,
                    border: statusBadgeStyle.border
                  }}>
                    {item.status ? item.status.toUpperCase() : 'PENDING'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="attio-btn"
                onClick={() => navigate('/import-stock')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 12px' }}
              >
                <ArrowLeft size={13} /> Back to Import Stock
              </button>
              <button
                type="button"
                className="attio-btn"
                onClick={() => navigate(`/import-stock/${item.id}/note`)}
                style={{ display: 'inline-flex', alignItems: 'center', height: 32, fontSize: '0.78rem', padding: '0 12px', fontWeight: 600 }}
              >
                Supplier Details & Note
              </button>
              <button
                type="button"
                className="attio-btn attio-btn-primary"
                onClick={() => navigate(`/import-stock/edit/${item.id}`)}
                style={{ display: 'inline-flex', alignItems: 'center', height: 32, fontSize: '0.78rem', padding: '0 12px', fontWeight: 600 }}
              >
                Edit Product
              </button>
            </div>
          </div>

          {/* 4 Pricing KPI Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
            
            {/* 1. Buying Price Card */}
            <div style={{
              background: '#fffdf5',
              border: '1px solid #fef08a',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Buying Price (Cost)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#713f12' }}>
                {rawBP > 0 ? formatINR(rawBP) : '—'}
              </p>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#a16207', marginTop: 4, fontWeight: 500 }}>
                {getBuyingPriceSubtext(rawBP, pc, buyRatePerUnit, uomShort)}
              </span>
            </div>

            {/* 2. Selling Price Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Selling Price
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {sellingPriceVal > 0 ? formatINR(sellingPriceVal) : '—'}
              </p>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                {pc > 0 ? `${pc} ${uomShort} rate (₹${sellRatePerUnit} / ${uomShort})` : `Per ${uomShort} market price`}
              </span>
            </div>

            {/* 3. Per Bag Price Card */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Per Bag Price
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#15803d' }}>
                {perBagPriceVal > 0 ? formatINR(perBagPriceVal) : '—'}
              </p>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#15803d', marginTop: 4, fontWeight: 500 }}>
                {bagWeight > 1 ? `Per 1 bag (${bagWeight} ${uomShort})` : `Per single ${uomShort}`}
              </span>
            </div>

            {/* 4. Updated Price Card */}
            <div style={{
              background: rawUP > 0 ? '#f0fdfa' : '#f8fafc',
              border: `1px solid ${rawUP > 0 ? '#99f6e4' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rawUP > 0 ? '#0f766e' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Updated Price
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: rawUP > 0 ? '#0f766e' : '#94a3b8' }}>
                {rawUP > 0 ? formatINR(updatedPriceVal) : '—'}
              </p>
              <span style={{ display: 'block', fontSize: '0.75rem', color: rawUP > 0 ? '#115e59' : '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                {rawUP > 0 ? `Effective rate: ₹${activeRatePerUnit} / ${uomShort}` : 'No price revision'}
              </span>
            </div>

          </div>

          {/* Package Breakdown & Margin Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: rawBP > 0 ? '1.5fr 1fr' : '1fr',
            gap: 14,
            marginBottom: 20
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '12px 18px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, display: 'block' }}>
                  Package Breakdown & Specifications
                </span>
                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
                  {bulkUnit ? bulkUnit.name : 'Standard Unit'}: <strong>{bagWeight} {uomShort}</strong> per pack • Current Stock: <strong style={{ color: '#16a34a' }}>{stockDisplay}</strong>
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Base Unit Rate</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>
                  ₹{sellRatePerUnit} / {uomShort}
                </span>
              </div>
            </div>

            {rawBP > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fdf4ff',
                border: '1px solid #f0abfc',
                borderRadius: 8,
                padding: '12px 18px'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#86198f', fontWeight: 600, display: 'block' }}>
                    Profit Margin per {pc > 0 ? `${pc} ${uomShort}` : 'Pack'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#701a75', fontWeight: 700 }}>
                    {sellingPriceVal > rawBP ? `+${formatINR(sellingPriceVal - rawBP)} gross margin` : `${formatINR(sellingPriceVal - rawBP)} margin`}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', color: '#86198f', display: 'block' }}>Markup %</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#a21caf' }}>
                    {rawBP > 0 ? `${(((sellingPriceVal - rawBP) / rawBP) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Price History Log Table Card */}
          <div className="attio-table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Price History Log
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Complete chronological timeline of price changes and market revisions for {item.name}.
                </p>
              </div>
              <span className="ws-unified-header-badge">
                {history.length} record{history.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="attio-table-wrap">
              {renderHistoryTable()}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
