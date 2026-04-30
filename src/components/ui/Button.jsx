import React from 'react'
import './Button.css'

/**
 * Workshop Button — Attio-style
 * variant: 'primary' | 'ghost' | 'outline' | 'danger'
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`ws-btn ws-btn--${variant} ws-btn--${size} ${fullWidth ? 'ws-btn--full' : ''} ${loading ? 'ws-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <span className="ws-btn-spinner" aria-hidden="true" />
      ) : null}
      <span className={loading ? 'ws-btn-text-hidden' : ''}>{children}</span>
    </button>
  )
}
