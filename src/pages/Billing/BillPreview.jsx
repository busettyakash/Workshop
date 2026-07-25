import React, { useRef } from 'react'
import { X, Printer } from 'lucide-react'
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

  const grossSubtotal = items.reduce((s, li) => {
    const q = parseFloat(li.qty || li.quantity || 1)
    const p = parseFloat(li.price || li.rate || 0)
    return s + (p * q)
  }, 0)

  const lineDiscounts = items.reduce((s, li) => s + parseFloat(li.discount || 0), 0)
  const subtotal = Math.max(0, grossSubtotal - lineDiscounts)
  const discount = parseFloat(bill.discount || 0)
  const totalAmount = parseFloat(bill.amount || grossSubtotal || 0)
  const taxAmt = totalAmount > subtotal ? (totalAmount - subtotal) : 0
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2
  const invId = bill.bill_number || `INV-${String(bill.id || 1).padStart(4, '0')}`

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=850,height=950')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${invId}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1e293b}
      .bill-preview-page{max-width:760px;margin:0 auto}
      .bill-banner{background:linear-gradient(135deg,#1e3a8a,#2563eb 60%,#3d68f5);padding:36px 44px 32px;display:flex;justify-content:space-between;align-items:flex-start}
      .bill-company-name{font-size:22px;font-weight:800;color:#fff;margin-bottom:8px}
      .bill-company-meta{font-size:12.5px;color:rgba(255,255,255,0.72);line-height:1.75}
      .bill-inv-label{font-size:11px;font-weight:800;color:rgba(255,255,255,0.55);letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px}
      .bill-inv-number{font-size:30px;font-weight:900;color:#fff;margin-bottom:10px;line-height:1}
      .bill-inv-meta{font-size:12px;color:rgba(255,255,255,0.7);line-height:1.8;text-align:right}
      .bill-inv-meta strong{color:#fff}
      .status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase}
      .status-paid{background:rgba(220,252,231,0.95);color:#15803d}
      .status-unpaid{background:rgba(254,243,199,0.95);color:#92400e}
      .bill-body{padding:36px 44px}
      .bill-parties{display:grid;grid-template-columns:1fr 1fr;margin-bottom:36px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
      .bill-party-block{padding:20px 24px}
      .bill-party-block:first-child{border-right:1px solid #e2e8f0}
      .bill-party-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:8px}
      .bill-party-name{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px}
      .bill-party-meta{font-size:12.5px;color:#64748b;line-height:1.7}
      table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
      thead tr{background:#f8fafc}
      th{padding:13px 16px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:1px solid #e2e8f0}
      td{padding:16px;font-size:13.5px;color:#1e293b;border-bottom:1px solid #f1f5f9}
      .text-center{text-align:center}.text-right{text-align:right}
      .bill-item-name{font-weight:600;color:#0f172a;font-size:14px}
      .bill-item-unit{font-size:11.5px;color:#94a3b8;margin-top:2px}
      .bill-totals-wrap{display:flex;justify-content:flex-end;margin-top:24px}
      .bill-totals{width:300px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
      .total-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#475569;padding:11px 18px;border-bottom:1px solid #f1f5f9}
      .total-row.grand{background:#0f172a;font-size:15px;font-weight:800;color:#fff;padding:15px 18px;border-bottom:none}
      .bill-footer{border-top:1px solid #e2e8f0;margin-top:32px;padding-top:20px;text-align:center;font-size:11.5px;color:#94a3b8;line-height:1.7}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${content}</body></html>`)
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
            <button className="bp-btn" onClick={handlePrint}>
              <Printer size={15} /> Print / Download
            </button>
            <button className="bp-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Invoice */}
        <div className="bp-scroll">
          <div className="bill-preview-page" ref={printRef}>

            {/* Blue Banner Header */}
            <div className="bill-banner">
              <div className="bill-banner-left">
                <div className="bill-company-name">{shopName || 'Busetty Traders'}</div>
                <div className="bill-company-meta">
                  {shopAddress && <>{shopAddress}<br /></>}
                  {shopPhone && <>Phone: {shopPhone}<br /></>}
                  {shopGstin && <>GSTIN: {shopGstin}</>}
                </div>
              </div>
              <div className="bill-banner-right">
                <div className="bill-inv-label">Tax Invoice</div>
                <div className="bill-inv-number">{invId}</div>
                <div className="bill-inv-meta">
                  Date: <strong>{fmtDate(bill.created_at)}</strong><br />
                  {bill.due_date && <>Due: <strong>{fmtDate(bill.due_date)}</strong><br /></>}
                  <span className={`status-badge ${bill.status === 'paid' ? 'status-paid' : 'status-unpaid'}`}>
                    {bill.status === 'paid' ? 'PAID' : 'PENDING'}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="bill-body">

              {/* Bill To / Payment */}
              <div className="bill-parties">
                <div className="bill-party-block">
                  <div className="bill-party-label">Bill To</div>
                  <div className="bill-party-name">{bill.customer_name || 'General Customer'}</div>
                  {bill.customer_company && <div className="bill-party-meta">{bill.customer_company}</div>}
                  {bill.customer_email && <div className="bill-party-meta">{bill.customer_email}</div>}
                  {bill.customer_phone && <div className="bill-party-meta">Phone: {bill.customer_phone}</div>}
                </div>
                <div className="bill-party-block" style={{ textAlign: 'right' }}>
                  <div className="bill-party-label">Payment Info</div>
                  <div className="bill-party-meta">
                    Status: <strong style={{ color: bill.status === 'paid' ? '#15803d' : '#d97706' }}>
                      {bill.status === 'paid' ? 'Paid' : 'Pending'}
                    </strong><br />
                    {bill.due_date && <>Due by: {fmtDate(bill.due_date)}</>}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Description</th>
                    <th className="text-center" style={{ width: '80px' }}>Qty</th>
                    <th className="text-right" style={{ width: '140px' }}>Unit Price</th>
                    {lineDiscounts > 0 && <th className="text-right" style={{ width: '110px' }}>Discount</th>}
                    <th className="text-right" style={{ width: '150px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? items.map((li, i) => {
                    const qty = parseFloat(li.qty || li.quantity || 1)
                    const price = parseFloat(li.price || li.rate || 0)
                    const lineTotal = Math.max(0, (price * qty) - parseFloat(li.discount || 0))
                    const unitStr = li.unit || li.unitLabel || ''
                    return (
                      <tr key={i}>
                        <td style={{ color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                        <td>
                          <div className="bill-item-name">{li.name || li.product_name || 'Product'}</div>
                          {unitStr && <div className="bill-item-unit">{unitStr}</div>}
                        </td>
                        <td className="text-center" style={{ fontWeight: 500 }}>{qty}</td>
                        <td className="text-right">{INR(price)}</td>
                        {lineDiscounts > 0 && <td className="text-right" style={{ color: '#16a34a' }}>{li.discount > 0 ? `−${INR(li.discount)}` : '—'}</td>}
                        <td className="text-right" style={{ fontWeight: 700 }}>{INR(lineTotal)}</td>
                      </tr>
                    )
                  }) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>No line items found</td></tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="bill-totals-wrap">
                <div className="bill-totals">
                  <div className="total-row">
                    <span>Subtotal</span>
                    <span>{INR(grossSubtotal || totalAmount)}</span>
                  </div>
                  {lineDiscounts > 0 && (
                    <div className="total-row discount">
                      <span>Product Discounts</span>
                      <span>− {INR(lineDiscounts)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="total-row discount">
                      <span>Additional Discount</span>
                      <span>− {INR(discount)}</span>
                    </div>
                  )}
                  {taxAmt > 0 && (
                    <>
                      <div className="total-row">
                        <span>CGST (9%)</span>
                        <span>{INR(cgst)}</span>
                      </div>
                      <div className="total-row">
                        <span>SGST (9%)</span>
                        <span>{INR(sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="total-row grand">
                    <span>Grand Total</span>
                    <span>{INR(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {bill.notes && (
                <div className="bill-notes">
                  <div className="bill-notes-label">Notes</div>
                  <div className="bill-notes-text">{bill.notes}</div>
                </div>
              )}

              {/* Footer */}
              <div className="bill-footer">
                Thank you for your business! This is a computer-generated invoice and does not require a signature.<br />
                Generated by <strong>Workshop</strong> · {fmtDate(new Date())}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
