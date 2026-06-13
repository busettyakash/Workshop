import React, { useState, useRef, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Package, X, Edit2, Trash2, Loader2 } from 'lucide-react'
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

  useEffect(() => { 
    dispatch(setActiveNav('Products')) 
    fetchProducts()
  }, [dispatch])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/products?status=active')
      setProducts(res.data?.data || [])
    } catch (err) {
      dispatch(addToast({ message: 'Failed to load products', type: 'error' }))
    } finally {
      setProducts(prev => prev.length > 0 ? prev : [])
      setLoading(false)
    }
  }



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
          <div className="ws-table-section">
            <div className="ws-table-header">
              <div className="ws-table-header-left">
                <h2 className="ws-table-title">All Products</h2>
                <p className="ws-table-sub">{products.length} products</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn" onClick={() => navigate('/import-stock')}>
                  <Package size={13} style={{ marginRight: 6 }} /> Return to Import Stock
                </button>
              </div>
            </div>
            <div className="ws-table-wrap">
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
