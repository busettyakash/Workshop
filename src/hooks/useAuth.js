import { useSelector } from 'react-redux'
import { selectUser, selectToken, selectIsAuth, selectAuthStatus, selectAuthError } from '../redux/slices/authSlice'
import { getInitials } from '../utils/formatters'

export const useAuth = () => {
  const user   = useSelector(selectUser)
  const token  = useSelector(selectToken)
  const isAuth = useSelector(selectIsAuth)
  const status = useSelector(selectAuthStatus)
  const error  = useSelector(selectAuthError)

  const firstName = user?.firstName || user?.first_name || ''
  const lastName  = user?.lastName || user?.last_name || ''
  const fullName  = [firstName, lastName].filter(Boolean).join(' ')

  return {
    user,
    token,
    isAuthenticated: isAuth,
    isLoading:       status === 'loading',
    error,
    shopName:        user?.shopName || 'My Shop',
    email:           user?.email || '',
    firstName,
    lastName,
    fullName,
    initials:        getInitials(fullName || user?.shopName || 'WS'),
  }
}
