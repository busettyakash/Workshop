import React, { useRef } from 'react'
import { X, Download, Printer } from 'lucide-react'
import './BillPreview.css'

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v || 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function BillPreview({ bill, shopName, shopGstin, shopPhone, shopAddress, onClose }) {
  const printRef = useRef(null)

  if (!bill) return null

  let items = []
  try {
    items = typeof bill.items === 'string' ? JSON.parse(bill.items) : (bill.items || [])
  } catch { items = [] }

  const grossSubtotal = items.reduce((s, li) => s + (parseFloat(li.price || 0) * parseFloat(li.qty || 1)), 0)
  const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
  const subtotal = Math.max(0, grossSubtotal - lineDiscounts)
  const discount = parseFloat(bill.discount || 0)
  const taxableValue = Math.max(0, subtotal - Math.min(discount, subtotal))
  const totalAmount = parseFloat(bill.amount || 0)
  const taxAmt = totalAmount - taxableValue
  const taxRate = taxAmt > 0 ? Math.round((taxAmt / taxableValue) * 100) : 0
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2
  const invId = `INV-${String(bill.id).padStart(4, '0')}`

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=800,height=900')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${invId}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; }
            .bill-preview-page { padding: 40px; max-width: 800px; margin: 0 auto; }
            .bill-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #3d68f5; }
            .bill-company-name { font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 4px; }
            .bill-company-meta { font-size: 12px; color: #6b7280; line-height: 1.6; }
            .bill-inv-label { font-size: 28px; font-weight: 800; color: #3d68f5; letter-spacing: -0.02em; }
            .bill-inv-meta { font-size: 12px; color: #6b7280; text-align: right; margin-top: 4px; line-height: 1.6; }
            .bill-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
            .bill-party-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
            .bill-party-name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 2px; }
            .bill-party-meta { font-size: 12px; color: #6b7280; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead tr { background: #f8fafc; }
            th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
            td { padding: 11px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #f3f4f6; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 280px; }
            .total-row { display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; padding: 5px 0; }
            .total-row.grand { font-size: 15px; font-weight: 800; color: #111827; border-top: 2px solid #111827; padding-top: 10px; margin-top: 4px; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
            .status-paid { background: #dcfce7; color: #15803d; }
            .status-unpaid { background: #fef3c7; color: #92400e; }
            .bill-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  return (
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="bp-toolbar">
          <span className="bp-toolbar-title">Invoice Preview — {invId}</span>
          <div className="bp-toolbar-actions">
            <button className="bp-btn" onClick={handlePrint} title="Print / Download PDF">
              <Printer size={15} /> Print / Download
            </button>
            <button className="bp-close" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="bp-scroll">
          <div className="bill-preview-page" ref={printRef}>

            {/* Header */}
            <div className="bill-header">
              <div>
                <div className="bill-company-name">{shopName || 'Your Company'}</div>
                <div className="bill-company-meta">
                  {shopAddress && <>{shopAddress}<br /></>}
                  {shopPhone && <>Phone: {shopPhone}<br /></>}
                  {shopGstin && <>GSTIN: {shopGstin}</>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bill-inv-label">TAX INVOICE</div>
                <div className="bill-inv-meta">
                  Invoice No: <strong>{invId}</strong><br />
                  Date: {fmtDate(bill.created_at)}<br />
                  {bill.due_date && <>Due: {fmtDate(bill.due_date)}<br /></>}
                  <span className={`status-badge ${bill.status === 'paid' ? 'status-paid' : 'status-unpaid'}`}>
                    {bill.status === 'paid' ? 'PAID' : 'PENDING'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="bill-parties">
              <div>
                <div className="bill-party-label">Bill To</div>
                <div className="bill-party-name">{bill.customer_name || 'General Customer'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bill-party-label">Payment</div>
                <div className="bill-party-meta">
                  Status: <strong>{bill.status === 'paid' ? 'Paid' : 'Pending'}</strong><br />
                  {bill.due_date && <>Due by: {fmtDate(bill.due_date)}</>}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit Price</th>
                  {lineDiscounts > 0 && <th className="text-right">Discount</th>}
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((li, i) => {
                  const lineTotal = Math.max(0, (parseFloat(li.price || 0) * parseFloat(li.qty || 1)) - parseFloat(li.discount || 0))
                  return (
                    <tr key={i}>
                      <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{li.name}</div>
                        {li.unit && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{li.unit}</div>}
                      </td>
                      <td className="text-right">{li.qty}</td>
                      <td className="text-right">{INR(li.price)}</td>
                      {lineDiscounts > 0 && <td className="text-right" style={{ color: '#16a34a' }}>{li.discount > 0 ? `-${INR(li.discount)}` : '—'}</td>}
                      <td className="text-right" style={{ fontWeight: 600 }}>{INR(lineTotal)}</td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>No items</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{INR(grossSubtotal)}</span>
              </div>
              {lineDiscounts > 0 && (
                <div className="total-row" style={{ color: '#16a34a' }}>
                  <span>Product Discounts</span>
                  <span>- {INR(lineDiscounts)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="total-row" style={{ color: '#16a34a' }}>
                  <span>Additional Discount</span>
                  <span>- {INR(discount)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <>
                  <div className="total-row">
                    <span>CGST ({taxRate / 2}%)</span>
                    <span>{INR(cgst)}</span>
                  </div>
                  <div className="total-row">
                    <span>SGST ({taxRate / 2}%)</span>
                    <span>{INR(sgst)}</span>
                  </div>
                </>
              )}
              <div className="total-row grand">
                <span>Total (GST Incl.)</span>
                <span>{INR(totalAmount)}</span>
              </div>
            </div>

            {/* Notes */}
            {bill.notes && (
              <div style={{ marginTop: 28, padding: '14px', background: '#f9fafb', borderRadius: '8px', borderLeft: '3px solid #3d68f5' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>{bill.notes}</div>
              </div>
            )}

            {/* Footer */}
            <div className="bill-footer">
              Thank you for your business! This is a computer-generated invoice and does not require a signature.
              <br />Generated by Workshop · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
