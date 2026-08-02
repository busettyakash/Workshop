import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, selectSidebarOpen, setActiveNav } from '../../redux/slices/uiSlice'
import api from '../../api/client'
import TablePagination from '../../components/ui/TablePagination'
import { ArrowUpDown, Eye, Loader2, Search } from 'lucide-react'
import { getAvatarColor, getSingleLetter } from '../../utils/tableHelpers'
import QuotePreviewModal from '../Quotes/QuotePreviewModal'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'

const limit = 20

function formatCurrency(value) {
  return (parseFloat(value || 0)).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Orders() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [viewingQuote, setViewingQuote] = useState(null)

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
    dispatch(setActiveNav('Orders'))
  }, [dispatch])

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
      rows.sort((a, b) => parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0))
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
                          <input type="checkbox" className="attio-chk" readOnly />
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

                        return (
                          <tr key={`${row.source}-${row.id}`}>
                            <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                              <input type="checkbox" className="attio-chk" readOnly />
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
    </div>
  )
}
