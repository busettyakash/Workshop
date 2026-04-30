import React from 'react'
import './Landing.css'

/**
 * Powerful Reporting section — matching Screenshot 134334 bottom + 134408
 * Left: text
 * Center: Chart with time range tabs + bar chart
 * Right: Insight card
 */
export default function ReportingSection() {
  return (
    <section className="ws-section ws-section--gray">
      <div className="ws-section-inner">
        <div className="ws-split-section">

          {/* Left text */}
          <div className="ws-split-text">
            <h3 className="ws-split-title">Powerful reporting</h3>
            <p className="ws-split-desc">
              Create real-time, detailed reports that scale with your data. 
              Visualize, customize, and get actionable insights from every transaction.
            </p>
            <a href="#" className="ws-explore-link">Explore reporting →</a>
          </div>

          {/* Center — Chart */}
          <div className="ws-report-chart">
            {/* Time tabs */}
            <div className="ws-report-tabs">
              {['7D', '30D', '3M', '6M', '12M', 'All'].map((t, i) => (
                <button key={t} className={`ws-report-tab ${i === 2 ? 'ws-report-tab--active' : ''}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Chart bars */}
            <div className="ws-report-bars">
              {[
                { h1: 42, h2: 28, label: 'Jan' },
                { h1: 58, h2: 35, label: 'Feb' },
                { h1: 45, h2: 40, label: 'Mar' },
                { h1: 72, h2: 32, label: 'Apr' },
                { h1: 65, h2: 48, label: 'May' },
                { h1: 80, h2: 55, label: 'Jun' },
                { h1: 90, h2: 62, label: 'Jul' },
                { h1: 68, h2: 45, label: 'Aug' },
                { h1: 75, h2: 50, label: 'Sep' },
              ].map((bar, i) => (
                <div key={i} className="ws-report-bar-group">
                  <div className="ws-report-bar-stack">
                    <div className="ws-report-bar ws-report-bar--primary" style={{ height: bar.h1 }} />
                    <div className="ws-report-bar ws-report-bar--secondary" style={{ height: bar.h2 }} />
                  </div>
                  <span className="ws-report-bar-label">{bar.label}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="ws-report-legend">
              <div className="ws-report-legend-item">
                <span className="ws-report-legend-dot ws-report-legend-dot--primary" />
                Revenue
              </div>
              <div className="ws-report-legend-item">
                <span className="ws-report-legend-dot ws-report-legend-dot--secondary" />
                Cost
              </div>
            </div>
          </div>

          {/* Right — Insight card */}
          <div className="ws-insight-card">
            <div className="ws-insight-header">
              <span>⏱</span>
              <span className="ws-insight-title">Insight</span>
            </div>

            <div className="ws-insight-body">
              <div className="ws-insight-metric">
                <div className="ws-insight-metric-label">Revenue this month</div>
                <div className="ws-insight-metric-value">₹18.4L</div>
                <div className="ws-insight-metric-change ws-insight-metric-change--up">
                  ↑ 23% vs last month
                </div>
              </div>

              <div className="ws-insight-divider" />

              <div className="ws-insight-metric">
                <div className="ws-insight-metric-label">Discount given</div>
                <div className="ws-insight-metric-value">₹1.2L</div>
                <div className="ws-insight-metric-change ws-insight-metric-change--down">
                  ↓ 5% vs last month
                </div>
              </div>

              <div className="ws-insight-divider" />

              <div className="ws-insight-metric">
                <div className="ws-insight-metric-label">Top category</div>
                <div className="ws-insight-metric-value">Electronics</div>
                <div className="ws-insight-metric-sub">38% of total revenue</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
