import React, { useState, useRef, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Package, X, Edit2, Trash2, Loader2, Search } from 'lucide-react'
import { drawBarcode } from '../../utils/barcode'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'

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

// ProductFormModal has been moved to a separate page component

import { useNavigate } from 'react-router-dom'

export default function Products() {
  const dispatch  = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
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

  const getStatusStyle = (status) => {
    switch (status) {
      case 'active':
        return { background: '#dcfce7', color: '#166534' }
      case 'inactive':
        return { background: '#fee2e2', color: '#991b1b' }
      default:
        return { background: '#f3f4f6', color: '#4b5563' }
    }
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Products</div>
          <div className="ws-table-section" style={{ minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}>
            <div className="ws-table-header" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="ws-table-header-left">
                  <h2 className="ws-table-title">All Products</h2>
                  <p className="ws-table-sub">{total} products</p>
                </div>
                <div className="ws-table-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Search box */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      style={{
                        padding: '8px 12px 8px 30px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        outline: 'none',
                        width: '180px',
                        background: '#fff',
                        color: '#374151'
                      }}
                    />
                  </div>

                  {/* Sort button */}
                  <button 
                    className="ws-table-btn" 
                    onClick={() => {
                      setSort(prev => prev === 'name_asc' ? 'name_desc' : prev === 'name_desc' ? '' : 'name_asc');
                      setPage(1);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      borderColor: sort ? '#111827' : '#d1d5db',
                      background: sort ? '#f3f4f6' : '#fff',
                      fontWeight: sort ? 600 : 500
                    }}
                  >
                    <ArrowUpDown size={13} /> 
                    Sort {sort === 'name_asc' ? 'A-Z' : sort === 'name_desc' ? 'Z-A' : ''}
                  </button>

                  {/* Filter button */}
                  <button 
                    className="ws-table-btn" 
                    onClick={() => setShowFilterBar(prev => !prev)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      borderColor: showFilterBar || filterCategory || filterStatus !== 'active' ? '#111827' : '#d1d5db',
                      background: showFilterBar || filterCategory || filterStatus !== 'active' ? '#f3f4f6' : '#fff',
                      fontWeight: showFilterBar || filterCategory || filterStatus !== 'active' ? 600 : 500
                    }}
                  >
                    <Filter size={13} /> Filter
                  </button>

                  <button className="ws-table-btn" onClick={() => navigate('/import-stock')}>
                    <Package size={13} style={{ marginRight: 6 }} /> Return to Import Stock
                  </button>
                </div>
              </div>

              {/* Expandable Filter Bar */}
              {showFilterBar && (
                <div style={{ display: 'flex', gap: 12, padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
                    <span>Category:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      <option value="">All Categories</option>
                      <option value="Food">Food</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Grocery">Grocery</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
                    <span>Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {(filterCategory || filterStatus !== 'active') && (
                    <button 
                      onClick={() => { setFilterCategory(''); setFilterStatus('active'); setPage(1); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3d68f5', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="ws-table-wrap" style={{ flex: 1 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={24} className="ws-chat-loader-spin" />
                </div>
              ) : products.length === 0 ? (
                <div style={{ padding: 40, textTheme: 'center', textAlign: 'center', color: '#9ca3af' }}>
                  No products found. Click "Add Product" to create one.
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" className="ws-table-checkbox" readOnly /></th>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Next Restock</th>
                      <th>Barcode</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(row => {
                      const catStyle = getPillStyle(row.category || 'default')
                      const statusStyle = getPillStyle(row.status)
                      const stockStatus = row.stock > 10 ? 'in stock' : row.stock > 0 ? 'low stock' : 'out of stock'
                      const stockStyle = getPillStyle(stockStatus)
                      
                      const restockOpts = ['TBD', 'In 30 mins', 'Tomorrow', 'Next week', 'Next month']
                      const restock = row.next_restock_time || 'TBD'
                      const getRestockStyle = (val) => {
                        if (val === 'In 30 mins') return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' }
                        if (val === 'Tomorrow') return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }
                        if (val === 'Next week') return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' }
                        if (val === 'Next month') return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' }
                        return { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' }
                      }
                      const restockStyle = getRestockStyle(restock)

                      return (
                        <tr key={row.id}>
                          <td>
                            <input type="checkbox" className="ws-table-checkbox" readOnly />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.name) }}>
                                {getSingleLetter(row.name)}
                              </div>
                              <span className="ws-table-name-text">
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td className="ws-td-mono">{row.sku || '—'}</td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: catStyle.bg, color: catStyle.text, borderColor: catStyle.border }}>
                              {row.category || 'Unassigned'}
                            </span>
                          </td>
                          <td className="ws-td-price">₹{row.price}</td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: stockStyle.bg, color: stockStyle.text, borderColor: stockStyle.border }}>
                              Qty {row.stock}
                            </span>
                          </td>
                          <td>
                            <span className="ws-pill-topic" style={{ background: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            {row.stock <= 0 ? (
                              <select 
                                value={restock}
                                onChange={(e) => handleUpdateRestock(row, e.target.value)}
                                style={{ 
                                  appearance: 'none',
                                  background: restockStyle.bg, 
                                  color: restockStyle.text, 
                                  border: `1px solid ${restockStyle.border}`,
                                  borderRadius: '16px',
                                  padding: '2px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
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
                            ) : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

            {/* Pagination component outside ws-table-wrap at bottom of card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #f3f4f6', background: '#fff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', marginTop: 'auto' }}>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Showing <span style={{ fontWeight: 600, color: '#111827' }}>{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
                <span style={{ fontWeight: 600, color: '#111827' }}>{Math.min(page * limit, total)}</span> of{' '}
                <span style={{ fontWeight: 600, color: '#111827' }}>{total}</span> entries
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#fff',
                    color: page <= 1 ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  &lt;
                </button>
                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`dots-${idx}`} style={{ color: '#9ca3af', padding: '0 8px', fontSize: '0.875rem' }}>
                        ...
                      </span>
                    )
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: page === p ? '#111827' : '#fff',
                        color: page === p ? '#fff' : '#374151',
                        border: page === p ? '1px solid #111827' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#fff',
                    color: page >= totalPages ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {selectedSku && (
        <BarcodeModal sku={selectedSku} onClose={() => setSelectedSku(null)} />
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
