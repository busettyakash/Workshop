import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAppDispatch } from '../../redux/hooks'
import { loginThunk } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/ui/Input'
import './Auth.css'

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { isLoading, error } = useAuth()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPw] = useState('')
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
      <div className="ws-auth-form-wrap">
        {step === 'password' ? (
          <>
            <h2 className="ws-auth-step-title">Check your inbox!</h2>
            <p className="ws-auth-step-subtitle">
              We've just emailed you a temporary password.<br />
              Please enter it below.
            </p>
            <form className="ws-auth-form" onSubmit={handleLogin} noValidate>
              <div className="ws-auth-email-display">
                <Mail size={13} color="var(--color-text-tertiary)" />
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
              <button type="submit" className="ws-auth-submit-btn" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
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
          </>
        )}

        <p className="ws-auth-legal">
          By inserting your email you confirm you agree to Workshop contacting you about
          our product and services. You can opt out at any time by clicking unsubscribe.
          Find out more about how we use data in our <a href="#">privacy policy</a>.
        </p>
      </div>
    </AuthLayout>
  )
}