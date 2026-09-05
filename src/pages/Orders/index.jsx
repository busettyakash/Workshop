import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, selectSidebarOpen, setActiveNav } from '../../redux/slices/uiSlice'
import api from '../../api/client'
import TablePagination from '../../components/ui/TablePagination'
import { ArrowUpDown, Eye, Loader2, Search, ArrowLeftRight, X } from 'lucide-react'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'
import { useNavigate } from 'react-router'
import { usePermissions, getFirstAccessibleRoute } from '../../utils/permissionUtils'
import QuotePreviewModal from '../Quotes/QuotePreviewModal'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'

const limit = 20

function formatCurrency(value) {
  return (Number.parseFloat(value || 0)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

function parseOrderLineItems(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function OrderComparisonModal({ orders, onClose, onRemoveOrder, onClearAll }) {
  if (!orders || orders.length === 0) return null

  const orderData = orders.map(o => {
    const items = parseOrderLineItems(o.line_items)
    const totalAmount = Number.parseFloat(o.total_amount || 0)
    const taxAmount = Number.parseFloat(o.tax_amount || 0)
    return {
      ...o,
      items,
      totalAmount,
      taxAmount
    }
  })

  const amounts = orderData.map(o => o.totalAmount)
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)
  const hasAmountVariance = minAmount !== maxAmount

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card compare-modal-card" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ws-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                <ArrowLeftRight size={18} />
              </div>
              <div>
                <h3 className="ws-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Order Comparison
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Comparing {orders.length} order{orders.length > 1 ? 's' : ''} side-by-side
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {orders.length > 0 && (
              <button
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Clear all
              </button>
            )}
            <button className="ws-modal-close-x" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="ws-modal-body" style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          {orders.length < 2 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#475467' }}>
                <ArrowLeftRight size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#1e293b' }}>Select at least 2 orders</h4>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: 360, marginInline: 'auto' }}>
                Please select at least 2 orders from the list to compare their items, total values, and customer details side-by-side.
              </p>
            </div>
          ) : (
            <table className="compare-matrix-table">
              <thead>
                <tr>
                  <th className="attr-col">Order Details</th>
                  {orderData.map(o => {
                    const orderNum = o.order_number && !o.order_number.startsWith('QT-') ? o.order_number : `ORD-${o.quote_number ? o.quote_number.replace(/^QT-?/i, '') : o.id}`
                    return (
                      <th key={`${o.source || 'ord'}-${o.id}`} className="product-col" style={{ background: '#ffffff', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="attio-avatar" style={{ background: getAvatarColor(o.customer_name), width: 26, height: 26, minWidth: 26, fontSize: '0.82rem' }}>
                              {getSingleLetter(o.customer_name)}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', fontFamily: 'monospace', color: '#2563eb' }}>
                                {orderNum}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 600 }}>
                                {o.customer_name || 'General Customer'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveOrder(o.id)}
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              borderRadius: '50%',
                              width: 22,
                              height: 22,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                            title="Remove from comparison"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div style={{ marginTop: 8, textAlign: 'left' }}>
                          <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 5, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-block' }}>
                            Ref: {o.quote_number || `QT-${o.id}`}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Total Value */}
                <tr>
                  <td className="attr-cell">Total Amount</td>
                  {orderData.map(o => {
                    const isLowest = hasAmountVariance && o.totalAmount === minAmount
                    return (
                      <td key={`${o.source || 'ord'}-${o.id}`} className="product-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isLowest ? '#15803d' : '#0f172a' }}>
                            ₹{o.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {isLowest && (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                              Lowest Total
                            </span>
                          )}
                        </div>
                        {o.taxAmount > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                            Tax: ₹{o.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {/* Customer Details */}
                <tr>
                  <td className="attr-cell">Customer & Contact</td>
                  {orderData.map(o => (
                    <td key={`${o.source || 'ord'}-${o.id}`} className="product-col">
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>{o.customer_name || 'General Customer'}</div>
                      {o.customer_company && <div style={{ fontSize: '0.75rem', color: '#475467' }}>{o.customer_company}</div>}
                      {o.customer_phone && <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 2 }}>📞 {o.customer_phone}</div>}
                      {o.customer_email && <div style={{ fontSize: '0.73rem', color: '#64748b' }}>✉️ {o.customer_email}</div>}
                    </td>
                  ))}
                </tr>

                {/* Dates */}
                <tr>
                  <td className="attr-cell">Order & Validity Date</td>
                  {orderData.map(o => (
                    <td key={`${o.source || 'ord'}-${o.id}`} className="product-col">
                      <div style={{ fontSize: '0.78rem', color: '#1e293b' }}>
                        <span style={{ color: '#64748b' }}>Ordered:</span> <strong>{formatDate(o.created_at || o.issue_date)}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#1e293b', marginTop: 3 }}>
                        <span style={{ color: '#64748b' }}>Valid Till:</span> <strong>{formatDate(o.valid_until)}</strong>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Line Items */}
                <tr>
                  <td className="attr-cell">Line Items</td>
                  {orderData.map(o => (
                    <td key={`${o.source || 'ord'}-${o.id}`} className="product-col">
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a', marginBottom: 6 }}>
                        {o.items.length} item{o.items.length === 1 ? '' : 's'} included
                      </div>
                      {o.items.length === 0 ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No items detailed</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {o.items.map((it, idx) => {
                            const qty = Number.parseFloat(it.quantity ?? it.qty ?? 1)
                            const rate = Number.parseFloat(it.rate ?? it.unit_price ?? it.price ?? 0)
                            const lineTotal = Number.parseFloat(it.amount ?? it.total ?? it.total_price ?? it.line_total ?? (qty * rate)) || 0
                            const unitLabel = it.unit || 'pcs'

                            return (
                              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '6px 10px', fontSize: '0.74rem' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{it.name || it.product_name || `Item ${idx + 1}`}</div>
                                <div style={{ color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                  <span>{qty} {unitLabel} × ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <strong style={{ color: '#0f172a', fontWeight: 700 }}>₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Notes */}
                <tr>
                  <td className="attr-cell">Notes</td>
                  {orderData.map(o => (
                    <td key={`${o.source || 'ord'}-${o.id}`} className="product-col">
                      <div style={{ fontSize: '0.75rem', color: o.notes ? '#334155' : '#94a3b8', maxHeight: 80, overflowY: 'auto' }}>
                        {o.notes || '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="ws-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Tip: Click the <strong style={{ color: '#0f172a' }}>✕</strong> next to any order to remove it from comparison.
          </span>
          <button className="ws-modal-btn ws-modal-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const { canRead } = usePermissions('orders')

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [viewingQuote, setViewingQuote] = useState(null)

  const [selectedOrders, setSelectedOrders] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders', {
        params: {
          page,
          limit,
          search: search.trim() || undefined,
        },
      })
      setOrders(res.data?.data || [])
      setTotal(res.data?.total || 0)
      setTotalPages(res.data?.totalPages || 1)
    } catch (err) {
      dispatch(addToast({ message: err.response?.data?.error || 'Failed to load orders', type: 'error' }))
      setOrders([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canRead) {
      navigate(getFirstAccessibleRoute(), { replace: true })
      return
    }
    dispatch(setActiveNav('Orders'))
  }, [dispatch, canRead])

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 250)
    return () => clearTimeout(timer)
  }, [page, search])

  const sortedOrders = useMemo(() => {
    const rows = [...orders]
    if (sort === 'order_asc') {
      rows.sort((a, b) => String(a.order_number || '').localeCompare(String(b.order_number || '')))
    } else if (sort === 'order_desc') {
      rows.sort((a, b) => String(b.order_number || '').localeCompare(String(a.order_number || '')))
    } else if (sort === 'amount_desc') {
      rows.sort((a, b) => Number.parseFloat(b.total_amount || 0) - Number.parseFloat(a.total_amount || 0))
    }
    return rows
  }, [orders, sort])

  const getPageNumbers = () => {
    const pages = []
    for (let i = 1; i <= totalPages; i += 1) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  const allSelectedOnPage = sortedOrders.length > 0 && sortedOrders.every(o => selectedOrders.some(so => so.id === o.id))

  const handleToggleSelectAll = () => {
    if (allSelectedOnPage) {
      const pageIds = new Set(sortedOrders.map(o => o.id))
      setSelectedOrders(prev => prev.filter(o => !pageIds.has(o.id)))
    } else {
      setSelectedOrders(prev => {
        const map = new Map(prev.map(o => [o.id, o]))
        sortedOrders.forEach(o => map.set(o.id, o))
        return Array.from(map.values())
      })
    }
  }

  const handleToggleSelectRow = (order) => {
    setSelectedOrders(prev => {
      const exists = prev.some(o => o.id === order.id)
      if (exists) return prev.filter(o => o.id !== order.id)
      return [...prev, order]
    })
  }

  const handleRemoveFromCompare = (orderId) => {
    setSelectedOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const handleClearSelection = () => {
    setSelectedOrders([])
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Orders</span>
                <span className="ws-unified-header-badge">{total} orders</span>
              </div>

              <div className="ws-unified-header-actions">
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search orders..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>

                <button
                  className="attio-btn"
                  onClick={() => {
                    setSort(prev => prev === 'order_asc' ? 'order_desc' : prev === 'order_desc' ? 'amount_desc' : prev === 'amount_desc' ? '' : 'order_asc')
                  }}
                  style={{
                    background: sort ? '#f1f5f9' : '#ffffff',
                    borderColor: sort ? '#0f172a' : '#cbd5e1',
                    fontWeight: sort ? 600 : 500,
                  }}
                >
                  <ArrowUpDown size={13} />
                  Sort {sort === 'order_asc' ? 'A-Z' : sort === 'order_desc' ? 'Z-A' : sort === 'amount_desc' ? 'Amount' : ''}
                </button>

              </div>
            </div>

            <div className="attio-table-card">
              <div className="attio-table-wrap">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                    <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : sortedOrders.length === 0 ? (
                  <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                    No orders found.
                  </div>
                ) : (
                  <table className="attio-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                          <input 
                            type="checkbox" 
                            className="attio-chk" 
                            checked={allSelectedOnPage}
                            onChange={handleToggleSelectAll}
                            title="Select all on this page"
                          />
                        </th>
                        <th>ORDER</th>
                        <th>CUSTOMER</th>
                        <th>QUOTE</th>
                        <th>ORDER DATE</th>
                        <th>VALID UNTIL</th>
                        <th style={{ textAlign: 'right' }}>TOTAL</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedOrders.map(row => {
                        const customerName = row.customer_name || 'General Customer'
                        const isSelected = selectedOrders.some(so => so.id === row.id)

                        return (
                          <tr key={`${row.source}-${row.id}`} style={{ background: isSelected ? '#f0f5ff' : undefined }}>
                            <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(row)}
                                title="Select order"
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                                  {row.order_number && !row.order_number.startsWith('QT-') ? row.order_number : `ORD-${row.quote_number ? row.quote_number.replace(/^QT-?/i, '') : row.id}`}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 500 }}>
                                  From accepted quotation
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="attio-avatar" style={{ background: getAvatarColor(customerName) }}>
                                  {getSingleLetter(customerName)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 535, fontSize: '0.78rem', color: '#1e293b' }}>
                                    {customerName}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '0.67rem' }}>
                                    {row.customer_phone || row.customer_email || 'No contact'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="attio-category-tag" style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                padding: '3px 10px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}>
                                {row.quote_number || `QT-${row.id}`}
                              </span>
                            </td>
                            <td>{formatDate(row.created_at)}</td>
                            <td>{formatDate(row.valid_until)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatCurrency(row.total_amount)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                                <button
                                  onClick={() => setViewingQuote(row)}
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
                                  }}
                                  title="Preview quotation"
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

      {viewingQuote && (
        <QuotePreviewModal
          quote={viewingQuote}
          onClose={() => setViewingQuote(null)}
        />
      )}

      {showCompareModal && (
        <OrderComparisonModal
          orders={selectedOrders}
          onClose={() => setShowCompareModal(false)}
          onRemoveOrder={handleRemoveFromCompare}
          onClearAll={handleClearSelection}
        />
      )}

      {/* Floating Action Pill when orders are selected */}
      {selectedOrders.length > 0 && (
        <div className="product-compare-floating-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {selectedOrders.length}
            </span>
            <span style={{ fontWeight: 500 }}>
              order{selectedOrders.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: '#334155' }} />

          {selectedOrders.length >= 2 ? (
            <button
              onClick={() => setShowCompareModal(true)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.15s'
              }}
            >
              <ArrowLeftRight size={14} /> Compare Orders
            </button>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Select 1 more order to compare
            </span>
          )}

          <button
            onClick={handleClearSelection}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '2px 6px',
              textDecoration: 'underline'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
          >
            Deselect all
          </button>
        </div>
      )}
    </div>
  )
}
