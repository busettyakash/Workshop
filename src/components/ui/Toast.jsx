import React, { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useAppDispatch } from '../../redux/hooks'
import { selectToasts, removeToast } from '../../redux/slices/uiSlice'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import './Toast.css'

const ICONS = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  warning: <AlertCircle size={16} />,
  info:    <Info size={16} />,
}

function Toast({ toast }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const timer = setTimeout(() => dispatch(removeToast(toast.id)), 4000)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id])

  return (
    <div className={`ws-toast ws-toast--${toast.type}`} role="alert">
      <span className="ws-toast-icon">{ICONS[toast.type]}</span>
      <p className="ws-toast-msg">{toast.message}</p>
      <button
        className="ws-toast-close"
        onClick={() => dispatch(removeToast(toast.id))}
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useSelector(selectToasts)
  if (!toasts.length) return null

  return (
    <div className="ws-toast-container" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  )
}
