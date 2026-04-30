import React, { forwardRef } from 'react'
import './Input.css'

/**
 * Workshop Input — Attio-style
 */
const Input = forwardRef(({
  label,
  error,
  hint,
  icon: Icon,
  suffix,
  className = '',
  id,
  ...rest
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`

  return (
    <div className={`ws-input-group ${error ? 'ws-input-group--error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="ws-input-label">
          {label}
        </label>
      )}
      <div className="ws-input-wrap">
        {Icon && <Icon size={14} className="ws-input-icon" />}
        <input
          ref={ref}
          id={inputId}
          className={`ws-input ${Icon ? 'ws-input--icon' : ''} ${error ? 'ws-input--error' : ''}`}
          {...rest}
        />
        {suffix && <span className="ws-input-suffix">{suffix}</span>}
      </div>
      {error && <p className="ws-input-error">{error}</p>}
      {hint && !error && <p className="ws-input-hint">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
