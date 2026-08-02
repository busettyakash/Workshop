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
  return (parseFloat(value || 0)).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

function dateText(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function QuotePreviewModal({ quote, onClose, onEdit }) {
  const items = parseItems(quote?.line_items)

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div className="ws-modal-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="ws-modal-header">
          <div>
            <h3 className="ws-modal-title">Quotation {quote?.quote_number || `#${quote?.id}`}</h3>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>
              {quote?.customer_name || 'Customer'} · {quote?.status || 'Draft'}
            </div>
          </div>
          <button className="ws-modal-close-x" onClick={onClose} type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  const explicitDiscount = parseFloat(quote?.discount || quote?.discount_amount || 0)
                  const lineDiscounts = items.reduce((s, it) => s + parseFloat(it.discount || 0), 0)
                  const grossTotal = items.reduce((s, it) => s + (parseFloat(it.rate || it.price || 0) * parseFloat(it.quantity || it.qty || 1)), 0)
                  const lineAmtTotal = items.reduce((s, it) => s + parseFloat(it.amount || it.line_total || 0), 0)
                  const diffDiscount = (grossTotal > 0 && lineAmtTotal > 0 && grossTotal > lineAmtTotal + 0.01) ? (grossTotal - lineAmtTotal) : 0
                  const totalDiscount = Math.max(explicitDiscount, lineDiscounts, diffDiscount)

                  return totalDiscount > 0 ? (
                    <>
                      <span style={{ color: '#64748b' }}>Discount</span>
                      <strong style={{ textAlign: 'right', color: '#dc2626' }}>- {money(totalDiscount)}</strong>
                    </>
                  ) : null
                })()}
                <span style={{ color: '#64748b' }}>Tax</span>
                <strong style={{ textAlign: 'right' }}>{money(quote?.tax_amount)}</strong>
                <span style={{ color: '#64748b' }}>Total</span>
                <strong style={{ textAlign: 'right', color: '#15803d' }}>{money(quote?.total_amount)}</strong>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Item</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: 18, textAlign: 'center', color: '#94a3b8' }}>No line items</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id || index} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0f172a' }}>{item.name || item.product_name || 'Item'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>{item.quantity || item.qty || 0}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>{money(item.rate || item.price)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{money(item.amount || item.line_total)}</td>
                    </tr>
                  ))
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

        <div className="ws-modal-footer">
          <button className="attio-btn attio-btn-secondary" type="button" onClick={onClose}>Close</button>
          {onEdit && (
            <button className="attio-btn attio-btn-primary" type="button" onClick={onEdit}>
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
