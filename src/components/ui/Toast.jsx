import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useAppDispatch } from '../../redux/hooks'
import { selectToasts, removeToast, addToast } from '../../redux/slices/uiSlice'
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
    const timer = setTimeout(() => dispatch(removeToast(toast.id)), toast.duration || 4000)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id, toast.duration])

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
  const dispatch = useAppDispatch()
  const toasts = useSelector(selectToasts)

  useEffect(() => {
    try {
      const flash = sessionStorage.getItem('flash_toast')
      if (flash) {
        sessionStorage.removeItem('flash_toast')
        const parsed = JSON.parse(flash)
        if (parsed?.message) {
          dispatch(addToast(parsed))
        }
      }
    } catch (e) {
      console.warn('Could not parse flash toast', e)
    }
  }, [dispatch])

  if (!toasts.length) return null

  return (
    <div className="ws-toast-container" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  )
}
