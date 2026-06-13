import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmModal({ 
  isOpen, 
  title = 'Confirm Action', 
  message = 'Are you sure you want to perform this action?', 
  confirmLabel = 'Delete', 
  cancelLabel = 'Cancel', 
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null

  return (
    <div className="ws-modal-backdrop" onClick={onCancel} style={{ zIndex: 1010 }}>
      <div 
        className="ws-modal-card" 
        style={{ 
          maxWidth: 400, 
          borderRadius: '16px', 
          border: '1px solid rgba(229, 231, 235, 0.8)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          background: '#ffffff'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', color: '#ef4444' }}>
              <AlertTriangle size={15} />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h3>
          </div>
          <button 
            type="button" 
            onClick={onCancel} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>
          {message}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ 
              height: 36, 
              padding: '0 16px', 
              border: '1px solid #d1d5db', 
              borderRadius: '8px', 
              background: '#ffffff', 
              color: '#374151', 
              fontSize: '0.8125rem', 
              fontWeight: 600, 
              cursor: 'pointer', 
              transition: 'background 0.15s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ 
              height: 36, 
              padding: '0 16px', 
              border: 'none', 
              borderRadius: '8px', 
              background: '#dc2626', 
              color: '#ffffff', 
              fontSize: '0.8125rem', 
              fontWeight: 600, 
              cursor: 'pointer', 
              transition: 'background 0.15s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
