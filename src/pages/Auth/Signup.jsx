import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, FileText, Phone, Mail, Lock } from 'lucide-react'
import { useAppDispatch } from '../../redux/hooks'
import { registerThunk } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import { validateSignupForm } from '../../utils/validators'
import AuthLayout from '../../components/layout/AuthLayout'
import Input from '../../components/ui/Input'
import './Auth.css'

export default function Signup() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { isLoading } = useAuth()

  const [form, setForm] = useState({
    shopName: '', gstin: '', mobile: '', email: '', password: '', confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const newErrors = validateSignupForm(form)
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }
    const result = await dispatch(registerThunk(form))
    if (registerThunk.fulfilled.match(result)) {
      navigate('/dashboard')
    } else {
      setApiError(result.payload || 'Registration failed. Please try again.')
    }
  }

  const rightPanel = (
    <>
      <h2 className="ws-auth-right-title">Welcome to Workshop.</h2>
      <p className="ws-auth-right-body">
        Workshop is a radically new type of retail platform. Built specifically for Indian
        shops to manage billing, inventory, and customers effortlessly.
      </p>
      <p className="ws-auth-right-body" style={{ marginTop: 12 }}>
        Every interaction within your store, always updated in real-time.
      </p>
      <p className="ws-auth-right-body" style={{ marginTop: 20, fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Let's begin.
      </p>
    </>
  )

  return (
    <AuthLayout rightPanel={rightPanel}>
      <div className="ws-auth-form-wrap">
        {apiError && <p className="ws-auth-error-text" style={{ textAlign: 'center', marginBottom: 8 }}>{apiError}</p>}
        <form className="ws-auth-form" onSubmit={handleSubmit} noValidate>
          <Input name="shopName" placeholder="Shop name" icon={Store}
            value={form.shopName} onChange={handleChange} error={errors.shopName} />
          <Input name="gstin" placeholder="GSTIN (e.g. 27ABCDE1234F1Z5)" icon={FileText}
            value={form.gstin} onChange={handleChange} error={errors.gstin}
            style={{ textTransform: 'uppercase' }} />
          <Input name="mobile" type="tel" placeholder="Mobile number (10 digits)" icon={Phone}
            value={form.mobile} onChange={handleChange} error={errors.mobile} />
          <Input name="email" type="email" placeholder="Work email address" icon={Mail}
            value={form.email} onChange={handleChange} error={errors.email} />
          <Input name="password" type="password" placeholder="Create a password (min 6 chars)" icon={Lock}
            value={form.password} onChange={handleChange} error={errors.password} />
          <Input name="confirmPassword" type="password" placeholder="Confirm your password" icon={Lock}
            value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />
          <button type="submit" className="ws-auth-submit-btn" disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Continue'}
          </button>
        </form>
        <div className="ws-auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
        <p className="ws-auth-legal">
          By inserting your details you confirm you agree to Workshop contacting you about our
          products and services. You can opt out any time. Find out more in our{' '}
          <a href="#">privacy policy</a>.
        </p>
      </div>
    </AuthLayout>
  )
}