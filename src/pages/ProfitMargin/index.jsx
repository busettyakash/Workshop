import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { 
  Filter, ArrowUpDown, Download, Loader2, 
  Search, Package, TrendingUp, TrendingDown 
} from 'lucide-react'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { formatStockDisplay } from '../../utils/unitHelpers'
import { usePermissions, getFirstAccessibleRoute } from '../../utils/permissionUtils'
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

export default function ProfitMargin() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { canRead, role, permissions } = usePermissions('profit_margin')

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & Sorting matching Products / ImportStock
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [sort, setSort] = useState('margin_desc')
  const [showFilterBar, setShowFilterBar] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 10

  const fetchMargins = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/profit-margin')
      setProducts(res.data || [])
      setError(null)
    } catch (err) {
      console.error('[PROFIT MARGIN FETCH ERROR]', err)
      setError(err.response?.data?.error || err.message)
      dispatch(addToast({ message: 'Failed to load profit margin data', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    if (!canRead) {
      navigate(getFirstAccessibleRoute(permissions, role), { replace: true })
      return
    }
    dispatch(setActiveNav('Profit Margin'))
    fetchMargins()
  }, [dispatch, fetchMargins, canRead, navigate, permissions, role])

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [products])

  // Filtered and sorted data
  const filteredProducts = useMemo(() => {
    let list = [...products]

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.buyer_name && p.buyer_name.toLowerCase().includes(q))
      )
    }

    if (filterCategory !== 'all') {
      list = list.filter(p => p.category === filterCategory)
    }

    if (filterTier !== 'all') {
      if (filterTier === 'high') {
        list = list.filter(p => p.margin_pct >= 20)
      } else if (filterTier === 'healthy') {
        list = list.filter(p => p.margin_pct >= 10 && p.margin_pct < 20)
      } else if (filterTier === 'low') {
        list = list.filter(p => p.margin_pct >= 0 && p.margin_pct < 10)
      } else if (filterTier === 'loss') {
        list = list.filter(p => p.margin_pct < 0)
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === 'margin_desc') return b.margin_pct - a.margin_pct
      if (sort === 'margin_asc') return a.margin_pct - b.margin_pct
      if (sort === 'profit_desc') return b.total_potential_profit - a.total_potential_profit
      if (sort === 'margin_unit_desc') return b.margin_per_unit - a.margin_per_unit
      if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '')
      return 0
    })

    return list
  }, [products, search, filterCategory, filterTier, sort])

  // Pagination slice
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * limit
    return filteredProducts.slice(start, start + limit)
  }, [filteredProducts, page, limit])

  const totalPages = Math.ceil(filteredProducts.length / limit) || 1

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

  const getStockBadgeClass = (stock, looseKg = 0, bagWeight = 1) => {
    const s = parseFloat(stock || 0)
    const l = parseFloat(looseKg || 0)
    const bw = parseFloat(bagWeight || 1)
    const totalBase = (bw > 1 ? s * bw : s) + l
    if (totalBase > 10) return 'attio-stock-high'
    if (totalBase > 0) return 'attio-stock-low'
    return 'attio-stock-out'
  }

  // CSV Export handler
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      dispatch(addToast({ message: 'No records to export', type: 'info' }))
      return
    }

    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'Stock (Bags / Units)',
      'Loose Qty',
      'Total Units In Hand',
      'Unit',
      'Buyer Price (Package)',
      'Seller Price (Package)',
      'Buyer Cost Per Unit',
      'Seller Rate Per Unit',
      'Profit Margin Per Unit (INR)',
      'Profit Margin (%)',
      'Present Stock Profit (INR)',
      'Full Stock Profit (INR)',
      'Supplier'
    ]

    const rows = filteredProducts.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.sku || ''}"`,
      `"${p.category || ''}"`,
      p.stock || 0,
      p.loose_kg || 0,
      p.present_units || p.total_units_in_stock || 0,
      p.unit || '',
      p.buyer_price || 0,
      p.seller_price || 0,
      p.buy_rate_per_unit || 0,
      p.sell_rate_per_unit || 0,
      p.margin_per_unit || 0,
      `${p.margin_pct || 0}%`,
      p.present_profit !== undefined ? p.present_profit : p.total_potential_profit || 0,
      p.full_stock_profit || 0,
      `"${(p.buyer_name || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `profit_margins_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    dispatch(addToast({ message: 'Profit margins exported to CSV', type: 'success' }))
  }

  const hasActiveFilters = filterCategory !== 'all' || filterTier !== 'all'

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">

            {/* Top Toolbar matching Products / ImportStock */}
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Profit Margin</span>
                <span className="ws-unified-header-badge">{filteredProducts.length} items</span>
              </div>

              <div className="ws-unified-header-actions">
                {/* Search Box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search profit margin..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>

                {/* Sort Button */}
                <button 
                  type="button"
                  className="attio-btn"
                  onClick={() => {
                    setSort(prev => {
                      if (prev === 'margin_desc') return 'margin_asc'
                      if (prev === 'margin_asc') return 'profit_desc'
                      if (prev === 'profit_desc') return 'name_asc'
                      return 'margin_desc'
                    })
                    setPage(1)
                  }}
                  style={{
                    background: sort !== 'margin_desc' ? '#f1f5f9' : '#ffffff',
                    borderColor: sort !== 'margin_desc' ? '#0f172a' : '#cbd5e1',
                    fontWeight: sort !== 'margin_desc' ? 600 : 500
                  }}
                  title="Cycle sort orders"
                >
                  <ArrowUpDown size={13} />
                  Sort: {
                    sort === 'margin_desc' ? 'Margin % High-Low' : 
                    sort === 'margin_asc' ? 'Margin % Low-High' : 
                    sort === 'profit_desc' ? 'Potential Profit High-Low' : 'Name A-Z'
                  }
                </button>

                {/* Filter Button */}
                <button 
                  type="button"
                  className="attio-btn"
                  onClick={() => setShowFilterBar(prev => !prev)}
                  style={{
                    background: showFilterBar || hasActiveFilters ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar || hasActiveFilters ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar || hasActiveFilters ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>

                {/* Export CSV Button */}
                <button 
                  type="button"
                  className="attio-btn"
                  onClick={handleExportCSV}
                  title="Export filtered records to CSV"
                >
                  <Download size={13} style={{ marginRight: '4px' }} /> Export CSV
                </button>
              </div>
            </div>

            {/* Expandable Filter Box matching ImportStock / Products */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Category:</span>
                  <select
                    className="attio-select"
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467', marginLeft: 16 }}>
                  <span>Margin Tier:</span>
                  <select
                    className="attio-select"
                    value={filterTier}
                    onChange={(e) => { setFilterTier(e.target.value); setPage(1) }}
                  >
                    <option value="all">All Margins</option>
                    <option value="high">High Margin (&gt; 20%)</option>
                    <option value="healthy">Healthy (10% - 20%)</option>
                    <option value="low">Low Margin (0% - 10%)</option>
                    <option value="loss">Loss / Negative (&lt; 0%)</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button 
                    type="button"
                    onClick={() => { setFilterCategory('all'); setFilterTier('all'); setPage(1) }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* CRM Table Card Box matching Products & ImportStock */}
            <div className="attio-table-card">
              <div className="attio-table-wrap">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                    <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : error ? (
                  <div style={{ padding: 50, textAlign: 'center', color: '#dc2626' }}>
                    {error}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                    <Package size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                    No products found matching the criteria.
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
                        <th>STOCK & PACK</th>
                        <th style={{ textAlign: 'right' }}>BUYER PRICE (COST)</th>
                        <th style={{ textAlign: 'right' }}>SELLER PRICE (RETAIL)</th>
                        <th style={{ textAlign: 'right' }}>PROFIT / UNIT</th>
                        <th style={{ textAlign: 'center' }}>MARGIN (%)</th>
                        <th style={{ textAlign: 'right' }}>PRESENT PROFIT</th>
                        <th style={{ textAlign: 'right' }}>FULL STOCK PROFIT</th>
                        <th>SUPPLIER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map(p => {
                        const catStyle = getCategoryTagStyle(p.category)
                        const isLoss = p.is_loss

                        return (
                          <tr key={`${p.id}-${p.name}`}>
                            <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                              <input type="checkbox" className="attio-chk" readOnly />
                            </td>

                            {/* 1. Product Name & Avatar */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="attio-avatar" style={{ background: getAvatarColor(p.name) }}>
                                  {getSingleLetter(p.name)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 535, fontSize: '0.89rem', color: '#1e293b' }}>
                                    {p.name}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                    SKU: {p.sku || '—'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. Category Tag */}
                            <td>
                              <span 
                                className="attio-category-tag" 
                                style={{ 
                                  background: catStyle.bg, 
                                  color: catStyle.text, 
                                  border: `1px solid ${catStyle.border}`, 
                                  borderRadius: 6, 
                                  padding: '3px 10px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 600, 
                                  display: 'inline-flex', 
                                  alignItems: 'center' 
                                }}
                              >
                                {p.category || 'General'}
                              </span>
                            </td>

                            {/* 3. Stock & Packaging */}
                            <td>
                              <span className={`attio-stock-badge ${getStockBadgeClass(p.stock, p.loose_kg, p.bag_weight)}`}>
                                {formatStockDisplay(p.stock, p.bag_weight, p.unit, p.loose_kg)}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.70rem', color: '#64748b', marginTop: 3 }}>
                                {p.bag_weight > 1 ? `${p.bag_weight} ${p.unit}/pack` : `Per ${p.unit || 'unit'}`}
                              </span>
                            </td>

                            {/* 4. Buyer Price (Cost) */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {formatINR(p.buyer_price)}
                                </span>
                                {p.buy_rate_per_unit > 0 && (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                    ₹{p.buy_rate_per_unit.toFixed(2)} / {p.unit} cost
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 5. Seller Price (Retail) */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {formatINR(p.seller_price)}
                                </span>
                                {p.sell_rate_per_unit > 0 && (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                    ₹{p.sell_rate_per_unit.toFixed(2)} / {p.unit} retail
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 6. Profit / Unit */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: isLoss ? '#dc2626' : '#16a34a',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}>
                                  {isLoss ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                                  {isLoss ? '' : '+'}₹{Math.abs(p.margin_per_unit).toFixed(2)}
                                </span>
                                <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
                                  per {p.unit}
                                </span>
                              </div>
                            </td>

                            {/* 7. Profit Margin (%) - Box type */}
                            <td style={{ textAlign: 'center' }}>
                              {(() => {
                                let bg = '#eff6ff'
                                let text = '#1d4ed8'
                                let border = '#bfdbfe'
                                if (isLoss) {
                                  bg = '#fef2f2'
                                  text = '#b91c1c'
                                  border = '#fecaca'
                                } else if (p.margin_pct >= 20) {
                                  bg = '#f0fdf4'
                                  text = '#15803d'
                                  border = '#bbf7d0'
                                } else if (p.margin_pct < 10) {
                                  bg = '#fffbeb'
                                  text = '#b45309'
                                  border = '#fde68a'
                                }
                                return (
                                  <span 
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 650,
                                      fontSize: '0.76rem',
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      background: bg,
                                      color: text,
                                      border: `1px solid ${border}`,
                                      minWidth: 54
                                    }}
                                  >
                                    {p.margin_pct > 0 ? `+${p.margin_pct}%` : `${p.margin_pct}%`}
                                  </span>
                                )
                              })()}
                            </td>

                            {/* 8. Present Stock Profit (Dynamic, reduces with billing) */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: isLoss ? '#dc2626' : ((p.present_profit || 0) > 0 ? '#16a34a' : '#64748b'),
                                  fontSize: '0.88rem'
                                }}>
                                  {formatINR(p.present_profit !== undefined ? p.present_profit : p.total_potential_profit)}
                                </span>
                                <span style={{ fontSize: '0.70rem', color: '#64748b', marginTop: 1 }}>
                                  {(p.present_units !== undefined ? p.present_units : (p.total_units_in_stock || 0)).toLocaleString('en-IN')} {p.unit} in hand
                                </span>
                              </div>
                            </td>

                            {/* 9. Full Stock Profit (Initial full imported lot) */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: isLoss ? '#dc2626' : '#0f172a',
                                  fontSize: '0.88rem'
                                }}>
                                  {formatINR(p.full_stock_profit)}
                                </span>
                                <span style={{ fontSize: '0.70rem', color: '#64748b', marginTop: 1 }}>
                                  Lot: {(p.full_units || 0).toLocaleString('en-IN')} {p.unit}
                                </span>
                              </div>
                            </td>

                            {/* 9. Supplier */}
                            <td>
                              <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 500 }}>
                                {p.buyer_name || '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination matching Products / ImportStock */}
              <TablePagination
                page={page}
                setPage={setPage}
                total={filteredProducts.length}
                limit={limit}
                getPageNumbers={getPageNumbers}
                totalPages={totalPages}
              />
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
