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
              <th>SKU</th>
              <th>Category</th>
              <th>Status</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map(row => {
              const colors = STATUS_COLORS[row.status] || {}
              return (
                <tr key={row.id}>
                  <td className="ws-td-name">{row.name}</td>
                  <td className="ws-td-mono">{row.sku}</td>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
