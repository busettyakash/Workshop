import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import './Notification.css'

const ICONS = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  warning: <AlertCircle size={16} />,
  info:    <Info size={16} />,
}

export default function Notification({ message, type = 'info', onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div className={`notif-toast notif-${type} ${visible ? 'notif-show' : 'notif-hide'}`}>
      <span className="notif-icon">{ICONS[type]}</span>
      <span className="notif-msg">{message}</span>
      <button className="notif-close" onClick={handleClose} aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  )
}
