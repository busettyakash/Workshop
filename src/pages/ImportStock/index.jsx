import React, { useState, useRef, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Upload, Trash2, Edit2, Loader2, X, Check } from 'lucide-react'
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

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    fetchProducts()
  }, [dispatch])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/import-stock')
      setProducts(res.data?.data || [])
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
          <div className="ws-table-section">
            <div className="ws-table-header">
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
                <button className="ws-table-btn">
                  <Upload size={13} style={{ marginRight: '6px' }} /> Import CSV
                </button>
                <button className="ws-table-btn ws-table-btn--primary" onClick={() => navigate('/import-stock/add')}>
                  <Plus size={13} /> Add Stock
                </button>
              </div>
            </div>
            <div className="ws-table-wrap">
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
