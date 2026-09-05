import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Package, X, Edit2, Trash2, Loader2, Search, Eye } from 'lucide-react'
import { drawBarcode } from '../../utils/barcode'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails, formatStockDisplay, calculateUnitPricing } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import './Products.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'
import { hasModulePermission, canDeleteModule, canCreateModule, canEditModule, getFirstAccessibleRoute, usePermissions } from '../../utils/permissionUtils'

const formatIndianDateOnly = (raw) => {
  if (!raw) return ''
  try {
    let str = String(raw)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      str = str + 'T00:00:00'
    }
    const d = new Date(str)
    if (Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return String(raw)
  }
}

function ProductBarcode({ sku }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) {
      drawBarcode(canvasRef.current, sku)
    }
  }, [sku])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 76,
        height: 28,
        cursor: 'pointer',
        display: 'block',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        background: '#ffffff'
      }}
      title="Click to preview and download barcode"
    />
  )
}

function BarcodeModal({ sku, onClose }) {
  const canvasRef = useRef(null)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (canvasRef.current) {
      drawBarcode(canvasRef.current, sku)
    }
  }, [sku])

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `barcode-${sku}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
    dispatch(addToast({ message: `Barcode for ${sku} downloaded successfully.`, type: 'success' }))
  }

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h3 className="ws-modal-title">Product Barcode</h3>
          <button className="ws-modal-close-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          <canvas 
            ref={canvasRef} 
            style={{ 
              maxWidth: '100%', 
              height: 'auto', 
              border: '1px solid var(--color-border)', 
              borderRadius: 8, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)' 
            }} 
          />
          <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: 0 }}>
            SKU: <code className="ws-td-mono" style={{ fontSize: '0.85rem' }}>{sku}</code>
          </p>
        </div>
        <div className="ws-modal-footer">
          <button className="ws-modal-btn" onClick={onClose}>Close</button>
          <button className="ws-modal-btn ws-modal-btn--primary" onClick={handleDownload}>Download PNG</button>
        </div>
      </div>
    </div>
  )
}

function PricingModal({ product, onClose }) {
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const targetId = product?.product_id || product?.id
  const bulkUnit = getBulkUnitDetails(product?.unit)
  const bagWeight = Number.parseFloat(product?.bag_weight || 1)
  const pc = Number.parseFloat(product?.price_covers || 0)

  const calcBagPrice = (rawVal) => {
    const p = Number.parseFloat(rawVal || 0)
    if (p <= 0) return 0
    return p
  }

  const basePriceVal = calcBagPrice(product?.price)
  const activeBagPrice = product?.updated_price ? calcBagPrice(product.updated_price) : basePriceVal

  const unitPrice = (bagWeight > 0 ? (activeBagPrice / bagWeight) : activeBagPrice).toFixed(2)
  const updatedDateStr = product?.updated_price_date ? String(product.updated_price_date).split('T')[0] : ''

  useEffect(() => {
    let isMounted = true
    if (!targetId) {
      setLoadingHistory(false)
      return
    }
    api.get(`/products/${targetId}/price-history`)
      .then(res => {
        if (isMounted) setHistory(res.data || [])
      })
      .catch(() => {
        if (isMounted) {
          const defaultItems = []
          if (product?.updated_price) {
            defaultItems.push({
              id: 'h2',
              old_price: product.price,
              new_price: product.updated_price,
              effective_date: updatedDateStr || new Date().toISOString().split('T')[0],
              notes: 'Updated Price'
            })
          }
          if (product?.price) {
            defaultItems.push({
              id: 'h1',
              old_price: null,
              new_price: product.price,
              effective_date: product.created_at ? String(product.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
              notes: 'Initial Base Price'
            })
          }
          setHistory(defaultItems)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false)
      })
    return () => { isMounted = false }
  }, [targetId])

  if (!product) return null

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card" style={{ maxWidth: 480, width: '90%' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="ws-modal-header">
          <div>
            <h3 className="ws-modal-title" style={{ margin: 0 }}>Pricing & Price History</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>{product.name} ({product.sku || 'No SKU'})</p>
          </div>
          <button className="ws-modal-close-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="ws-modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current Pricing Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Base Price ({bagWeight} {bulkUnit?.short || product?.unit || 'kg'})</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                ₹{basePriceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 500 }}>Active Updated Price ({bagWeight} {bulkUnit?.short || product?.unit || 'kg'})</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
                ₹{activeBagPrice.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {bulkUnit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Package Breakdown: {bulkUnit.name} ({bagWeight}{bulkUnit.short})</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb' }}>
                ₹{Number.parseFloat(unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {bulkUnit.short}
              </span>
            </div>
          )}

          {/* Price History Timeline */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Price History Log</h4>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{history.length} record{history.length === 1 ? '' : 's'}</span>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.8125rem' }}>Loading price history...</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>No historical price records found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {history.map((item, idx) => {
                  const newRaw = Number.parseFloat(item.new_price || 0)
                  const oldRaw = item.old_price !== null && item.old_price !== undefined ? Number.parseFloat(item.old_price) : null

                  const newBagP = calcBagPrice(newRaw)
                  const oldBagP = oldRaw !== null ? calcBagPrice(oldRaw) : null

                  const diff = oldBagP !== null ? (newBagP - oldBagP) : 0
                  const isUp = diff > 0
                  const itemUnitPrice = bulkUnit ? (newBagP / bagWeight).toFixed(2) : null

                  return (
                    <div key={item.id || idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>₹{newBagP.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {bagWeight > 1 && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                              ({bagWeight} {bulkUnit?.short || product?.unit || 'kgs'} price)
                            </span>
                          )}
                          {diff !== 0 && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isUp ? '#16a34a' : '#dc2626', background: isUp ? '#dcfce7' : '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                              {isUp ? `+₹${diff.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-₹${Math.abs(diff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {item.notes || 'Price change'} • <span style={{ color: '#475467' }}>{item.effective_date ? String(item.effective_date).split('T')[0] : 'N/A'}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {itemUnitPrice && (
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb' }}>
                            ₹{Number.parseFloat(itemUnitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {bulkUnit.short}
                          </div>
                        )}
                        {oldBagP !== null && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Prev: ₹{oldBagP.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="ws-modal-footer">
          <button className="ws-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const dispatch  = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const { canRead, canCreate, canEdit, canDelete, hasModulePermission: checkModPerm } = usePermissions('products')
  const canAccessImportStock = checkModPerm ? checkModPerm('import_stock') : hasModulePermission('import_stock')
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [selectedPricing, setSelectedPricing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, name: '' })

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'name_asc', 'name_desc'
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('active') // default active
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
      dispatch(addToast({ message: 'Failed to load products', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (!canRead) {
      navigate(getFirstAccessibleRoute(), { replace: true })
      return
    }
    dispatch(setActiveNav('Products')) 
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterCategory, filterStatus, canRead])



  const handleConfirmDelete = async () => {
    const { id, name } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, name: '' })
    try {
      await api.delete(`/products/${id}`)
      setProducts(prev => prev.filter(p => p.id !== id))
      dispatch(addToast({ message: 'Product deleted successfully', type: 'success' }))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete product', type: 'error' }))
    }
  }

  const handleUpdateRestock = async (product, value) => {
    try {
      const payload = { ...product, next_restock_time: value }
      await api.put(`/products/${product.id}`, payload)
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, next_restock_time: value } : p))
      dispatch(addToast({ message: 'Restock time updated', type: 'success' }))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to update restock time', type: 'error' }))
    }
  }



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
            {/* Top Toolbar */}
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Products</span>
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

                {canAccessImportStock && (
                  <button className="attio-btn attio-btn-primary" onClick={() => navigate('/import-stock')}>
                    Return to Import Stock
                  </button>
                )}
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
                        <th>HSN CODE</th>
                        <th>CATEGORY</th>
                        <th>PRICE</th>
                        <th>UPDATED PRICE</th>
                        <th>STOCK</th>
                        <th>STATUS</th>
                        <th>NEXT RESTOCK</th>
                        <th>BARCODE</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(row => {
                        const restockOpts = ['TBD', 'In 30 mins', 'Tomorrow', 'Next week', 'Next month']
                        const restock = row.next_restock_time || 'TBD'

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
                                <span style={{ fontWeight: 535, fontSize: '0.89rem', color: '#1e293b' }}>
                                  {row.name}
                                </span>
                              </div>
                            </td>
                             <td>
                               <span style={{ color: '#1e293b', fontWeight: 600, fontSize: '0.85rem' }}>
                                 {row.hsn_code || row.sku || '10064000'}
                               </span>
                             </td>
                             <td>
                               {(() => {
                                 const catStyle = getCategoryTagStyle(row.category)
                                 return (
                                   <span className="attio-category-tag" style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                                     {row.category || 'Unassigned'}
                                   </span>
                                 )
                               })()}
                              </td>
                              <td>
                                {(() => {
                                  const bulkUnit = getBulkUnitDetails(row.unit)
                                  const uomShort = (bulkUnit?.short || row.unit || 'kg').toLowerCase().replace(/s$/, '')
                                  const pc = Number.parseFloat(row.price_covers || 0)
                                  const bw = Number.parseFloat(row.bag_weight || 1)
                                  const rawP = Number.parseFloat(row.price || 0)

                                  let priceVal = rawP
                                  if (pc > 0 && bw > 0 && pc !== bw) {
                                    priceVal = (rawP / bw) * pc
                                  }

                                  const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                        ₹{priceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                  const rawUP = Number.parseFloat(row.updated_price || 0)

                                  let updatedPriceVal = rawUP
                                  if (pc > 0 && bw > 0 && pc !== bw) {
                                    updatedPriceVal = (rawUP / bw) * pc
                                  }

                                  const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#2563eb' }}>
                                        ₹{updatedPriceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                        {subtext}
                                      </span>
                                    </div>
                                  )
                                })()}
                              </td>
                            <td>
                              <span className={`attio-stock-badge ${getStockBadgeClass(row.stock, row.loose_kg, row.bag_weight)}`}>
                                {formatStockDisplay(row.stock, row.bag_weight, row.unit, row.loose_kg)}
                              </span>
                            </td>
                            <td>
                              <span className={`attio-status-badge ${row.status === 'active' ? 'attio-status-active' : 'attio-status-inactive'}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              {((Number.parseFloat(row.stock || 0) * (Number.parseFloat(row.bag_weight || 1) > 1 ? Number.parseFloat(row.bag_weight || 1) : 1)) + Number.parseFloat(row.loose_kg || 0)) <= 0 ? (
                                <select 
                                  value={restock}
                                  onChange={(e) => handleUpdateRestock(row, e.target.value)}
                                  className="attio-select"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                >
                                  {restockOpts.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              )}
                            </td>
                            <td>
                              {row.sku ? (
                                <div role="button" tabIndex={0} onClick={() => setSelectedSku(row.sku)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedSku(row.sku) }}>
                                  <ProductBarcode sku={row.sku} />
                                </div>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                                <button 
                                  onClick={() => setSelectedPricing(row)}
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    transition: 'all 0.15s'
                                  }}
                                  title="View pricing details"
                                >
                                  <Eye size={12} /> View
                                </button>
                                {canDelete && (
                                  <button 
                                    onClick={() => setConfirmDelete({ isOpen: true, id: row.id, name: row.name })}
                                    style={{
                                      background: 'none', border: 'none', color: '#9ca3af',
                                      cursor: 'pointer', padding: 4, borderRadius: 4,
                                      transition: 'color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                                    title="Delete Product"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Pagination */}
              <TablePagination
                page={page}
                setPage={setPage}
                total={total}
                limit={limit}
                getPageNumbers={getPageNumbers}
                totalPages={totalPages}
              />
            </div>
          </div>
        </main>
      </div>

      {selectedSku && (
        <BarcodeModal sku={selectedSku} onClose={() => setSelectedSku(null)} />
      )}

      {selectedPricing && (
        <PricingModal product={selectedPricing} onClose={() => setSelectedPricing(null)} />
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Product"
        message={`Are you sure you want to delete product "${confirmDelete.name}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
      />
    </div>
  )
}
