import React, { useState, useRef, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Upload, Trash2, Edit2, Loader2, X, Check, Search, Filter, ArrowUpDown } from 'lucide-react'
import { getAvatarColor, getSingleLetter, getPillStyle } from '../../utils/tableHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

// Form component moved to a separate page

import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function ImportStock() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
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
    switch (status) {
      case 'active':
      case 'in stock':
        return { bg: '#dcfce7', text: '#166534' }
      case 'inactive':
      case 'out of stock':
        return { bg: '#fee2e2', text: '#991b1b' }
      case 'pending':
        return { bg: '#fef3c7', text: '#d97706' }
      case 'added':
        return { bg: '#e0e7ff', text: '#4338ca' }
      case 'low stock':
        return { bg: '#fef3c7', text: '#92400e' }
      default:
        return { bg: '#f3f4f6', text: '#4b5563' }
    }
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Import Stock</div>
          <div className="ws-table-section" style={{ minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}>
            <div className="ws-table-header" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="ws-table-header-left">
                  <h2 className="ws-table-title">All Stock Items</h2>
                  <p className="ws-table-sub">Stage products here before adding them to your live inventory.</p>
                </div>
                <div className="ws-table-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {selectedIds.length > 0 && (
                    <button 
                      className="ws-table-btn ws-table-btn--primary" 
                      onClick={handleBulkAddToProducts} 
                      style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 600 }}
                    >
                      <Plus size={13} style={{ marginRight: '6px' }} /> Add Selected ({selectedIds.length})
                    </button>
                  )}

                  {/* Search box */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Search stock..."
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
                      borderColor: showFilterBar || filterStatus !== 'all' ? '#111827' : '#d1d5db',
                      background: showFilterBar || filterStatus !== 'all' ? '#f3f4f6' : '#fff',
                      fontWeight: showFilterBar || filterStatus !== 'all' ? 600 : 500
                    }}
                  >
                    <Filter size={13} /> Filter
                  </button>

                  <button className="ws-table-btn">
                    <Upload size={13} style={{ marginRight: '6px' }} /> Import CSV
                  </button>
                  <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/import-stock/add')}>
                    <Plus size={13} /> Add Stock
                  </button>
                </div>
              </div>

              {/* Expandable Filter Bar */}
              {showFilterBar && (
                <div style={{ display: 'flex', gap: 12, padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
                    <span>Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}
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
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  No pending stock found. Click "Add stock" to stage one.
                </div>
              ) : (
                <table className="ws-table-styled">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input 
                          type="checkbox" 
                          className="ws-table-checkbox" 
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
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(row => {
                      const catStyle = getPillStyle(row.category || 'default')
                      const statusStyle = getPillStyle(row.status || 'pending')
                      const stockStatus = row.stock > 10 ? 'in stock' : row.stock > 0 ? 'low stock' : 'out of stock'
                      const stockStyle = getPillStyle(stockStatus)
                      return (
                        <tr key={row.id}>
                          <td>
                            {row.status === 'added' ? (
                              <input 
                                type="checkbox" 
                                className="ws-table-checkbox" 
                                disabled 
                                checked={false} 
                                style={{ opacity: 0.4, cursor: 'not-allowed' }}
                              />
                            ) : row.status !== 'active' ? (
                              <input 
                                type="checkbox" 
                                className="ws-table-checkbox" 
                                disabled 
                                checked={false} 
                                style={{ opacity: 0.4, cursor: 'not-allowed' }}
                                title="Only active status items can be added to products"
                              />
                            ) : (
                              <input 
                                type="checkbox" 
                                className="ws-table-checkbox" 
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="ws-table-avatar" style={{ background: getAvatarColor(row.name) }}>
                                {getSingleLetter(row.name)}
                              </div>
                              <span className="ws-table-primary-text" onClick={() => navigate(`/import-stock/edit/${row.id}`)}>
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
                              {row.status || 'pending'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
