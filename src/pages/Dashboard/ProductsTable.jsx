import React from 'react'
import { useAppSelector } from '../../redux/hooks'
import { selectProducts } from '../../redux/slices/dashboardSlice'
import { STATUS_COLORS } from '../../constants'
import { Plus, Filter, ArrowUpDown } from 'lucide-react'
import './Dashboard.css'

export default function ProductsTable() {
  const products = useAppSelector(selectProducts)

  return (
    <div className="ws-table-section">
      <div className="ws-table-header">
        <div>
          <h2 className="ws-table-title">Recent Products</h2>
          <p className="ws-table-sub">Your latest inventory snapshot</p>
        </div>
        <div className="ws-table-actions">
          <button className="ws-table-btn">
            <Filter size={13} /> Filter
          </button>
          <button className="ws-table-btn">
            <ArrowUpDown size={13} /> Sort
          </button>
          <button className="ws-table-btn ws-table-btn--primary">
            <Plus size={13} /> Add Product
          </button>
        </div>
      </div>

      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>HSN Code</th>
              <th>Category</th>
              <th>Status</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? products.map(row => {
              const colors = STATUS_COLORS[row.status] || {}
              return (
                <tr key={row.id}>
                  <td className="ws-td-name">{row.name}</td>
                  <td className="ws-td-mono" style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                    {row.hsn_code || row.sku || '10064000'}
                  </td>
                  <td>{row.category}</td>
                  <td>
                    <span
                      className="ws-pill"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="ws-td-price">{row.price}</td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  No products found. Click "Add Product" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
