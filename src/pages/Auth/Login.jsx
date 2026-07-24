import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Notification from '../../components/Notification'
import AuthLayout from '../../components/layout/AuthLayout'
import { authApi } from '../../services/authApi'
import { useAppDispatch } from '../../redux/hooks'
import { loginThunk } from '../../redux/slices/authSlice'
import { addToast } from '../../redux/slices/uiSlice'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [step, setStep] = useState('email') // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState(null) // { message, type }
  const [resendCooldown, setResendCooldown] = useState(0) // seconds remaining

  const showError = (msg) => setNotification({ message: msg, type: 'error' })
  const clearNotification = () => setNotification(null)

  const handleEmailChange = (e) => {
    setEmail(e.target.value.trim().toLowerCase())
  }

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
  }

  // Step 1: Check if email is registered, then send OTP
  const handleEmailContinue = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    clearNotification()
    try {
      // sendLoginOtp checks DB first — throws 404 if email not registered
      await authApi.sendLoginOtp(email)
      setStep('otp')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP. Please try again.'
      showError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearNotification()
    try {
      await authApi.verifyOtp(email, otp)
      setNotification({ message: 'OTP verified successfully! Please enter your password to continue.', type: 'success' })
      setStep('password')
    } catch (err) {
      showError(err.response?.data?.message || 'Invalid or expired OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Login with password
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearNotification()
    try {
      const resultAction = await dispatch(loginThunk({ email, password }))
      if (loginThunk.fulfilled.match(resultAction)) {
        dispatch(addToast({ message: 'Welcome back! Login successful.', type: 'success' }))
        navigate('/dashboard')
      } else {
        showError(resultAction.payload || 'Invalid password. Please try again.')
      }
    } catch (err) {
      showError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP (also checks DB)
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    clearNotification()
    try {
      await authApi.sendLoginOtp(email)
      setNotification({ message: 'A new OTP has been sent to your email.', type: 'success' })
      // Start 60s cooldown countdown
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP.'
      showError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* Toast notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
        />
      )}

      <div className="ws-auth-form-wrap">

        {/* ── Step: OTP ── */}
        {step === 'otp' ? (
          <>
            <h1 className="ws-auth-step-title">Verify your email</h1>
            <p className="ws-auth-step-subtitle">
              We've sent a 6-digit code to <strong>{email}</strong>.
            </p>

            <form className="ws-auth-form" onSubmit={handleVerifyOtp}>
              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <input
                    className="ws-auth-input"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={handleOtpChange}
                    autoFocus
                    required
                    maxLength={6}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <button type="submit" className="ws-auth-btn-submit" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <p className="ws-auth-switch" style={{ margin: 0 }}>
                  Didn't receive it?{' '}
                  <button
                    type="button"
                    disabled={loading || resendCooldown > 0}
                    onClick={handleResendOtp}
                    style={{
                      background: 'none', border: 'none',
                      color: resendCooldown > 0 ? 'var(--color-text-secondary)' : 'var(--color-blue)',
                      fontWeight: 600,
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                      padding: 0, fontSize: 'inherit'
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); clearNotification() }}
                  style={{
                    marginTop: '8px', background: 'none', border: 'none',
                    color: 'var(--color-text-secondary)', fontSize: '0.8rem',
                    cursor: 'pointer', padding: 0
                  }}
                >
                  ← Change email
                </button>
              </div>
            </form>
          </>

        /* ── Step: Password ── */
        ) : step === 'password' ? (
          <>
            <h1 className="ws-auth-step-title">Welcome back!</h1>
            <p className="ws-auth-step-subtitle">Enter your password to sign in as <strong>{email}</strong>.</p>

            <form className="ws-auth-form" onSubmit={handleLogin}>
              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap" style={{ position: 'relative' }}>
                  <Lock size={14} className="ws-auth-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ws-auth-input"
                    placeholder="Enter your password…"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
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

              <button type="submit" className="ws-auth-btn-submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <Link to="/forgot-password" className="ws-auth-switch" style={{ color: 'var(--color-blue)', fontWeight: 500, fontSize: '0.85rem' }}>
                  Forgot password?
                </Link>
              </div>
            </form>
          </>

        /* ── Step: Email entry ── */
        ) : (
          <>
            <h1 className="ws-auth-step-title">Log in to Workshop</h1>
            <p className="ws-auth-step-subtitle">Enter your registered email to receive a verification code.</p>

            <form className="ws-auth-form" onSubmit={handleEmailContinue}>
              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Mail size={14} className="ws-auth-icon" />
                  <input
                    type="email"
                    className="ws-auth-input"
                    placeholder="Enter your work email address"
                    value={email}
                    onChange={handleEmailChange}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`ws-auth-btn-submit${loading ? ' loading' : ''}`}
                disabled={loading}
              >
                {loading ? 'Checking…' : 'Continue'}
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
          </>
        )}

        <p className="ws-auth-legal" style={{ marginTop: 'auto', paddingTop: 40 }}>
          By inserting your email you confirm you agree to Workshop contacting you about our
          product and services. You can opt out at any time. Find out more in our{' '}
          <a href="#">privacy policy</a>.
        </p>
      </div>
    </AuthLayout>
  )
}
