import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAppDispatch } from '../../redux/hooks'
import { loginThunk, clearError, setEmailStep } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/ui/Input'
import './Auth.css'

export default function Login() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const { isLoading, error } = useAuth()

  const [step, setStep]     = useState('email') // 'email' | 'checking' | 'password'
  const [email, setEmail]   = useState('')
  const [password, setPw]   = useState('')
  const [localError, setLocalError] = useState('')

  const handleEmailContinue = (e) => {
    e.preventDefault()
    if (!email) return
    setStep('checking')
    setTimeout(() => setStep('password'), 900)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLocalError('')
    const result = await dispatch(loginThunk({ email, password }))
    if (loginThunk.fulfilled.match(result)) {
      navigate('/dashboard')
    } else {
      setLocalError(result.payload || 'Invalid credentials')
    }
  }

  const displayError = localError || error

  return (
    <AuthLayout>
      {step === 'password' ? (
        /* ── Step 2: Password ── */
        <>
          <h2 className="ws-auth-step-title">Check your inbox!</h2>
          <p className="ws-auth-step-subtitle">
            We've just emailed you a temporary password.<br />
            Please enter it below.
          </p>

          <form className="ws-auth-form" onSubmit={handleLogin} noValidate>
            {/* Non-editable email */}
            <div className="ws-auth-email-display">
              <Mail size={13} color="var(--color-gray-400)" />
              {email}
            </div>

            <Input
              type="password"
              placeholder="Enter temporary password..."
              value={password}
              onChange={(e) => setPw(e.target.value)}
              icon={Lock}
              error={displayError}
              autoFocus
              required
            />

            <button
              type="submit"
              className="ws-auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          <p className="ws-auth-legal">
            By inserting your email you confirm you agree to Workshop contacting you about
            our product and services. You can opt out at any time by clicking unsubscribe.
            Find out more about how we use data in our <a href="#">privacy policy</a>.
          </p>
        </>
      ) : (
        /* ── Step 1: Email ── */
        <>
          {/* Google SSO */}
          <button type="button" className="ws-auth-google-btn">
            <svg className="ws-auth-google-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <div className="ws-auth-divider">
            <div className="ws-auth-divider-line" />
            <span className="ws-auth-divider-text">or</span>
            <div className="ws-auth-divider-line" />
          </div>

          <form className="ws-auth-form" onSubmit={handleEmailContinue} noValidate>
            <Input
              type="email"
              placeholder="Enter your work email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
            />

            <button
              type="submit"
              className={`ws-auth-submit-btn ${step === 'checking' ? 'loading' : ''}`}
              disabled={step === 'checking'}
            >
              {step === 'checking' ? 'Checking email…' : 'Continue'}
            </button>
          </form>

          <div className="ws-auth-switch">
            Don't have an account?{' '}
            <Link to="/signup">Sign up</Link>
          </div>

          <p className="ws-auth-legal">
            By inserting your email you confirm you agree to Workshop contacting you about
            our product and services. You can opt out at any time by clicking unsubscribe.
            Find out more about how we use data in our <a href="#">privacy policy</a>.
          </p>
        </>
      )}
    </AuthLayout>
  )
}
