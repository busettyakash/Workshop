import React from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch } from '../../redux/hooks'
import { setActiveNav } from '../../redux/slices/uiSlice'
import { useAppSelector } from '../../redux/hooks'
import { selectProducts } from '../../redux/slices/dashboardSlice'
import { STATUS_COLORS } from '../../constants'
import { Plus, Filter, ArrowUpDown, Package } from 'lucide-react'
import '../Dashboard/Dashboard.css'

export default function Products() {
  const dispatch  = useAppDispatch()
  const products  = useAppSelector(selectProducts)
  React.useEffect(() => { dispatch(setActiveNav('Products')) }, [dispatch])

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className="ws-dash-content">
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">Products</div>
          <div className="ws-table-section">
            <div className="ws-table-header">
              <div>
                <h2 className="ws-table-title">All Products</h2>
                <p className="ws-table-sub">{products.length} products · Last updated just now</p>
              </div>
              <div className="ws-table-actions">
                <button className="ws-table-btn"><Filter size={13} /> Filter</button>
                <button className="ws-table-btn"><ArrowUpDown size={13} /> Sort</button>
                <button className="ws-table-btn ws-table-btn--primary"><Plus size={13} /> Add Product</button>
              </div>
            </div>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th></th>
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
                        <td>
                          <div style={{width:28,height:28,borderRadius:6,background:'var(--color-gray-100)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <Package size={13} color="var(--color-gray-500)" />
                          </div>
                        </td>
                        <td className="ws-td-name">{row.name}</td>
                        <td className="ws-td-mono">{row.sku}</td>
                        <td>{row.category}</td>
                        <td>
                          <span className="ws-pill" style={{ background: colors.bg, color: colors.text }}>
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
        </main>
      </div>
    </div>
  )
}
