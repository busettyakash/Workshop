import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Upload, Trash2, Edit2, Loader2, X, Check, Search, Filter, ArrowUpDown, Eye } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'

function PricingModal({ product, onClose }) {
  if (!product) return null
  const bulkUnit = getBulkUnitDetails(product.unit)
  const bagWeight = parseFloat(product.bag_weight || 1)
  const effectivePrice = parseFloat(product.updated_price || product.price || 0)
  const unitPrice = (effectivePrice / bagWeight).toFixed(2)
  const updatedDateStr = product.updated_price_date ? String(product.updated_price_date).split('T')[0] : ''

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
              effective_date: updatedDateStr || new Date().toISOString().split('T')[0],
              notes: 'Updated Price'
            })
          }
          if (product.price) {
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
  }, [product.id])

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal-card" style={{ maxWidth: 480, width: '90%' }} onClick={(e) => e.stopPropagation()}>
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
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Base Price</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>₹{product.price}</p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 500 }}>Active Updated Price</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
                {product.updated_price ? `₹${product.updated_price}` : `₹${product.price}`}
              </p>
            </div>
          </div>

          {bulkUnit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Package Breakdown: {bulkUnit.name} ({bagWeight}{bulkUnit.short})</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb' }}>
                ₹{unitPrice} / {bulkUnit.short}
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
                  const newP = parseFloat(item.new_price || 0)
                  const oldP = item.old_price !== null && item.old_price !== undefined ? parseFloat(item.old_price) : null
                  const diff = oldP !== null ? (newP - oldP) : 0
                  const isUp = diff > 0
                  const itemUnitPrice = bulkUnit ? (newP / bagWeight).toFixed(2) : null

                  return (
                    <div key={item.id || idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>₹{newP.toFixed(2)}</span>
                          {diff !== 0 && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isUp ? '#16a34a' : '#dc2626', background: isUp ? '#dcfce7' : '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                              {isUp ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
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
                            ₹{itemUnitPrice} / {bulkUnit.short}
                          </div>
                        )}
                        {oldP !== null && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Prev: ₹{oldP.toFixed(2)}
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

export default function ImportStock() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedPricing, setSelectedPricing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, name: '' })

  const [page, setPage] = useState(1)
  const [limit] = useState(20) // fixed limit to remove dropdown
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('') // '' (default), 'name_asc', 'name_desc'
  const [filterStatus, setFilterStatus] = useState('all') // default all
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

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterStatus])

  const fetchProducts = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await api.get(`/import-stock?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&status=${filterStatus}`)
      setProducts(res.data?.data || [])
      setTotal(res.data?.total || 0)
    } catch (err) {
      console.error('[ImportStock] Failed to load:', err?.response?.status, err?.response?.data)
      dispatch(addToast({ message: 'Failed to load import stock', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }



  const handleConfirmDelete = async () => {
    const { id, name } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, name: '' })
    try {
      await api.delete(`/import-stock/${id}`)
      setProducts(prev => prev.filter(p => p.id !== id))
      dispatch(addToast({ message: 'Item deleted successfully', type: 'success' }))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete item', type: 'error' }))
    }
  }

  const handleAddToProducts = async (id, name) => {
    try {
      await api.post(`/import-stock/${id}/add-to-products`)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'added' } : p))
      setSelectedIds(prev => prev.filter(item => item !== id))
      dispatch(addToast({ message: `${name} successfully added to Products!`, type: 'success' }))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to add to products', type: 'error' }))
    }
  }

  const handleBulkAddToProducts = async () => {
    if (selectedIds.length === 0) return
    try {
      await api.post('/import-stock/bulk-add-to-products', { ids: selectedIds })
      setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, status: 'added' } : p))
      dispatch(addToast({ message: `${selectedIds.length} items successfully added to Products!`, type: 'success' }))
      setSelectedIds([])
    } catch (err) {
      dispatch(addToast({ message: 'Failed to add items to products', type: 'error' }))
    }
  }

  const getPillStyle = (status) => {
    return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' }
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
                <span className="ws-unified-header-title">Import Stock</span>
                <span className="ws-unified-header-badge">{total} items</span>
              </div>
              <div className="ws-unified-header-actions">
                {selectedIds.length > 0 && (
                  <button 
                    className="attio-btn" 
                    onClick={handleBulkAddToProducts} 
                    style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 600 }}
                  >
                    <Plus size={13} style={{ marginRight: '4px' }} /> Add Selected ({selectedIds.length})
                  </button>
                )}

                {/* Search box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search stock..."
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
                    background: showFilterBar || filterStatus !== 'all' ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar || filterStatus !== 'all' ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar || filterStatus !== 'all' ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>

                <button className="attio-btn">
                  <Upload size={13} style={{ marginRight: '4px' }} /> Import CSV
                </button>
                <button className="attio-btn attio-btn-primary" onClick={() => navigate('/import-stock/add')}>
                  <Plus size={13} style={{ marginRight: '4px' }} /> Add Stock
                </button>
              </div>
            </div>

            {/* Expandable Filter Box */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Status:</span>
                  <select
                    className="attio-select"
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="added">Added</option>
                  </select>
                </div>

                {filterStatus !== 'all' && (
                  <button 
                    onClick={() => { setFilterStatus('all'); setPage(1); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* Table Card Shell */}
            <div className="attio-table-card">
              <div className="attio-table-wrap">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={24} className="ws-chat-loader-spin" />
                </div>
              ) : products.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  No pending stock found. Click "Add stock" to stage one.
                </div>
              ) : (
                <table className="attio-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                        <input 
                          type="checkbox" 
                          className="attio-chk" 
                          checked={products.filter(p => p.status === 'active').length > 0 && products.filter(p => p.status === 'active').every(p => selectedIds.includes(p.id))}
                          onChange={() => {
                            const selectables = products.filter(p => p.status === 'active')
                            const allSelected = selectables.length > 0 && selectables.every(p => selectedIds.includes(p.id))
                            if (allSelected) {
                              setSelectedIds([])
                            } else {
                              setSelectedIds(selectables.map(p => p.id))
                            }
                          }}
                        />
                      </th>
                      <th>PRODUCT NAME</th>
                      <th>SKU</th>
                      <th>CATEGORY</th>
                      <th>PRICE</th>
                      <th>UPDATED PRICE</th>
                      <th>STOCK</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(row => {
                      const catStyle = getPillStyle(row.category || 'default')
                      const statusStyle = getPillStyle(row.status || 'pending')
                      const stockStatus = row.stock > 10 ? 'in stock' : row.stock > 0 ? 'low stock' : 'out of stock'
                      const stockStyle = getPillStyle(stockStatus)
                      const updatedDate = row.updated_price_date ? String(row.updated_price_date).split('T')[0] : ''
                      return (
                        <tr key={row.id}>
                          <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                            {row.status === 'added' ? (
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                disabled 
                                checked={false} 
                                style={{ opacity: 0.4, cursor: 'not-allowed' }}
                              />
                            ) : row.status !== 'active' ? (
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                disabled 
                                checked={false} 
                                style={{ opacity: 0.4, cursor: 'not-allowed' }}
                                title="Only active status items can be added to products"
                              />
                            ) : (
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                checked={selectedIds.includes(row.id)}
                                onChange={() => {
                                  setSelectedIds(prev => 
                                    prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                  )
                                }}
                              />
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                {getSingleLetter(row.name)}
                              </div>
                              <span className="ws-table-primary-text" onClick={() => navigate(`/import-stock/edit/${row.id}`)} style={{ fontWeight: 500, color: '#1e293b' }}>
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td className="ws-td-mono">{row.sku || '—'}</td>
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
                          <td className="ws-td-price">
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>
                              ₹{row.price} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.unit ? `/ ${row.unit}` : ''}</span>
                            </span>
                          </td>
                          <td className="ws-td-price">
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
                            {(() => {
                              const bulkUnit = getBulkUnitDetails(row.unit)
                              const bagWeight = parseFloat(row.bag_weight || 1)
                              const labelText = (bulkUnit && bagWeight > 1) ? `${row.stock} ${bulkUnit.pluralName}` : `${row.stock} ${row.unit || 'pcs'}`
                              return (
                                <span 
                                  style={{ 
                                    background: '#dcfce7', 
                                    color: '#15803d', 
                                    border: '1px solid #bbf7d0', 
                                    borderRadius: 6, 
                                    padding: '2px 10px', 
                                    height: 22,
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    minWidth: 52, 
                                    textAlign: 'center' 
                                  }}
                                >
                                  {labelText}
                                </span>
                              )
                            })()}
                          </td>
                          <td>
                            <span 
                              style={{ 
                                background: '#e0e7ff', 
                                color: '#3730a3', 
                                border: '1px solid #c7d2fe', 
                                borderRadius: 6, 
                                padding: '2px 10px', 
                                height: 22,
                                fontSize: '0.75rem', 
                                fontWeight: 500, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                minWidth: 52, 
                                textAlign: 'center' 
                              }}
                            >
                              active
                            </span>
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
                              {row.status === 'added' ? (
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{ color: '#8b5cf6', padding: 6, fontWeight: 500, background: '#ede9fe', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}
                                  disabled
                                  title="Product is already added"
                                >
                                  <Check size={13} /> Added
                                </button>
                              ) : row.status !== 'active' ? (
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{ color: '#9ca3af', padding: 6, fontWeight: 500, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, cursor: 'not-allowed', opacity: 0.6 }}
                                  disabled
                                  title="Only active items can be added to products"
                                >
                                  <Plus size={13} /> Add to Products
                                </button>
                              ) : (
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{ color: '#4b5563', padding: 6, fontWeight: 500, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => handleAddToProducts(row.id, row.name)}
                                  title="Add to Live Products"
                                >
                                  <Plus size={13} /> Add to Products
                                </button>
                              )}
                              <button
                                className="ws-chat-history-delete-btn"
                                style={{ color: '#4b5563', padding: 6 }}
                                onClick={() => navigate(`/import-stock/edit/${row.id}`)}
                                title="Edit Product"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="ws-chat-history-delete-btn"
                                style={{ padding: 6 }}
                                onClick={() => setConfirmDelete({ isOpen: true, id: row.id, name: row.name })}
                                title="Delete Product"
                              >
                                <Trash2 size={13} />
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
            {/* Pagination component */}
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

      {selectedPricing && (
        <PricingModal product={selectedPricing} onClose={() => setSelectedPricing(null)} />
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Stock Item"
        message={`Are you sure you want to delete "${confirmDelete.name}" from staged stock?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
      />
    </div>
  )
}
