import React from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import StatsGrid from './StatsGrid'
import ProductsTable from './ProductsTable'
import { useAuth } from '../../hooks/useAuth'
import { getGreeting } from '../../utils/formatters'
import './Dashboard.css'

export default function Dashboard() {
  const { shopName } = useAuth()
  const firstName = shopName.split(' ')[0]

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className="ws-dash-content">
        <Topbar />
        <main className="ws-dash-body">
          <div className="ws-dash-greeting">
            {getGreeting()}, {firstName} 👋
          </div>

          <StatsGrid />
          <ProductsTable />
        </main>
      </div>
    </div>
  )
}
