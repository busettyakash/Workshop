import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { addToast, removeToast } from '../redux/slices/uiSlice'

export const useNotification = () => {
  const dispatch = useDispatch()

  const notify = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now()
    dispatch(addToast({ id, message, type }))
    if (duration > 0) {
      setTimeout(() => dispatch(removeToast(id)), duration)
    }
  }, [dispatch])

  const success = useCallback((msg) => notify(msg, 'success'), [notify])
  const error   = useCallback((msg) => notify(msg, 'error'),   [notify])
  const warning = useCallback((msg) => notify(msg, 'warning'), [notify])
  const info    = useCallback((msg) => notify(msg, 'info'),    [notify])

  return { notify, success, error, warning, info }
}
