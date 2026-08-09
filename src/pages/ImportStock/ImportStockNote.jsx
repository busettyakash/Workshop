import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Edit3, Trash2, Copy, Check, FileText, X } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails } from '../../utils/unitHelpers'
import '../Dashboard/Dashboard.css'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function ImportStockNote() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [stockItem, setStockItem] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [copied, setCopied] = useState(false)
  const [paidAmt, setPaidAmt] = useState('')
  const [payMode, setPayMode] = useState('')
  const [payments, setPayments] = useState([])
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null })

  const formatNumberWithCommas = (val) => {
    if (val === null || val === undefined || val === '') return ''
    const parts = val.toString().split('.')
    let integerPart = parts[0].replace(/[^0-9]/g, '')
    const decimalPart = parts.length > 1 ? '.' + parts[1].replace(/[^0-9]/g, '').slice(0, 2) : ''
    
    if (integerPart) {
      const num = parseInt(integerPart, 10)
      if (!isNaN(num)) {
        integerPart = num.toLocaleString('en-IN')
      }
    }
    return integerPart + decimalPart
  }

  const generateNoteText = (item) => {
    if (!item) return ''
    const bulkUnit = getBulkUnitDetails(item.unit)
    const unitShort = bulkUnit?.short || 'unit'
    const unitPlural = bulkUnit?.pluralName || 'Bags / Units'
    const bw = parseFloat(item.bag_weight || 1)
    
    const buyRatePerUnit = parseFloat(item.buying_price || 0) > 0
      ? (item.price_covers > 0 ? (parseFloat(item.buying_price) / item.price_covers).toFixed(2) : (bw > 0 ? (parseFloat(item.buying_price) / bw).toFixed(2) : '0.00'))
      : '0.00'

    return `=== REVIEW IMPORT STOCK SUMMARY ===

SUPPLIER / BUYER DETAILS:
Name: ${item.buyer_name || 'Not provided'}
Phone: ${item.buyer_phone || 'Not provided'}
Location: ${[item.buyer_city, item.buyer_state].filter(Boolean).join(', ') || 'Not provided'}

PRODUCT SPECIFICATIONS:
Product Name: ${item.name}
SKU / Barcode: ${item.sku || 'N/A'}
Category: ${item.category || 'General'}
Pack Weight: ${item.bag_weight} ${unitShort} per pack

PRICING & UNIT RATE ANALYSIS:
Buyer Price (Supplier): ₹${item.buying_price ? parseFloat(item.buying_price).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'} (₹${buyRatePerUnit} / ${unitShort} cost)
Updated Market Price: ${item.updated_price ? `₹${parseFloat(item.updated_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}

TOTAL INVENTORY STOCK:
Amount of Bags: ${item.stock} ${unitPlural}
Pack Size: ${item.bag_weight} ${unitShort} / pack
Total Weight: ${(parseFloat(item.stock || 0) * bw).toLocaleString('en-IN')} ${unitShort}`
  }

  useEffect(() => {
    dispatch(setActiveNav('Import Stock'))
    fetchItem()
  }, [id, dispatch])

  const fetchItem = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/import-stock/${id}`)
      const item = res.data?.data
      if (item) {
        setStockItem(item)
        setNoteText(item.note || generateNoteText(item))
        setPayments(item.payments || [])
        setPaidAmt('')
        setPayMode('')
      } else {
        dispatch(addToast({ message: 'Staged stock product not found', type: 'error' }))
        navigate('/import-stock')
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Unknown error'
      dispatch(addToast({ message: `Failed to load stock details: ${errMsg}`, type: 'error' }))
      navigate('/import-stock')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!noteText) return
    navigator.clipboard.writeText(noteText)
    setCopied(true)
    dispatch(addToast({ message: 'Note copied to clipboard!', type: 'success' }))
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSavePayment = async () => {
    if (!paidAmt || parseFloat(paidAmt) <= 0) {
      dispatch(addToast({ message: 'Please enter a valid amount', type: 'error' }))
      return
    }
    if (!payMode) {
      dispatch(addToast({ message: 'Please select a payment mode', type: 'error' }))
      return
    }
    setSaving(true)
    try {
      const res = await api.post(`/import-stock/${id}/payments`, {
        amount: parseFloat(paidAmt),
        payment_mode: payMode
      })
      dispatch(addToast({ message: 'Payment recorded successfully!', type: 'success' }))
      setPayments(prev => [res.data, ...prev])
      setPaidAmt('')
      setPayMode('')
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Unknown error'
      dispatch(addToast({ message: `Failed to record payment: ${errMsg}`, type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePaymentClick = (paymentId) => {
    setConfirmDelete({ isOpen: true, id: paymentId })
  }

  const handleConfirmDeletePayment = async () => {
    const paymentId = confirmDelete.id
    if (!paymentId) return
    try {
      await api.delete(`/import-stock/${id}/payments/${paymentId}`)
      dispatch(addToast({ message: 'Payment log deleted successfully!', type: 'success' }))
      setPayments(prev => prev.filter(p => p.id !== paymentId))
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete payment log', type: 'error' }))
    } finally {
      setConfirmDelete({ isOpen: false, id: null })
    }
  }

  const bulkUnit = stockItem ? getBulkUnitDetails(stockItem.unit) : null
  const unitShort = bulkUnit?.short || 'unit'
  const unitPlural = bulkUnit?.pluralName || 'Bags / Units'
  const bw = parseFloat(stockItem?.bag_weight || 1)
  
  const buyRatePerUnit = stockItem && parseFloat(stockItem.buying_price || 0) > 0
    ? (stockItem.price_covers > 0 ? (parseFloat(stockItem.buying_price) / stockItem.price_covers).toFixed(2) : (bw > 0 ? (parseFloat(stockItem.buying_price) / bw).toFixed(2) : '0.00'))
    : '0.00'

  const calcTotalSupplierCost = (item) => {
    if (!item) return 0
    const bags = parseFloat(item.stock || 0)
    const bp = parseFloat(item.buying_price || 0)
    const pc = parseFloat(item.price_covers || 0)
    if (pc > 0) {
      return bags * bw * (bp / pc)
    } else {
      return bags * bp
    }
  }

  const calcAddStockCost = (item) => {
    if (!item) return 0
    const bags = parseFloat(item.add_stock_qty || 0)
    const bp = parseFloat(item.buying_price || 0)
    const pc = parseFloat(item.price_covers || 0)
    if (pc > 0) {
      return bags * bw * (bp / pc)
    } else {
      return bags * bp
    }
  }

  const calculatedSupplierCost = calcTotalSupplierCost(stockItem)
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const remainingBalance = calculatedSupplierCost - totalPaid

  const totalWeight = stockItem ? (parseFloat(stockItem.stock || 0) * bw) : 0

  const addQty = stockItem ? parseFloat(stockItem.add_stock_qty || 0) : 0
  const finalStock = stockItem ? parseFloat(stockItem.stock || 0) : 0
  const prevStock = finalStock - addQty
  const addStockCost = calcAddStockCost(stockItem)
  const prevStockCost = calcTotalSupplierCost({
    ...stockItem,
    stock: prevStock
  })
  const totalStockCost = prevStockCost + addStockCost

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
              <Loader2 size={32} className="ws-chat-loader-spin" style={{ color: '#2563eb' }} />
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Note details: {stockItem?.name}
                  </h2>
                  <span className="attio-badge attio-badge-blue" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                    {stockItem?.status ? (stockItem.status.charAt(0).toUpperCase() + stockItem.status.slice(1)) : 'Draft'}
                  </span>
                </div>

                <button
                  type="button"
                  className="attio-btn"
                  onClick={() => navigate('/import-stock')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 12px' }}
                >
                  <ArrowLeft size={13} /> Back to Import Stock
                </button>
              </div>

              {/* Note Card */}
              <div className="attio-table-card" style={{ padding: 24, background: '#ffffff', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
                {/* Note Body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Grid Layout for Supplier & Product */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      {/* Supplier/Buyer details */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                          Supplier / Buyer Details
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                          <div><strong>Name:</strong> {stockItem?.buyer_name || '—'}</div>
                          <div><strong>Phone:</strong> {stockItem?.buyer_phone || '—'}</div>
                          <div><strong>Location:</strong> {[stockItem?.buyer_city, stockItem?.buyer_state].filter(Boolean).join(', ') || '—'}</div>
                        </div>
                      </div>

                      {/* Product specifications */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                          Product Specifications
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                          <div><strong>Product Name:</strong> {stockItem?.name}</div>
                          <div><strong>SKU / Barcode:</strong> {stockItem?.sku || 'N/A'}</div>
                          <div><strong>Category:</strong> {stockItem?.category || 'General'}</div>
                          <div><strong>Pack Weight:</strong> {stockItem?.bag_weight} {unitShort} per pack</div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Unit Rate Analysis */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        Pricing & Unit Rate Analysis
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {/* Buyer Price */}
                        <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: '10px 12px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 500 }}>Buyer Price (Supplier)</div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#166534', marginTop: 4 }}>
                            ₹{stockItem?.buying_price ? parseFloat(stockItem.buying_price).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: 2 }}>₹{buyRatePerUnit} / {unitShort} cost</div>
                        </div>

                        {/* Supplier Total Cost */}
                        <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: '10px 12px', borderRadius: 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 500 }}>Total Supplier Cost</div>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#166534', marginTop: 4 }}>
                              ₹{calculatedSupplierCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#15803d', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {stockItem?.price_covers > 0
                              ? `${stockItem?.stock} Bags * ${stockItem?.bag_weight} ${unitShort} * (${parseFloat(stockItem?.buying_price || 0).toLocaleString('en-IN')} / ${parseFloat(stockItem?.price_covers || 1).toLocaleString('en-IN')})`
                              : `${stockItem?.stock} Bags * ${parseFloat(stockItem?.buying_price || 0).toLocaleString('en-IN')}`}
                          </div>
                        </div>

                        {/* Remaining Balance */}
                        <div style={{ background: '#fff', border: '1px solid #dcfce7', padding: '10px 12px', borderRadius: 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 500 }}>Remaining Balance</div>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: remainingBalance > 0 ? '#b91c1c' : '#166534', marginTop: 4 }}>
                              ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: 2 }}>
                            Total Paid: ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Total Inventory Stock */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Left: Stock Overview & Pack Details */}
                      <div>
                        <div style={{ fontSize: '0.74rem', color: '#1e40af', fontWeight: 600 }}>Total Inventory Stock</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a8a', marginTop: 3 }}>
                          {finalStock} {unitPlural}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#2563eb', display: 'flex', gap: 12, marginTop: 6 }}>
                          <div>Pack Size: <strong>{stockItem?.bag_weight} {unitShort} / pack</strong></div>
                          <div>Total Weight: <strong>{totalWeight.toLocaleString('en-IN')} {unitShort}</strong></div>
                        </div>
                      </div>

                      {/* Right: Transition Details */}
                      {addQty !== 0 ? (
                        <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#1e40af', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div>Previous: <strong>{prevStock} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{prevStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                          <div>{addQty > 0 ? 'Added' : 'Decreased'}: <strong>{addQty > 0 ? `+${addQty}` : `${addQty}`} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{Math.abs(addStockCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                          <div>Total: <strong>{finalStock} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{totalStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#1e40af' }}>
                          Total Cost: <strong>₹{totalStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                    </div>

                    {/* Record Supplier Payment Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginTop: 14 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                        Record Supplier Payment
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Amount Paid (₹)
                          </label>
                           <input
                            type="text"
                            value={formatNumberWithCommas(paidAmt)}
                            onChange={e => {
                              const cleanValue = e.target.value.replace(/[^0-9.]/g, '')
                              const parts = cleanValue.split('.')
                              const finalValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '')
                              setPaidAmt(finalValue)
                            }}
                            placeholder="e.g. 1,30,000"
                            style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', color: '#1e293b' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Payment Mode
                          </label>
                          <select
                            value={payMode}
                            onChange={e => setPayMode(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', color: '#1e293b', background: '#fff' }}
                          >
                            <option value="">-- Select Mode --</option>
                            <option value="Cash">Cash</option>
                            <option value="PhonePe">PhonePe</option>
                            <option value="GPay">GPay / UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <button
                          onClick={handleSavePayment}
                          disabled={saving}
                          className="attio-btn attio-btn-primary"
                          style={{ height: 28, fontSize: '0.75rem', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
                        >
                          {saving ? <Loader2 size={12} className="ws-chat-loader-spin" /> : <Check size={12} />}
                          Save Payment Details
                        </button>
                      </div>
                    </div>

                    {/* Custom User notes if edited */}
                    {stockItem?.note && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 4 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Custom Notes / Description
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: '0.82rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {stockItem.note}
                        </div>
                      </div>
                    )}

                    {/* Payment History timeline log */}
                    {payments.length > 0 && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 14 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                          Payment History / Logs
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {payments.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: '0.78rem', color: '#334155' }}>
                              <div>
                                <strong>{new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>: Paid <strong>₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> via <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>{p.payment_mode}</span>
                              </div>
                              <button
                                onClick={() => handleDeletePaymentClick(p.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                title="Delete payment log"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Payment Log"
        message="Are you sure you want to delete this payment log?"
        onConfirm={handleConfirmDeletePayment}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
      />
    </div>
  )
}
