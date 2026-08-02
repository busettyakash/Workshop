import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Notification from '../../components/Notification'
import AuthLayout from '../../components/layout/AuthLayout'
import { useAppDispatch } from '../../redux/hooks'
import { loginThunk } from '../../redux/slices/authSlice'
import { addToast } from '../../redux/slices/uiSlice'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null)

  const showError = (msg) => setNotification({ message: msg, type: 'error' })
  const clearNotification = () => setNotification(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    clearNotification()
    try {
      const resultAction = await dispatch(loginThunk({ email, password }))
      if (loginThunk.fulfilled.match(resultAction)) {
        dispatch(addToast({ message: 'Welcome back! Login successful.', type: 'success' }))
        navigate('/dashboard')
      } else {
        showError(resultAction.payload || 'Invalid email or password. Please try again.')
      }
    } catch (err) {
      showError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
        />
      )}

      <div className="ws-auth-form-wrap">
        <h1 className="ws-auth-step-title">Log in to Workshop</h1>
        <p className="ws-auth-step-subtitle">Enter your email and password to sign in.</p>

        <form className="ws-auth-form" onSubmit={handleLogin}>
          <div className="ws-auth-input-group">
            <div className="ws-auth-input-wrap">
              <Mail size={14} className="ws-auth-icon" />
              <input
                type="email"
                className="ws-auth-input"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="ws-auth-input-group">
            <div className="ws-auth-input-wrap" style={{ position: 'relative' }}>
              <Lock size={14} className="ws-auth-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="ws-auth-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 36 }}
              />
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
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`ws-auth-btn-submit${loading ? ' loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="ws-auth-switch" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <div>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
          <div>
            <Link to="/forgot-password" style={{ color: 'var(--color-blue)', fontWeight: 500, fontSize: '0.8125rem' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="ws-auth-legal" style={{ marginTop: 'auto', paddingTop: 40 }}>
          By inserting your email you confirm you agree to Workshop contacting you about our
          product and services. You can opt out at any time. Find out more in our{' '}
          <a href="#">privacy policy</a>.
        </p>
      </div>
    </AuthLayout>
  )
}
