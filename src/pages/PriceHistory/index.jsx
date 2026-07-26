import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Filter, ArrowUpDown, X, Loader2, Search, Eye, ArrowLeft, History, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, ShoppingCart } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle, getPillStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'
import TablePagination from '../../components/ui/TablePagination'

const formatINR = (val) => {
  if (val === null || val === undefined || val === '') return '—'
  const num = parseFloat(val)
  if (isNaN(num)) return '—'
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatIndianDateTime = (raw) => {
  if (!raw) return 'N/A'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return String(raw)
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
    const d = new Date(raw)
    if (isNaN(d.getTime())) return String(raw)
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

const renderPriceTrendGraph = (baseP, updatedP, rowId) => {
  const b = parseFloat(baseP || 0)
  const u = updatedP !== null && updatedP !== undefined && updatedP !== '' ? parseFloat(updatedP) : null
  const diff = u !== null ? (u - b) : 0
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
            <TrendingUp size={11} /> +₹{absDiffFormatted} ({pct}%)
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
            <TrendingDown size={11} /> -₹{absDiffFormatted} ({pct}%)
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
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const bulkUnit = getBulkUnitDetails(product.unit)
  const bagWeight = parseFloat(product.bag_weight || 1)
  const effectivePrice = parseFloat(product.updated_price || product.price || 0)
  const unitPrice = (effectivePrice / bagWeight).toFixed(2)
  const latestLog = history.find(h => h.notes !== 'Initial Base Price') || history[0]
  const updatedDateStr = formatIndianDateOnly(latestLog?.created_at || latestLog?.effective_date || product.updated_at || product.updated_price_date)
  const catStyle = getCategoryTagStyle(product.category)

  useEffect(() => {
    let isMounted = true
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
            {product.status || 'added'}
          </span>
        </div>

        <div className="ws-unified-header-actions">
          <button 
            className="attio-btn attio-btn-primary" 
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} /> Back to Price History
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Base Benchmark Price</span>
            <DollarSign size={16} style={{ color: '#64748b' }} />
          </div>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{formatINR(product.price)}</p>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Original master list price</span>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Active Updated Price</span>
            <TrendingUp size={16} style={{ color: '#15803d' }} />
          </div>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>
            {formatINR(product.updated_price || product.price)}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#166534' }}>
            {product.updated_price ? `Updated on ${updatedDateStr}` : 'No price revision yet'}
          </span>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>Unit Rate Breakdown</span>
            <Tag size={16} style={{ color: '#2563eb' }} />
          </div>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>
            {formatINR(unitPrice)} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e40af' }}>/ {bulkUnit ? bulkUnit.short : 'pcs'}</span>
          </p>
          <span style={{ fontSize: '0.75rem', color: '#1e40af' }}>
            {bulkUnit ? `${bulkUnit.name} (${bagWeight}${bulkUnit.short} pack)` : 'Individual Unit'}
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
                  const newP = parseFloat(row.new_price || 0)
                  let oldP = row.old_price !== null && row.old_price !== undefined ? parseFloat(row.old_price) : null
                  if ((oldP === null || oldP === newP) && idx < history.length - 1) {
                    const nextOldItem = history[idx + 1]
                    if (nextOldItem && nextOldItem.new_price && parseFloat(nextOldItem.new_price) !== newP) {
                      oldP = parseFloat(nextOldItem.new_price)
                    }
                  }
                  const diff = oldP !== null && oldP !== newP ? (newP - oldP) : 0
                  const isUp = diff > 0
                  const itemUnitPrice = bulkUnit ? (newP / bagWeight).toFixed(2) : null
                  const dateStr = formatIndianDateTime(row.created_at || row.effective_date)

                  return (
                    <tr key={row.id || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600, fontSize: '0.8125rem' }}>
                          <Calendar size={13} style={{ color: '#64748b' }} />
                          {dateStr}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          {formatINR(newP)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: oldP !== null && oldP !== newP ? '#64748b' : '#9ca3af', fontSize: '0.85rem' }}>
                          {oldP !== null && oldP !== newP ? formatINR(oldP) : '—'}
                        </span>
                      </td>
                      <td>
                        {oldP !== null && diff !== 0 ? (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 700, 
                            color: isUp ? '#15803d' : '#dc2626', 
                            background: isUp ? '#dcfce7' : '#fee2e2', 
                            border: `1px solid ${isUp ? '#bbf7d0' : '#fecaca'}`,
                            padding: '3px 8px', 
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {isUp ? `+${formatINR(diff)}` : `-${formatINR(Math.abs(diff))}`}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Initial Benchmark</span>
                        )}
                      </td>
                      <td>
                        {itemUnitPrice ? (
                          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.85rem' }}>
                            {formatINR(itemUnitPrice)} / {bulkUnit.short}
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
      dispatch(addToast({ message: 'Failed to load price history products', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    dispatch(setActiveNav('Price History')) 
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterCategory, filterStatus])

  const getStockBadgeClass = (stock) => {
    if (stock > 10) return 'attio-stock-high'
    if (stock > 0) return 'attio-stock-low'
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
                    <span className="ws-unified-header-title">Price History</span>
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
                        onClick={() => { setFilterCategory(''); setFilterStatus('active'); setPage(1); }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                )}

                {/* CRM Table Card Box */}
                <div className="attio-table-card">
                  <div className="attio-table-wrap">
                    {loading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                        <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : products.length === 0 ? (
                      <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                        No products found.
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
                            const bulkUnit = getBulkUnitDetails(row.unit)
                            const bagWeight = parseFloat(row.bag_weight || 1)
                            const updatedDateFormatted = row.updated_price ? formatIndianDateOnly(row.updated_price_date || row.updated_at) : ''
                            const catStyle = getCategoryTagStyle(row.category)

                            return (
                              <tr key={row.id}>
                                <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                                  <input type="checkbox" className="attio-chk" readOnly />
                                </td>
                                <td>
                                  <div 
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                    onClick={() => setSelectedPricing(row)}
                                    title="Click to view detailed price history"
                                  >
                                    <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                      {getSingleLetter(row.name)}
                                    </div>
                                    <span 
                                      style={{ 
                                        fontWeight: 600, 
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
                                  <span style={{ fontWeight: 500, color: '#1e293b' }}>
                                    {formatINR(row.price)} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.unit ? `/ ${row.unit}` : ''}</span>
                                  </span>
                                </td>
                                <td>
                                  {row.updated_price ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem' }}>
                                        {formatINR(row.updated_price)}
                                      </span>
                                      {updatedDateFormatted && (
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                          {updatedDateFormatted}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {renderPriceTrendGraph(row.price, row.updated_price, row.id)}
                                </td>
                                <td>
                                  <span className={`attio-stock-badge ${getStockBadgeClass(row.stock)}`}>
                                    {row.stock} {bulkUnit && bagWeight > 1 ? (row.stock === 1 ? 'Bag' : 'Bags') : (row.unit || 'pcs')}
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
