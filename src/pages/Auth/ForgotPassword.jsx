import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, KeyRound, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Notification from '../../components/Notification'
import AuthLayout from '../../components/layout/AuthLayout'
import { authApi } from '../../services/authApi'
import './Auth.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'reset' | 'success'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null) // { message, type }
  const [resendCooldown, setResendCooldown] = useState(0)

  const showError = (msg) => setNotification({ message: msg, type: 'error' })
  const showSuccess = (msg) => setNotification({ message: msg, type: 'success' })
  const clearNotification = () => setNotification(null)

  const handleEmailChange = (e) => {
    setEmail(e.target.value.trim().toLowerCase())
  }

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
  }

  // Step 1: Send Reset OTP
  const handleSendResetOtp = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    clearNotification()
    try {
      await authApi.sendResetOtp(email)
      setOtp('')
      showSuccess(`Verification code sent to ${email}`)
      setStep('reset')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP. Please check your email address.'
      showError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    clearNotification()
    try {
      await authApi.sendResetOtp(email)
      setOtp('')
      showSuccess('A new verification code has been sent.')
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    clearNotification()

    if (otp.length !== 6) {
      showError('Please enter a valid 6-digit OTP code.')
      return
    }

    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      showError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword({ email, otp, newPassword })
      setStep('success')
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to reset password. Please try again.')
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
        {step === 'email' && (
          <>
            <h1 className="ws-auth-step-title">Reset your password</h1>
            <p className="ws-auth-step-subtitle">
              Enter your registered email address and we'll send you a 6-digit verification code to reset your password.
            </p>

            <form className="ws-auth-form" onSubmit={handleSendResetOtp}>
              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Mail size={14} className="ws-auth-icon" />
                  <input
                    type="email"
                    className="ws-auth-input"
                    placeholder="Enter your registered email"
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
                disabled={loading || !email}
              >
                {loading ? 'Sending Code…' : 'Send Verification Code'}
              </button>
            </form>

            <div className="ws-auth-switch" style={{ marginTop: '16px' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </>
        )}

        {step === 'reset' && (
          <>
            <h1 className="ws-auth-step-title">Create new password</h1>
            <p className="ws-auth-step-subtitle">
              Verification code sent to <strong>{email}</strong>. Enter the code and your new password.
            </p>

            <form className="ws-auth-form" onSubmit={handleResetPassword}>
              <div className="ws-auth-input-group">
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px', display: 'block' }}>
                  6-Digit Verification Code
                </label>
                <div className="ws-auth-input-wrap">
                  <KeyRound size={14} className="ws-auth-icon" />
                  <input
                    className="ws-auth-input"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={handleOtpChange}
                    maxLength={6}
                    inputMode="numeric"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="ws-auth-input-group" style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px', display: 'block' }}>
                  New Password
                </label>
                <div className="ws-auth-input-wrap" style={{ position: 'relative' }}>
                  <Lock size={14} className="ws-auth-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ws-auth-input"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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

              <div className="ws-auth-input-group" style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px', display: 'block' }}>
                  Confirm New Password
                </label>
                <div className="ws-auth-input-wrap" style={{ position: 'relative' }}>
                  <Lock size={14} className="ws-auth-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ws-auth-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                disabled={loading || otp.length !== 6 || !newPassword || !confirmPassword}
                style={{ marginTop: '20px' }}
              >
                {loading ? 'Resetting Password…' : 'Reset Password'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <p className="ws-auth-switch" style={{ margin: 0 }}>
                  Didn't get the code?{' '}
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
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
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
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', marginBottom: 16 }}>
              <CheckCircle2 size={32} />
            </div>
            <h1 className="ws-auth-step-title" style={{ marginBottom: 8 }}>Password Reset Complete!</h1>
            <p className="ws-auth-step-subtitle" style={{ marginBottom: 24 }}>
              Your password has been successfully updated. You can now log in using your new credentials.
            </p>

            <button
              type="button"
              className="ws-auth-btn-submit"
              onClick={() => navigate('/login')}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
