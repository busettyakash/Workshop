import React, { forwardRef, useState, useId } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
  type = 'text',
  ...rest
}, ref) => {
  const autoId = useId()
  const inputId = id || `input-${autoId}`
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`ws-input-group ${error ? 'ws-input-group--error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="ws-input-label">
          {label}
        </label>
      )}
      <div className="ws-input-wrap" style={{ position: 'relative' }}>
        {Icon && <Icon size={14} className="ws-input-icon" />}
        <input
          ref={ref}
          id={inputId}
          type={actualType}
          className={`ws-input ${Icon ? 'ws-input--icon' : ''} ${error ? 'ws-input--error' : ''}`}
          style={{ paddingRight: isPassword ? 36 : undefined }}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2
            }}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        ) : suffix ? (
          <span className="ws-input-suffix">{suffix}</span>
        ) : null}
      </div>
      {error && <p className="ws-input-error">{error}</p>}
      {hint && !error && <p className="ws-input-hint">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
