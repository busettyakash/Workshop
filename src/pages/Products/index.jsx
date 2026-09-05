import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Plus, Filter, ArrowUpDown, Package, X, Edit2, Trash2, Loader2, Search, Eye, ArrowLeftRight } from 'lucide-react'
import { drawBarcode } from '../../utils/barcode'
import { getAvatarColor, getSingleLetter, getCategoryTagStyle } from '../../utils/tableHelpers'
import { getBulkUnitDetails, formatStockDisplay } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'
import './Products.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import TablePagination from '../../components/ui/TablePagination'
import { hasModulePermission, getFirstAccessibleRoute, usePermissions } from '../../utils/permissionUtils'


const getStockBadgeClass = (stock, looseKg = 0, bagWeight = 1) => {
  const s = Number.parseFloat(stock || 0)
  const l = Number.parseFloat(looseKg || 0)
  const bw = Number.parseFloat(bagWeight || 1)
  const totalBase = (bw > 1 ? s * bw : s) + l
  if (totalBase > 10) return 'attio-stock-high'
  if (totalBase > 0) return 'attio-stock-low'
  return 'attio-stock-out'
}

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
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const targetId = product?.product_id || product?.id
  const bulkUnit = getBulkUnitDetails(product?.unit)
  const bagWeight = Number.parseFloat(product?.bag_weight || 1)

  const calcBagPrice = (rawVal) => {
    const p = Number.parseFloat(rawVal || 0)
    if (p <= 0) return 0
    return p
  }

  const basePriceVal = calcBagPrice(product?.price)
  const activeBagPrice = product?.updated_price ? calcBagPrice(product.updated_price) : basePriceVal

  const unitPrice = (bagWeight > 0 ? (activeBagPrice / bagWeight) : activeBagPrice).toFixed(2)
  const updatedDateStr = product?.updated_price_date ? String(product.updated_price_date).split('T')[0] : ''

  useEffect(() => {
    let isMounted = true
    if (!targetId) {
      setLoadingHistory(false)
      return
    }
    api.get(`/products/${targetId}/price-history`)
      .then(res => {
        if (isMounted) setHistory(res.data || [])
      })
      .catch(() => {
        if (isMounted) {
          const defaultItems = []
          if (product?.updated_price) {
            defaultItems.push({
              id: 'h2',
              old_price: product.price,
              new_price: product.updated_price,
              effective_date: updatedDateStr || new Date().toISOString().split('T')[0],
              notes: 'Updated Price'
            })
          }
          if (product?.price) {
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
  }, [targetId])

  if (!product) return null

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="ws-modal-card" style={{ maxWidth: 480, width: '90%' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Base Price ({bagWeight} {bulkUnit?.short || product?.unit || 'kg'})</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                ₹{basePriceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 500 }}>Active Updated Price ({bagWeight} {bulkUnit?.short || product?.unit || 'kg'})</span>
              <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
                ₹{activeBagPrice.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {bulkUnit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Package Breakdown: {bulkUnit.name} ({bagWeight}{bulkUnit.short})</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb' }}>
                ₹{Number.parseFloat(unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {bulkUnit.short}
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
                  const newRaw = Number.parseFloat(item.new_price || 0)
                  const oldRaw = item.old_price !== null && item.old_price !== undefined ? Number.parseFloat(item.old_price) : null

                  const newBagP = calcBagPrice(newRaw)
                  const oldBagP = oldRaw !== null ? calcBagPrice(oldRaw) : null

                  const diff = oldBagP !== null ? (newBagP - oldBagP) : 0
                  const isUp = diff > 0
                  const itemUnitPrice = bulkUnit ? (newBagP / bagWeight).toFixed(2) : null

                  return (
                    <div key={item.id || idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>₹{newBagP.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {bagWeight > 1 && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                              ({bagWeight} {bulkUnit?.short || product?.unit || 'kgs'} price)
                            </span>
                          )}
                          {diff !== 0 && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isUp ? '#16a34a' : '#dc2626', background: isUp ? '#dcfce7' : '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                              {isUp ? `+₹${diff.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-₹${Math.abs(diff).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                            ₹{Number.parseFloat(itemUnitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {bulkUnit.short}
                          </div>
                        )}
                        {oldBagP !== null && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Prev: ₹{oldBagP.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

function ProductComparisonModal({ products, onClose, onRemoveProduct, onClearAll }) {
  if (!products || products.length === 0) return null

  const productData = products.map(p => {
    const bulkUnit = getBulkUnitDetails(p.unit)
    const uomShort = (bulkUnit?.short || p.unit || 'kg').toLowerCase().replace(/s$/, '')
    const pc = Number.parseFloat(p.price_covers || 0)
    const bw = Number.parseFloat(p.bag_weight || 1)
    const rawP = Number.parseFloat(p.price || 0)
    const rawUP = Number.parseFloat(p.updated_price || 0)

    let priceVal = rawP
    if (pc > 0 && bw > 0 && pc !== bw) {
      priceVal = (rawP / bw) * pc
    }

    let updatedPriceVal = rawUP
    if (rawUP > 0 && pc > 0 && bw > 0 && pc !== bw) {
      updatedPriceVal = (rawUP / bw) * pc
    }

    const priceSubtext = pc > 0 ? `${pc} ${uomShort}` : (bw > 1 ? `${bw} ${uomShort}` : `1 ${uomShort}`)
    const effectiveUnitPrice = bw > 0 ? (rawP / bw) : rawP
    const effectiveUpdatedUnitPrice = (rawUP > 0 && bw > 0) ? (rawUP / bw) : (rawUP > 0 ? rawUP : null)

    const stockQty = Number.parseFloat(p.stock || 0)
    const looseQty = Number.parseFloat(p.loose_kg || 0)
    const totalBaseUnits = (bw > 1 ? stockQty * bw : stockQty) + looseQty
    const activeRate = effectiveUpdatedUnitPrice !== null ? effectiveUpdatedUnitPrice : effectiveUnitPrice
    const stockValuation = totalBaseUnits * activeRate

    return {
      ...p,
      bulkUnit,
      uomShort,
      bw,
      pc,
      priceVal,
      priceSubtext,
      effectiveUnitPrice,
      effectiveUpdatedUnitPrice,
      updatedPriceVal,
      totalBaseUnits,
      stockValuation
    }
  })

  const allSameUnit = productData.length > 1 && productData.every(p => p.uomShort === productData[0].uomShort)
  const minEffectiveRate = allSameUnit ? Math.min(...productData.map(p => (p.effectiveUpdatedUnitPrice || p.effectiveUnitPrice))) : null

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
                  Product Comparison
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Comparing {products.length} product{products.length > 1 ? 's' : ''} side-by-side
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {products.length > 0 && (
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
          {products.length < 2 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#475467' }}>
                <ArrowLeftRight size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#1e293b' }}>Select at least 2 products</h4>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: 360, marginInline: 'auto' }}>
                You have removed products from comparison. Please select at least 2 products from the product table to compare them side-by-side.
              </p>
            </div>
          ) : (
            <table className="compare-matrix-table">
              <thead>
                <tr>
                  <th className="attr-col">Product Details</th>
                  {productData.map(p => {
                    const catStyle = getCategoryTagStyle(p.category)
                    return (
                      <th key={p.id} className="product-col" style={{ background: '#ffffff', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="attio-avatar" style={{ background: getAvatarColor(p.name), width: 26, height: 26, minWidth: 26, fontSize: '0.82rem' }}>
                              {getSingleLetter(p.name)}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.2 }}>
                                {p.name}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                HSN: {p.hsn_code || p.sku || '—'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveProduct(p.id)}
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
                          <span style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, borderRadius: 5, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-block' }}>
                            {p.category || 'Unassigned'}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Row: Base Price */}
                <tr>
                  <td className="attr-cell">Base Price</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                        ₹{p.priceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        per {p.priceSubtext}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row: Updated Price */}
                <tr>
                  <td className="attr-cell">Updated Price</td>
                  {productData.map(p => {
                    if (!p.updated_price) {
                      return (
                        <td key={p.id} className="product-col" style={{ color: '#94a3b8' }}>
                          — (No update)
                        </td>
                      )
                    }
                    const diff = p.updatedPriceVal - p.priceVal
                    const isLower = diff < 0
                    return (
                      <td key={p.id} className="product-col">
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb' }}>
                          ₹{p.updatedPriceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: isLower ? '#16a34a' : '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isLower ? `↓ Savings of ₹${Math.abs(diff).toFixed(2)}` : `↑ Higher by ₹${diff.toFixed(2)}`}
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Row: Effective Rate */}
                <tr>
                  <td className="attr-cell">Effective Rate</td>
                  {productData.map(p => {
                    const activeRate = p.effectiveUpdatedUnitPrice !== null ? p.effectiveUpdatedUnitPrice : p.effectiveUnitPrice
                    const isBest = minEffectiveRate !== null && activeRate === minEffectiveRate
                    return (
                      <td key={p.id} className="product-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isBest ? '#15803d' : '#334155' }}>
                            ₹{activeRate.toFixed(2)} / {p.uomShort}
                          </span>
                          {isBest && (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                              Best Value
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Standard base unit rate
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Row: Stock Available */}
                <tr>
                  <td className="attr-cell">Stock on Hand</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <span className={`attio-stock-badge ${getStockBadgeClass(p.stock, p.loose_kg, p.bag_weight)}`}>
                        {formatStockDisplay(p.stock, p.bag_weight, p.unit, p.loose_kg)}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                        Total: {p.totalBaseUnits.toLocaleString('en-IN')} {p.uomShort}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row: Estimated Stock Valuation */}
                <tr>
                  <td className="attr-cell">Stock Valuation</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>
                        ₹{p.stockValuation.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Qty × Effective Rate
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row: Packaging & Unit */}
                <tr>
                  <td className="attr-cell">Packaging Specs</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500 }}>
                        {p.unit || 'Standard'} ({p.bw} {p.uomShort})
                      </div>
                      {p.pc > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Price covers: {p.pc} {p.uomShort}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Row: Status */}
                <tr>
                  <td className="attr-cell">Status</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <span className={`attio-status-badge ${p.status === 'active' ? 'attio-status-active' : 'attio-status-inactive'}`}>
                        {p.status || 'active'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Row: Next Restock */}
                <tr>
                  <td className="attr-cell">Next Restock</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      <span style={{ fontSize: '0.82rem', color: p.next_restock_time ? '#0f172a' : '#94a3b8' }}>
                        {p.next_restock_time || '—'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Row: Barcode / SKU */}
                <tr>
                  <td className="attr-cell">Barcode (SKU)</td>
                  {productData.map(p => (
                    <td key={p.id} className="product-col">
                      {p.sku ? (
                        <div style={{ display: 'inline-block' }}>
                          <ProductBarcode sku={p.sku} />
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
                            {p.sku}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
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
            Tip: Click the <strong style={{ color: '#0f172a' }}>✕</strong> next to any product name to remove it from comparison.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ws-modal-btn ws-modal-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const dispatch  = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const navigate = useNavigate()

  const { canRead, canDelete, hasModulePermission: checkModPerm } = usePermissions('products')
  const canAccessImportStock = checkModPerm ? checkModPerm('import_stock') : hasModulePermission('import_stock')
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [selectedPricing, setSelectedPricing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, name: '' })

  const [selectedProducts, setSelectedProducts] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)

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
      console.error(err)
      dispatch(addToast({ message: 'Failed to load products', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (!canRead) {
      navigate(getFirstAccessibleRoute(), { replace: true })
      return
    }
    dispatch(setActiveNav('Products')) 
    fetchProducts(page)
  }, [dispatch, page, search, sort, filterCategory, filterStatus, canRead])



  const handleConfirmDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, name: '' })
    try {
      await api.delete(`/products/${id}`)
      setProducts(prev => prev.filter(p => p.id !== id))
      dispatch(addToast({ message: 'Product deleted successfully', type: 'success' }))
    } catch (err) {
      console.error(err)
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
      console.error(err)
      dispatch(addToast({ message: 'Failed to update restock time', type: 'error' }))
    }
  }

  const allSelectedOnPage = products.length > 0 && products.every(p => selectedProducts.some(sp => sp.id === p.id))

  const handleToggleSelectAll = () => {
    if (allSelectedOnPage) {
      const pageIds = new Set(products.map(p => p.id))
      setSelectedProducts(prev => prev.filter(p => !pageIds.has(p.id)))
    } else {
      setSelectedProducts(prev => {
        const map = new Map(prev.map(p => [p.id, p]))
        products.forEach(p => map.set(p.id, p))
        return Array.from(map.values())
      })
    }
  }

  const handleToggleSelectRow = (product) => {
    setSelectedProducts(prev => {
      const exists = prev.some(p => p.id === product.id)
      if (exists) return prev.filter(p => p.id !== product.id)
      return [...prev, product]
    })
  }

  const handleRemoveFromCompare = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId))
  }

  const handleClearSelection = () => {
    setSelectedProducts([])
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

                {canAccessImportStock && (
                  <button className="attio-btn attio-btn-primary" onClick={() => navigate('/import-stock')}>
                    Return to Import Stock
                  </button>
                )}
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
                          <input 
                            type="checkbox" 
                            className="attio-chk" 
                            checked={allSelectedOnPage}
                            onChange={handleToggleSelectAll}
                            title="Select all on this page"
                          />
                        </th>
                        <th>PRODUCT NAME</th>
                        <th>HSN CODE</th>
                        <th>CATEGORY</th>
                        <th>PRICE</th>
                        <th>UPDATED PRICE</th>
                        <th>STOCK</th>
                        <th>STATUS</th>
                        <th>NEXT RESTOCK</th>
                        <th>BARCODE</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(row => {
                        const restockOpts = ['TBD', 'In 30 mins', 'Tomorrow', 'Next week', 'Next month']
                        const restock = row.next_restock_time || 'TBD'
                        const isSelected = selectedProducts.some(sp => sp.id === row.id)

                        return (
                          <tr key={row.id} style={{ background: isSelected ? '#f0f5ff' : undefined }}>
                            <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                              <input 
                                type="checkbox" 
                                className="attio-chk" 
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(row)}
                                title="Select product"
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="attio-avatar" style={{ background: getAvatarColor(row.name) }}>
                                  {getSingleLetter(row.name)}
                                </div>
                                <span style={{ fontWeight: 535, fontSize: '0.89rem', color: '#1e293b' }}>
                                  {row.name}
                                </span>
                              </div>
                            </td>
                             <td>
                               <span style={{ color: '#1e293b', fontWeight: 600, fontSize: '0.85rem' }}>
                                 {row.hsn_code || row.sku || '10064000'}
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
                                {(() => {
                                  const bulkUnit = getBulkUnitDetails(row.unit)
                                  const uomShort = (bulkUnit?.short || row.unit || 'kg').toLowerCase().replace(/s$/, '')
                                  const pc = Number.parseFloat(row.price_covers || 0)
                                  const bw = Number.parseFloat(row.bag_weight || 1)
                                  const rawP = Number.parseFloat(row.price || 0)

                                  let priceVal = rawP
                                  if (pc > 0 && bw > 0 && pc !== bw) {
                                    priceVal = (rawP / bw) * pc
                                  }

                                  const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                        ₹{priceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                        {subtext}
                                      </span>
                                    </div>
                                  )
                                })()}
                              </td>
                              <td>
                                {(() => {
                                  if (!row.updated_price) return <span style={{ color: '#9ca3af' }}>—</span>
                                  const bulkUnit = getBulkUnitDetails(row.unit)
                                  const uomShort = (bulkUnit?.short || row.unit || 'kg').toLowerCase().replace(/s$/, '')
                                  const pc = Number.parseFloat(row.price_covers || 0)
                                  const bw = Number.parseFloat(row.bag_weight || 1)
                                  const rawUP = Number.parseFloat(row.updated_price || 0)

                                  let updatedPriceVal = rawUP
                                  if (pc > 0 && bw > 0 && pc !== bw) {
                                    updatedPriceVal = (rawUP / bw) * pc
                                  }

                                  const subtext = pc > 0 ? `${pc} ${uomShort} price` : (bw > 1 ? `${bw} ${uomShort} price` : `Per ${uomShort} price`)

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: '#2563eb' }}>
                                        ₹{updatedPriceVal.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                        {subtext}
                                      </span>
                                    </div>
                                  )
                                })()}
                              </td>
                            <td>
                              <span className={`attio-stock-badge ${getStockBadgeClass(row.stock, row.loose_kg, row.bag_weight)}`}>
                                {formatStockDisplay(row.stock, row.bag_weight, row.unit, row.loose_kg)}
                              </span>
                            </td>
                            <td>
                              <span className={`attio-status-badge ${row.status === 'active' ? 'attio-status-active' : 'attio-status-inactive'}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              {((Number.parseFloat(row.stock || 0) * (Number.parseFloat(row.bag_weight || 1) > 1 ? Number.parseFloat(row.bag_weight || 1) : 1)) + Number.parseFloat(row.loose_kg || 0)) <= 0 ? (
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
                                <div role="button" tabIndex={0} onClick={() => setSelectedSku(row.sku)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedSku(row.sku) }}>
                                  <ProductBarcode sku={row.sku} />
                                </div>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
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
                                {canDelete && (
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
                                )}
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

      {showCompareModal && (
        <ProductComparisonModal
          products={selectedProducts}
          onClose={() => setShowCompareModal(false)}
          onRemoveProduct={handleRemoveFromCompare}
          onClearAll={handleClearSelection}
        />
      )}

      {/* Floating Action Pill when items are selected */}
      {selectedProducts.length > 0 && (
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
              {selectedProducts.length}
            </span>
            <span style={{ fontWeight: 500 }}>
              product{selectedProducts.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: '#334155' }} />

          {selectedProducts.length >= 2 ? (
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
              <ArrowLeftRight size={14} /> Compare Products
            </button>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Select 1 more product to compare
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
