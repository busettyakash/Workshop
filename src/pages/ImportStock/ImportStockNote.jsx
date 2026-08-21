import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Edit3, Trash2, Copy, Check, FileText, X, Wallet, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails, formatStockDisplay } from '../../utils/unitHelpers'
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
        setNoteText(item.note || '')
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
                        <div style={{ fontSize: '0.74rem', color: '#1e40af', fontWeight: 600 }}>Purchased Batch Stock Overview</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a8a', marginTop: 3 }}>
                          {(parseFloat(stockItem?.stock || 0) + addQty)} {unitPlural}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#2563eb', display: 'flex', gap: 12, marginTop: 4 }}>
                          <div>Pack Size: <strong>{stockItem?.bag_weight} {unitShort} / pack</strong></div>
                          <div>Total Weight: <strong>{totalWeight.toLocaleString('en-IN')} {unitShort}</strong></div>
                        </div>
                      </div>

                      {/* Right: Transition Details */}
                      {addQty !== 0 ? (
                        <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#1e40af', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div>Initial Batch Qty: <strong>{stockItem?.stock || 0} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{prevStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                          <div>Added Stock: <strong>+{addQty} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{Math.abs(addStockCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                          <div>Total Batch Purchased: <strong>{(parseFloat(stockItem?.stock || 0) + addQty)} {unitPlural}</strong> <span style={{ color: '#475569' }}>(Cost: ₹{totalStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span></div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#1e40af' }}>
                          Total Batch Cost: <strong>₹{totalStockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )}
                    </div>

                    {/* Record Supplier Payment Card */}
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '16px 18px',
                      marginTop: 14,
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14
                    }}>
                      {/* Header with Title & Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                            Record Supplier Payment
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                            Log payments made against this supplier batch
                          </div>
                        </div>

                        {/* Balance Due Status Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {remainingBalance > 0 ? (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 9px', borderRadius: 20,
                              background: '#fff7ed', border: '1px solid #fed7aa',
                              color: '#c2410c', fontSize: '0.74rem', fontWeight: 600
                            }}>
                              <span>Due: ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px', borderRadius: 20,
                              background: '#f0fdf4', border: '1px solid #bbf7d0',
                              color: '#15803d', fontSize: '0.74rem', fontWeight: 600
                            }}>
                              <CheckCircle2 size={13} />
                              <span>Paid in Full</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Input Grid Form */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                        {/* Amount Field */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Amount Paid (₹) *
                          </label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: 10, fontSize: '0.82rem', fontWeight: 600, color: '#64748b', pointerEvents: 'none' }}>₹</span>
                            <input
                              type="text"
                              value={formatNumberWithCommas(paidAmt)}
                              onChange={e => {
                                const cleanValue = e.target.value.replace(/[^0-9.]/g, '')
                                const parts = cleanValue.split('.')
                                const finalValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '')
                                setPaidAmt(finalValue)
                              }}
                              placeholder="0.00"
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                height: 36, padding: '0 10px 0 24px',
                                border: '1.5px solid #cbd5e1', borderRadius: 7,
                                fontSize: '0.84rem', fontWeight: 600, color: '#0f172a',
                                outline: 'none', background: '#ffffff',
                                transition: 'border-color 0.15s, box-shadow 0.15s'
                              }}
                              onFocus={e => {
                                e.target.style.borderColor = '#2563eb'
                                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                              }}
                              onBlur={e => {
                                e.target.style.borderColor = '#cbd5e1'
                                e.target.style.boxShadow = 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* Payment Mode Field */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Payment Mode *
                          </label>
                          <select
                            value={payMode}
                            onChange={e => setPayMode(e.target.value)}
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              height: 36, padding: '0 10px',
                              border: '1.5px solid #cbd5e1', borderRadius: 7,
                              fontSize: '0.82rem', fontWeight: 500, color: payMode ? '#0f172a' : '#64748b',
                              background: '#ffffff', outline: 'none',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s, box-shadow 0.15s'
                            }}
                            onFocus={e => {
                              e.target.style.borderColor = '#2563eb'
                              e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                            }}
                            onBlur={e => {
                              e.target.style.borderColor = '#cbd5e1'
                              e.target.style.boxShadow = 'none'
                            }}
                          >
                            <option value="">-- Select Payment Mode --</option>
                            <option value="Cash">Cash</option>
                            <option value="PhonePe">PhonePe / UPI</option>
                            <option value="GPay">Google Pay (GPay)</option>
                            <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>

                        {/* Submit Button */}
                        <div>
                          <button
                            type="button"
                            onClick={handleSavePayment}
                            disabled={saving}
                            style={{
                              height: 36,
                              padding: '0 16px',
                              borderRadius: 7,
                              background: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.80rem',
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                              whiteSpace: 'nowrap',
                              transition: 'background 0.15s, transform 0.1s'
                            }}
                            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#1d4ed8' }}
                            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#2563eb' }}
                          >
                            {saving ? <Loader2 size={14} className="ws-chat-loader-spin" /> : <Check size={14} />}
                            <span>Save Payment</span>
                          </button>
                        </div>
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
                      <div style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: 16,
                        marginTop: 16
                      }}>
                        {/* Section Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                              Payment History & Records
                            </div>
                            <span style={{
                              fontSize: '0.70rem',
                              fontWeight: 600,
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '2px 8px',
                              borderRadius: 12
                            }}>
                              {payments.length} {payments.length === 1 ? 'transaction' : 'transactions'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d' }}>
                            Total Settled: ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {/* Transactions Table */}
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: '#ffffff'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.80rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                <th style={{ padding: '8px 14px', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '8px 14px', fontWeight: 600 }}>Payment Mode</th>
                                <th style={{ padding: '8px 14px', fontWeight: 600, textAlign: 'right' }}>Amount Paid</th>
                                <th style={{ padding: '8px 14px', fontWeight: 600, textAlign: 'center', width: 44 }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map((p, pIdx) => {
                                const modeStyle = (() => {
                                  const m = String(p.payment_mode || '').toLowerCase()
                                  if (m.includes('cash')) return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' }
                                  if (m.includes('phonepe') || m.includes('gpay') || m.includes('upi')) return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' }
                                  if (m.includes('bank') || m.includes('transfer') || m.includes('neft') || m.includes('rtgs')) return { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' }
                                  return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' }
                                })()

                                return (
                                  <tr
                                    key={p.id}
                                    style={{
                                      borderBottom: pIdx < payments.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                  >
                                    <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 500 }}>
                                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        background: modeStyle.bg,
                                        color: modeStyle.text,
                                        border: `1px solid ${modeStyle.border}`
                                      }}>
                                        {p.payment_mode || 'Cash'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#166534', fontSize: '0.86rem' }}>
                                      ₹{parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePaymentClick(p.id)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#94a3b8',
                                          cursor: 'pointer',
                                          padding: '4px 6px',
                                          borderRadius: 4,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.color = '#ef4444'
                                          e.currentTarget.style.background = '#fee2e2'
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.color = '#94a3b8'
                                          e.currentTarget.style.background = 'transparent'
                                        }}
                                        title="Delete payment entry"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
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
