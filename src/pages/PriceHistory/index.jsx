import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Filter, ArrowUpDown, X, Loader2, Search, Eye, ArrowLeft, History, TrendingUp, TrendingDown, DollarSign, Calendar, Tag } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle, getPillStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'
import TablePagination from '../../components/ui/TablePagination'

const formatDateStr = (raw) => {
  if (!raw) return 'N/A'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return String(raw).split('T')[0]
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return String(raw).split('T')[0]
  }
}

function ProductPriceHistoryDetail({ product, onBack }) {
  const bulkUnit = getBulkUnitDetails(product.unit)
  const bagWeight = parseFloat(product.bag_weight || 1)
  const effectivePrice = parseFloat(product.updated_price || product.price || 0)
  const unitPrice = (effectivePrice / bagWeight).toFixed(2)
  const updatedDateStr = formatDateStr(product.updated_price_date)
  const catStyle = getCategoryTagStyle(product.category)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    let isMounted = true
    api.get(`/products/${product.id}/price-history`)
      .then(res => {
        if (isMounted) setHistory(res.data || [])
      })
      .catch(() => {
        if (isMounted) {
          const defaultItems = []
          if (product.updated_price) {
            defaultItems.push({
              id: 'h2',
              old_price: product.price,
              new_price: product.updated_price,
              effective_date: updatedDateStr !== 'N/A' ? updatedDateStr : new Date().toISOString().split('T')[0],
              notes: 'Import Stock Price Revision'
            })
          }
          if (product.price) {
            defaultItems.push({
              id: 'h1',
              old_price: null,
              new_price: product.price,
              effective_date: product.created_at ? formatDateStr(product.created_at) : new Date().toISOString().split('T')[0],
              notes: 'Initial Base Benchmark Price'
            })
          }
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
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>₹{product.price}</p>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Original master list price</span>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Active Updated Price</span>
            <TrendingUp size={16} style={{ color: '#15803d' }} />
          </div>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>
            {product.updated_price ? `₹${product.updated_price}` : `₹${product.price}`}
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
            ₹{unitPrice} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e40af' }}>/ {bulkUnit ? bulkUnit.short : 'pcs'}</span>
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
                  const oldP = row.old_price !== null && row.old_price !== undefined ? parseFloat(row.old_price) : null
                  const diff = oldP !== null ? (newP - oldP) : 0
                  const isUp = diff > 0
                  const itemUnitPrice = bulkUnit ? (newP / bagWeight).toFixed(2) : null
                  const dateStr = formatDateStr(row.effective_date)

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
                          ₹{newP.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: oldP !== null ? '#64748b' : '#9ca3af', fontSize: '0.85rem' }}>
                          {oldP !== null ? `₹${oldP.toFixed(2)}` : '—'}
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
                            {isUp ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>Initial Benchmark</span>
                        )}
                      </td>
                      <td>
                        {itemUnitPrice ? (
                          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.85rem' }}>
                            ₹{itemUnitPrice} / {bulkUnit.short}
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
                            <th>STOCK</th>
                            <th>STATUS</th>
                            <th>NEXT RESTOCK</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map(row => {
                            const bulkUnit = getBulkUnitDetails(row.unit)
                            const bagWeight = parseFloat(row.bag_weight || 1)
                            const restock = row.next_restock_time || 'TBD'
                            const updatedDate = row.updated_price ? (row.updated_price_date ? String(row.updated_price_date).split('T')[0] : '') : ''
                            
                            const catStyle = getCategoryTagStyle(row.category)

                            return (
                              <tr key={row.id}>
                                <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                                  <input type="checkbox" className="attio-chk" readOnly />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                      {getSingleLetter(row.name)}
                                    </div>
                                    <span style={{ fontWeight: 500, color: '#1e293b' }}>
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
                                    ₹{row.price} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.unit ? `/ ${row.unit}` : ''}</span>
                                  </span>
                                </td>
                                <td>
                                  {row.updated_price ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem' }}>
                                        ₹{row.updated_price}
                                      </span>
                                      {updatedDate && (
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                          {updatedDate}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`attio-stock-badge ${getStockBadgeClass(row.stock)}`}>
                                    {row.stock} {bulkUnit && bagWeight > 1 ? (row.stock === 1 ? 'Bag' : 'Bags') : (row.unit || 'pcs')}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ 
                                    background: '#e0e7ff', 
                                    color: '#3730a3', 
                                    border: '1px solid #c7d2fe', 
                                    padding: '3px 10px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    display: 'inline-block',
                                    textTransform: 'lowercase' 
                                  }}>
                                    {row.status || 'added'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                    {restock}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                      className="ws-table-btn ws-table-btn--secondary"
                                      style={{ padding: '3px 8px', gap: 4, display: 'inline-flex', alignItems: 'center' }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedPricing(row)
                                      }}
                                      title="View Full Price History Page"
                                    >
                                      <Eye size={12} /> View
                                    </button>
                                  </div>
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
