import React from 'react'
import { STATUS_COLORS } from '../../constants'
import './Badge.css'

/**
 * Status badge / pill
 */
export default function Badge({ label, variant, className = '' }) {
  const colors = STATUS_COLORS[label] || {}
  const style = variant === 'custom' && colors.bg ? {
    background: colors.bg,
    color: colors.text,
  } : undefined

  return (
    <span
      className={`ws-badge ws-badge--${variant || 'default'} ${className}`}
      style={style}
    >
      {label}
    </span>
  )
}
