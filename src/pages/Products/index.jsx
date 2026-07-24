import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Package, X, Edit2, Trash2, Loader2, Search, Eye } from 'lucide-react'
import { drawBarcode } from '../../utils/barcode'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import './Products.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'

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
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal-card" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
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
  if (!product) return null
  const bulkUnit = getBulkUnitDetails(product.unit)
  const bagWeight = parseFloat(product.bag_weight || 1)
  const unitPrice = (parseFloat(product.price || 0) / bagWeight).toFixed(2)

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h3 className="ws-modal-title">Pricing Details</h3>
          <button className="ws-modal-close-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="ws-modal-body" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            {product.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b' }}>Package Price:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{product.price}</span>
            </div>
            {bulkUnit && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Package Unit:</span>
                  <span style={{ fontWeight: 500, color: '#334155' }}>{bulkUnit.name} ({bagWeight}{bulkUnit.short})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475467', fontWeight: 500 }}>Unit Rate Breakdown:</span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{unitPrice} / {bulkUnit.short}</span>
                </div>
              </>
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

// ProductFormModal has been moved to a separate page component

export default function Products() {
  const dispatch  = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()
  
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
    dispatch(setActiveNav('Products')) 
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterCategory, filterStatus])



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

  const getCategoryTagClass = (category = '') => {
    const cat = String(category).toLowerCase()
    if (cat.includes('food')) return 'attio-tag-food'
    if (cat.includes('elect')) return 'attio-tag-electronics'
    if (cat.includes('groc')) return 'attio-tag-grocery'
    return 'attio-tag-default'
  }

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
                        <th>SKU</th>
                        <th>CATEGORY</th>
                        <th>PRICE</th>
                        <th>STOCK</th>
                        <th>STATUS</th>
                        <th>NEXT RESTOCK</th>
                        <th>BARCODE</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(row => {
                        const bulkUnit = getBulkUnitDetails(row.unit)
                        const bagWeight = parseFloat(row.bag_weight || 1)
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
                                <span style={{ fontWeight: 500, color: '#1e293b' }}>
                                  {row.name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.8rem' }}>
                                {row.sku || '—'}
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
                              <span style={{ fontWeight: 500, color: '#1e293b' }}>
                                ₹{row.price} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.unit ? `/ ${row.unit}` : ''}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`attio-stock-badge ${getStockBadgeClass(row.stock)}`}>
                                {row.stock} {bulkUnit && bagWeight > 1 ? bulkUnit.pluralName : (row.unit || 'pcs')}
                              </span>
                            </td>
                            <td>
                              <span className={`attio-status-badge ${row.status === 'active' ? 'attio-status-active' : 'attio-status-inactive'}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              {row.stock <= 0 ? (
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
                                <div onClick={() => setSelectedSku(row.sku)}>
                                  <ProductBarcode sku={row.sku} />
                                </div>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                                {bulkUnit && (
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
                                )}
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
