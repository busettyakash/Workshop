import React from 'react'

/**
 * Standardized Attio-style Table Pagination component
 * Used across Products, People, Billing, Paid, Unpaid, ImportStock, etc.
 */
export default function TablePagination({ page, setPage, total, limit, getPageNumbers, totalPages }) {
  if (total === undefined || total === null) return null

  return (
    <div className="attio-pagination" style={{ marginTop: 'auto' }}>
      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
        Showing <span style={{ fontWeight: 600, color: '#111827' }}>{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
        <span style={{ fontWeight: 600, color: '#111827' }}>{Math.min(page * limit, total)}</span> of{' '}
        <span style={{ fontWeight: 600, color: '#111827' }}>{total}</span> entries
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="attio-page-btn"
          aria-label="Previous page"
        >
          &lt;
        </button>
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ color: '#9ca3af', padding: '0 4px', fontSize: '0.8125rem' }}>
                ...
              </span>
            )
          }
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`attio-page-btn ${page === p ? 'active' : ''}`}
            >
              {p}
            </button>
          )
        })}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="attio-page-btn"
          aria-label="Next page"
        >
          &gt;
        </button>
      </div>
    </div>
  )
}
