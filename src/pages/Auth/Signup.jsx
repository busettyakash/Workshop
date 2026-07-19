import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, ArrowLeft, Phone, CreditCard } from 'lucide-react'
import WorkshopLogo from '../../components/WorkshopLogo'
import Notification from '../../components/Notification'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/ui/Input'
import { authApi } from '../../services/authApi'
import { useAppDispatch } from '../../redux/hooks'
import { registerThunk } from '../../redux/slices/authSlice'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const inviteFrom = searchParams.get('invite_from') || ''
  const inviteWorkspace = searchParams.get('workspace') || ''
  const [step, setStep] = useState(1) // 1 to 5
  const [form, setForm] = useState({
    email: inviteFrom ? '' : '', password: '', confirmPassword: '',
    companyName: '', workspaceHandle: '', workspaceHandleManual: false,
    billingCountry: 'India', referralSource: '',
    phone: '', gstin: '',
    usageType: 'Sales', inviteEmail: '', otp: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState(null) // { message, type }
  const [resendCooldown, setResendCooldown] = useState(0)

  const showNotif = (message, type = 'info') => setNotification({ message, type })
  const clearNotif = () => setNotification(null)

  const normalizeEmail = (value) => value.trim().toLowerCase()
  const normalizeOtp   = (value) => value.replace(/\D/g, '').slice(0, 6)

  // Auto-generate workspace handle from company name
  useEffect(() => {
    if (!form.workspaceHandleManual && form.companyName) {
      const slug = form.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      setForm(prev => ({ ...prev, workspaceHandle: slug }))
    }
  }, [form.companyName, form.workspaceHandleManual])

  // Resend OTP countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleChange = (e) => {
    const { name, value } = e.target
    const next =
      name === 'email' ? normalizeEmail(value)
      : name === 'otp' ? normalizeOtp(value)
      : value
    setForm(prev => ({ ...prev, [name]: next }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleHandleChange = (e) => {
    setForm(prev => ({ ...prev, workspaceHandle: e.target.value, workspaceHandleManual: true }))
  }

  // ── Step 1: Validate & send OTP ──
  const handleStep1 = async (e) => {
    e.preventDefault()
    clearNotif()
    const newErrors = {}
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Valid email is required.'
    if (!form.password || form.password.length < 6)       newErrors.password = 'Password must be at least 6 characters.'
    if (form.password !== form.confirmPassword)           newErrors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

    setIsLoading(true)
    try {
      await authApi.sendOtp(form.email)
      showNotif(`Verification code sent to ${form.email}`, 'success')
      setStep(2)
      setResendCooldown(30)
    } catch (err) {
      showNotif(err?.response?.data?.message || 'Failed to send OTP. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Verify OTP ──
  const handleStep2 = async (e) => {
    e.preventDefault()
    clearNotif()
    if (!form.otp || form.otp.length !== 6) {
      setErrors(prev => ({ ...prev, otp: 'Please enter the 6-digit OTP.' }))
      return
    }
    setIsLoading(true)
    try {
      await authApi.verifyOtp(form.email, form.otp)
      showNotif('Email verified successfully! Continue to set up your workspace.', 'success')
      setStep(3)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid or expired OTP. Please try again.'
      setErrors(prev => ({ ...prev, otp: msg }))
      showNotif(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Resend OTP ──
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    clearNotif()
    setIsLoading(true)
    try {
      await authApi.sendOtp(form.email)
      showNotif(`New code sent to ${form.email}`, 'info')
      setResendCooldown(30)
      setForm(prev => ({ ...prev, otp: '' }))
      setErrors(prev => ({ ...prev, otp: '' }))
    } catch {
      showNotif('Failed to resend OTP. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 3: Workspace ──
  const handleStep3 = (e) => {
    e.preventDefault()
    clearNotif()
    if (!form.companyName?.trim()) {
      setErrors(prev => ({ ...prev, companyName: 'Company name is required.' }))
      return
    }
    setStep(4)
  }

  // ── Step 4: Business details ──
  const handleStep4 = (e) => {
    e.preventDefault()
    clearNotif()
    const newErrors = {}
    if (!form.phone) {
      newErrors.phone = 'Phone number is required.'
    } else if (!/^[+\d\s\-()]{7,15}$/.test(form.phone)) {
      newErrors.phone = 'Enter a valid phone number.'
    }
    if (!form.gstin) {
      newErrors.gstin = 'GSTIN is required.'
    } else if (form.gstin.length !== 15) {
      newErrors.gstin = 'GSTIN must be exactly 15 characters.'
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      showNotif('Please fill in all required business details.', 'warning')
      return
    }
    setStep(5)
  }

  // ── Step 5: Final submit ──
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    clearNotif()
    setIsLoading(true)
    try {
      const payload = {
        email:           form.email,
        password:        form.password,
        shopName:        form.companyName,
        companyName:     form.companyName,
        phone:           form.phone,
        gstin:           form.gstin,
        billingCountry:  form.billingCountry,
        referralSource:  form.referralSource,
        usageType:       form.usageType,
        workspaceHandle: form.workspaceHandle,
        inviteEmail:     form.inviteEmail,
      }
      const resultAction = await dispatch(registerThunk(payload))
      if (registerThunk.fulfilled.match(resultAction)) {
        showNotif('Workspace created! Redirecting to dashboard…', 'success')
        setTimeout(() => navigate('/dashboard'), 1200)
      } else {
        const errMsg = resultAction.payload || 'Registration failed. Please try again.'
        showNotif(errMsg, 'error')
      }
    } catch {
      showNotif('Something went wrong. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Right preview panel ──
  const rightPanel = step === 1 ? null : (
    <div className="ws-onboarding-preview">
      <div className="ws-preview-window">
        {step <= 4 ? (
          <>
            <div className="ws-preview-sidebar">
              <div className="ws-preview-item ws-active">
                <div className="ws-preview-avatar"><WorkshopLogo size={18} /></div>
                <span className="ws-preview-text">{form.companyName || 'Workspace title'}</span>
                <ArrowLeft size={12} style={{ transform: 'rotate(-90deg)', marginLeft: 'auto', opacity: 0.5 }} />
              </div>
              <div className="ws-preview-search"><div className="ws-preview-search-icon" /></div>
              <div className="ws-preview-nav">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="ws-preview-nav-item"
                    style={{ width: i === 1 ? '70%' : '50%', background: step === 4 && i === 1 ? 'var(--color-blue)' : '#eee' }} />
                ))}
              </div>
            </div>
            <div className="ws-preview-content">
              <div className="ws-preview-header">
                <div className="ws-preview-header-icon" />
                <div className="ws-preview-header-text" />
              </div>
              <div className="ws-preview-grid">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="ws-preview-cell" style={{
                    opacity: step >= 3 ? 1 : 0.5,
                    border: step === 4 ? '1px solid var(--color-blue)' : '1px solid #f0f0f0'
                  }} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="ws-preview-team-view">
            <div className="ws-preview-header" style={{ padding: '20px' }}>
              <div style={{ width: '120px', height: '10px', background: '#eee', borderRadius: '5px' }} />
            </div>
            <div className="ws-preview-table" style={{ padding: '0 20px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f0f0f0' }} />
                  <div style={{ width: '100px', height: '8px', background: '#f9f9f9', borderRadius: '4px', marginTop: '8px' }} />
                  <div style={{ marginLeft: 'auto', width: '60px', height: '8px', background: '#f9f9f9', borderRadius: '4px', marginTop: '8px' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="ws-preview-highlight" />
    </div>
  )

  return (
    <AuthLayout rightPanel={rightPanel}>

      {/* Single notification — uses your existing Notification component */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={clearNotif}
        />
      )}

      <div className="ws-auth-form-wrap">

        {/* ── Invite context banner ── */}
        {inviteFrom && step === 1 && (
          <div style={{
            background: 'linear-gradient(135deg, #e0f2fe, #f0e6ff)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid rgba(99, 102, 241, 0.15)',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '14px', flexShrink: 0
            }}>
              {(inviteFrom[0] || '?').toUpperCase()}
            </div>
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.45 }}>
              <strong>{inviteFrom}</strong> invited you to join
              <strong style={{ color: '#6366f1' }}> {inviteWorkspace || 'their workspace'}</strong>.
              Sign up below and you'll be added automatically.
            </div>
          </div>
        )}

        {/* ── STEP 1: Create account ── */}
        {step === 1 && (
          <>
            <div className="ws-auth-stepper">1/5</div>
            <h1 className="ws-auth-step-title">Create your account</h1>
            <p className="ws-auth-step-subtitle">Start your journey with Workshop today.</p>
            <form className="ws-auth-form" onSubmit={handleStep1} noValidate>
              <Input name="email" type="email" placeholder="Work email address" icon={Mail}
                value={form.email} onChange={handleChange} error={errors.email} autoFocus />
              <Input name="password" type="password" placeholder="Create a password (min 6 chars)" icon={Lock}
                value={form.password} onChange={handleChange} error={errors.password} />
              <Input name="confirmPassword" type="password" placeholder="Confirm your password" icon={Lock}
                value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />
              <button type="submit" className="ws-auth-submit-btn" disabled={isLoading}>
                {isLoading ? 'Sending code…' : 'Continue'}
              </button>
              <div className="ws-auth-switch">
                Already have an account? <Link to="/login">Log in</Link>
              </div>
            </form>
            <p className="ws-auth-legal">
              By inserting your details you confirm you agree to Workshop contacting you about our
              products and services. You can opt out any time. Find out more in our{' '}
              <a href="#">privacy policy</a>.
            </p>
          </>
        )}

        {/* ── STEP 2: Verify OTP (original style) ── */}
        {step === 2 && (
          <form className="ws-auth-form" onSubmit={handleStep2} noValidate style={{ gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button type="button" onClick={() => setStep(1)} className="ws-auth-back-btn">
                <ArrowLeft size={16} />
              </button>
              <div className="ws-auth-stepper" style={{ margin: 0 }}>2/5</div>
            </div>

            <h1 className="ws-auth-step-title" style={{ textAlign: 'left' }}>Verify your email</h1>
            <p className="ws-auth-step-subtitle" style={{ textAlign: 'left' }}>
              We've sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to continue.
            </p>

            <Input
              name="otp"
              placeholder="6-digit OTP"
              value={form.otp}
              onChange={handleChange}
              error={errors.otp}
              autoFocus
              maxLength={6}
              inputMode="numeric"
            />

            <button type="submit" className="ws-auth-submit-btn" disabled={isLoading || form.otp.length !== 6} style={{ marginTop: '8px' }}>
              {isLoading ? 'Verifying…' : 'Verify OTP'}
            </button>

            <p className="ws-auth-switch">
              Didn't receive it?{' '}
              <button
                type="button"
                className="ws-text-btn"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                style={{ opacity: resendCooldown > 0 ? 0.5 : 1 }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </button>
            </p>
          </form>
        )}

        {/* ── STEP 3: Workspace ── */}
        {step === 3 && (
          <form className="ws-auth-form" onSubmit={handleStep3} noValidate style={{ gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button type="button" onClick={() => setStep(2)} className="ws-auth-back-btn">
                <ArrowLeft size={16} />
              </button>
              <div className="ws-auth-stepper" style={{ margin: 0 }}>3/5</div>
            </div>
            <h1 className="ws-auth-step-title" style={{ textAlign: 'left' }}>Create your workspace</h1>

            <div className="ws-logo-upload-section">
              <div className="ws-logo-preview"><WorkshopLogo size={28} /></div>
              <div className="ws-logo-actions">
                <span className="ws-logo-label">Company logo</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="ws-logo-btn">Replace image</button>
                  <button type="button" className="ws-logo-btn ws-remove">Remove</button>
                </div>
                <p className="ws-logo-hint">*.png, *.jpeg files up to 10MB at least 400px by 400px</p>
              </div>
            </div>

            <div className="ws-form-field">
              <label className="ws-field-label">Company name</label>
              <Input name="companyName" placeholder="Enter your company name..."
                value={form.companyName} onChange={handleChange} error={errors.companyName} autoFocus />
            </div>

            <div className="ws-form-field">
              <label className="ws-field-label">Workspace handle</label>
              <div className="ws-handle-input-wrap">
                <span className="ws-handle-prefix">app.workshop.com/</span>
                <input className="ws-handle-input" value={form.workspaceHandle} onChange={handleHandleChange} />
              </div>
            </div>

            <div className="ws-form-field">
              <label className="ws-field-label">Billing country</label>
              <select className="ws-styled-select" name="billingCountry" value={form.billingCountry} onChange={handleChange}>
                <option value="India">India</option>
                <option value="United States of America">United States of America</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
              </select>
            </div>

            <div className="ws-form-field">
              <label className="ws-field-label">How did you hear about us?</label>
              <textarea className="ws-styled-textarea" name="referralSource"
                placeholder="Share how you heard about Workshop..."
                value={form.referralSource} onChange={handleChange} />
            </div>

            <button type="submit" className="ws-auth-submit-btn" style={{ marginTop: '8px' }}>
              Continue
            </button>
          </form>
        )}

        {/* ── STEP 4: Business details ── */}
        {step === 4 && (
          <form className="ws-auth-form" onSubmit={handleStep4} noValidate style={{ gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button type="button" onClick={() => setStep(3)} className="ws-auth-back-btn">
                <ArrowLeft size={16} />
              </button>
              <div className="ws-auth-stepper" style={{ margin: 0 }}>4/5</div>
            </div>
            <h1 className="ws-auth-step-title" style={{ textAlign: 'left' }}>Customize your workspace</h1>
            <p className="ws-auth-step-subtitle" style={{ textAlign: 'left' }}>Tell us how you'll use Workshop and add your business details.</p>

            <div className="ws-form-field">
              <label className="ws-field-label">What will you be using it for?</label>
              <div className="ws-custom-chips">
                {['Sales', 'Inventory', 'Billing', 'Customers', 'Marketing', 'E-commerce', 'Wholesale', 'Other'].map(option => (
                  <button key={option} type="button"
                    className={`ws-chip ${form.usageType === option ? 'ws-active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, usageType: option }))}>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="ws-step4-divider"><span>Business identity</span></div>

            <div className="ws-form-field">
              <label className="ws-field-label">Phone number</label>
              <Input name="phone" type="tel" placeholder="+91 98765 43210" icon={Phone}
                value={form.phone} onChange={handleChange} error={errors.phone} />
            </div>

            <div className="ws-form-field">
              <label className="ws-field-label">GSTIN</label>
              <Input name="gstin" type="text" placeholder="22AAAAA0000A1Z5" icon={CreditCard}
                value={form.gstin}
                onChange={e => {
                  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                  setForm(prev => ({ ...prev, gstin: v }))
                  if (errors.gstin) setErrors(prev => ({ ...prev, gstin: '' }))
                }}
                error={errors.gstin} />
              <p className="ws-field-hint">15-character GST Identification Number (e.g., 22AAAAA0000A1Z5)</p>
            </div>

            <button type="submit" className="ws-auth-submit-btn" style={{ marginTop: '8px' }}>
              Continue
            </button>
          </form>
        )}

        {/* ── STEP 5: Team invite ── */}
        {step === 5 && (
          <form className="ws-auth-form" onSubmit={handleSubmit} noValidate style={{ gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button type="button" onClick={() => setStep(4)} className="ws-auth-back-btn">
                <ArrowLeft size={16} />
              </button>
              <div className="ws-auth-stepper" style={{ margin: 0 }}>5/5</div>
            </div>
            <h1 className="ws-auth-step-title" style={{ textAlign: 'left' }}>Collaborate with your team</h1>
            <p className="ws-auth-step-subtitle" style={{ textAlign: 'left' }}>The more your teammates use Workshop, the more powerful it becomes.</p>

            <div className="ws-form-field">
              <label className="ws-field-label">Invite people to collaborate</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input placeholder="example@email.com" value={form.inviteEmail}
                  onChange={e => setForm(prev => ({ ...prev, inviteEmail: e.target.value }))}
                  style={{ flex: 1 }} />
                <select className="ws-styled-select" style={{ width: '100px' }}>
                  <option>Member</option>
                  <option>Admin</option>
                </select>
              </div>
            </div>

            <button type="submit" className="ws-auth-submit-btn" disabled={isLoading} style={{ marginTop: '8px' }}>
              {isLoading ? 'Setting up workspace…' : 'Send invites'}
            </button>
            <button type="button" onClick={handleSubmit} disabled={isLoading} className="ws-auth-skip-btn">
              {isLoading ? 'Setting up…' : 'Skip for now'}
            </button>
          </form>
        )}

      </div>
    </AuthLayout>
  )
}
