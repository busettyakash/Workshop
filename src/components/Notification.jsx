import { useEffect, useState } from 'react'
import './Notification.css'

export default function Notification({ message, type = 'info', onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  return (
    <div className={`notif-toast notif-${type} ${visible ? 'notif-show' : 'notif-hide'}`}>
      {message}
    </div>
  )
}
