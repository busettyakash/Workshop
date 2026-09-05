import React from 'react'
import { Edit2, X } from 'lucide-react'

function parseItems(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function money(value) {
  return (Number.parseFloat(value || 0)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

function dateText(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

export default function QuotePreviewModal({ quote, onClose, onEdit, onStatusChange }) {
  const items = parseItems(quote?.line_items)

  return (
    <div className="ws-modal-backdrop" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onClose()}>
      <div className="ws-modal-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="ws-modal-header">
          <div>
            <h3 className="ws-modal-title">Quotation {quote?.quote_number || `#${quote?.id}`}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 500 }}>
                {quote?.customer_name || 'Customer'}
              </span>
              {(() => {
                const s = String(quote?.status || 'Draft').toLowerCase()
                let bg = '#f1f5f9'
                let color = '#475569'
                let border = '#e2e8f0'

                if (s === 'accepted') {
                  bg = '#dcfce7'
                  color = '#15803d'
                  border = '#bbf7d0'
                } else if (s === 'declined' || s === 'rejected') {
                  bg = '#fee2e2'
                  color = '#b91c1c'
                  border = '#fecaca'
                } else if (s === 'sent' || s === 'pending') {
                  bg = '#eff6ff'
                  color = '#2563eb'
                  border = '#bfdbfe'
                }

                return (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: bg, color: color, border: `1px solid ${border}`
                  }}>
                    {quote?.status || 'Draft'}
                  </span>
                )
              })()}
            </div>
          </div>
          <button className="ws-modal-close-x" onClick={onClose} type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: 6 }}>CUSTOMER</div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{quote?.customer_name || '-'}</div>
              <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: 4 }}>{quote?.customer_company || ''}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>{quote?.customer_phone || '-'}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{quote?.customer_email || '-'}</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: 6 }}>DETAILS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.79rem' }}>
                {(() => {
                  const orderNum = (quote?.status === 'Accepted')
                    ? (quote?.order_number || `ORD-${quote.quote_number ? quote.quote_number.replace(/^QT-?/i, '') : quote?.id}`)
                    : null
                  return orderNum ? (
                    <>
                      <span style={{ color: '#64748b' }}>Order No</span>
                      <strong style={{ textAlign: 'right', color: '#2563eb' }}>{orderNum}</strong>
                    </>
                  ) : null
                })()}
                <span style={{ color: '#64748b' }}>Issue date</span>
                <strong style={{ textAlign: 'right' }}>{dateText(quote?.issue_date || quote?.created_at)}</strong>
                <span style={{ color: '#64748b' }}>Valid until</span>
                <strong style={{ textAlign: 'right' }}>{dateText(quote?.valid_until)}</strong>
                {(() => {
                  const explicitDiscount = Number.parseFloat(quote?.discount || quote?.discount_amount || 0)
                  const lineDiscounts = items.reduce((s, it) => s + Number.parseFloat(it.discount || 0), 0)
                  const grossTotal = items.reduce((s, it) => s + (Number.parseFloat(it.rate || it.price || 0) * Number.parseFloat(it.quantity || it.qty || 1)), 0)
                  const lineAmtTotal = items.reduce((s, it) => s + Number.parseFloat(it.amount || it.line_total || 0), 0)
                  const diffDiscount = (grossTotal > 0 && lineAmtTotal > 0 && grossTotal > lineAmtTotal + 0.01) ? (grossTotal - lineAmtTotal) : 0
                  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)
                  const taxableTotal = Math.max(0, grossTotal - totalDiscount)
                  const taxAmt = Number.parseFloat(quote?.tax_amount || 0)

                  return (
                    <>
                      {totalDiscount > 0 && (
                        <>
                          <span style={{ color: '#64748b' }}>Subtotal</span>
                          <strong style={{ textAlign: 'right' }}>{money(grossTotal)}</strong>
                          <span style={{ color: '#64748b' }}>Discount</span>
                          <strong style={{ textAlign: 'right', color: '#dc2626' }}>- {money(totalDiscount)}</strong>
                        </>
                      )}
                      <span style={{ color: '#64748b' }}>Taxable Amt</span>
                      <strong style={{ textAlign: 'right' }}>{money(taxableTotal)}</strong>
                      <span style={{ color: '#64748b' }}>Tax</span>
                      <strong style={{ textAlign: 'right' }}>{taxAmt > 0 ? money(taxAmt) : '₹0.00'}</strong>
                      <span style={{ color: '#64748b' }}>Total</span>
                      <strong style={{ textAlign: 'right', color: '#15803d' }}>{money(quote?.total_amount || (taxableTotal + taxAmt))}</strong>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 300, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr style={{ color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>Item</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Rate</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Gross Amt</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Discount</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Taxable Amt</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Tax</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: 18, textAlign: 'center', color: '#94a3b8' }}>No line items</td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const q = Number.parseFloat(item.quantity || item.qty || 1)
                    const r = Number.parseFloat(item.rate || item.price || 0)
                    const gross = q * r
                    const disc = Number.parseFloat(item.discount ?? item.discount_amount ?? item.discountAmount ?? item.disc ?? 0)
                    const taxable = Number.parseFloat(item.amount || item.line_total || (gross - disc))

                    const explicitTaxAmt = Number.parseFloat(quote?.tax_amount || 0)
                    const totalAmt = Number.parseFloat(quote?.total_amount || 0)
                    const totalTaxable = items.reduce((s, it) => s + (Number.parseFloat(it.amount || it.line_total || 0)), 0)

                    let itemTax = 0
                    if (explicitTaxAmt > 0) {
                      itemTax = items.length === 1 ? explicitTaxAmt : (taxable / (totalTaxable || 1)) * explicitTaxAmt
                    } else if (totalAmt > totalTaxable + 0.01) {
                      const taxDiff = totalAmt - totalTaxable
                      itemTax = items.length === 1 ? taxDiff : (taxable / (totalTaxable || 1)) * taxDiff
                    }

                    const itemFinal = taxable + itemTax

                    return (
                      <tr key={item.id || index} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{item.name || item.product_name || 'Item'}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{q}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{money(r)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{money(gross)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', color: disc > 0 ? '#dc2626' : '#64748b' }}>
                          {disc > 0 ? `- ${money(disc)}` : '-'}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{money(taxable)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', color: itemTax > 0 ? '#2563eb' : '#64748b' }}>
                          {itemTax > 0 ? `+ ${money(itemTax)}` : '-'}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 700, color: '#15803d' }}>
                          {money(itemFinal)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {quote?.notes && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, color: '#475569', fontSize: '0.84rem', lineHeight: 1.5 }}>
              {quote.notes}
            </div>
          )}
        </div>

        <div className="ws-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="attio-btn attio-btn-secondary" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
