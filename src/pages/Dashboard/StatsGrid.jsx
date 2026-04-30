import React from 'react'
import { useAppSelector } from '../../redux/hooks'
import { selectStats } from '../../redux/slices/dashboardSlice'
import { TrendingUp, TrendingDown } from 'lucide-react'
import './Dashboard.css'

export default function StatsGrid() {
  const stats = useAppSelector(selectStats)

  return (
    <div className="ws-stats-grid">
      {stats.map(s => (
        <div className="ws-stat-card" key={s.label}>
          <div className="ws-stat-card-label">{s.label}</div>
          <div className="ws-stat-card-value">{s.value}</div>
          <div className={`ws-stat-card-change ${s.up ? 'up' : 'down'}`}>
            {s.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {s.change}
          </div>
        </div>
      ))}
    </div>
  )
}
