import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, FileText, Phone, Mail, Lock } from 'lucide-react'
import WorkshopLogo from '../components/WorkshopLogo'
import Notification from '../components/Notification'
import apiClient from '../api/client'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    shopName: '',
    gstin: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const validate = () => {
    const newErrors = {}
    if (!formData.shopName.trim()) newErrors.shopName = 'Shop name is required'
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format'
    }
    if (!/^[0-9]{10}$/.test(formData.mobile)) newErrors.mobile = 'Mobile must be 10 digits'
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 chars'
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    
    if (!validate()) return
    
    setLoading(true)
    
    try {
      const response = await apiClient.post('/auth/register', {
        shopName: formData.shopName,
        gstinNumber: formData.gstin,
        mobileNumber: formData.mobile,
        email: formData.email,
        password: formData.password
      })
      
      localStorage.setItem('ws_token', response.data.token)
      localStorage.setItem('ws_user', JSON.stringify({
        shopName: response.data.shopName,
        email: response.data.email
      }))
      navigate('/dashboard')
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ws-auth-layout">
      {apiError && <Notification message={apiError} type="error" onClose={() => setApiError('')} />}
      
      {/* Topbar */}
      <div className="ws-auth-topbar">
        <Link to="/" className="ws-auth-brand">
          <WorkshopLogo size={26} className="ws-auth-logo" />
          <span className="ws-auth-name">workshop</span>
        </Link>
      </div>

      {/* Card */}
      <div className="ws-auth-container">
        <div className="ws-auth-card ws-auth-card--signup">
          {/* Left Form */}
          <div className="ws-auth-left">
            <button type="button" className="ws-auth-google-btn">
              <svg className="ws-auth-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>

            <div className="ws-auth-divider">
              <div className="ws-auth-divider-line" />
              <span className="ws-auth-divider-text">or</span>
              <div className="ws-auth-divider-line" />
            </div>

            <form className="ws-auth-form" onSubmit={handleSubmit}>
              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Store size={13} className="ws-auth-icon" />
                  <input
                    type="text"
                    name="shopName"
                    className={`ws-auth-input ${errors.shopName ? 'error' : ''}`}
                    placeholder="Enter your shop name"
                    value={formData.shopName}
                    onChange={handleChange}
                  />
                </div>
                {errors.shopName && <div className="ws-auth-error-text">{errors.shopName}</div>}
              </div>

              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <FileText size={13} className="ws-auth-icon" />
                  <input
                    type="text"
                    name="gstin"
                    className={`ws-auth-input ${errors.gstin ? 'error' : ''}`}
                    placeholder="Enter GSTIN number"
                    value={formData.gstin}
                    onChange={handleChange}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                {errors.gstin && <div className="ws-auth-error-text">{errors.gstin}</div>}
              </div>

              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Phone size={13} className="ws-auth-icon" />
                  <input
                    type="tel"
                    name="mobile"
                    className={`ws-auth-input ${errors.mobile ? 'error' : ''}`}
                    placeholder="Enter mobile number"
                    value={formData.mobile}
                    onChange={handleChange}
                  />
                </div>
                {errors.mobile && <div className="ws-auth-error-text">{errors.mobile}</div>}
              </div>

              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Mail size={13} className="ws-auth-icon" />
                  <input
                    type="email"
                    name="email"
                    className={`ws-auth-input ${errors.email ? 'error' : ''}`}
                    placeholder="Enter your work email address"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                {errors.email && <div className="ws-auth-error-text">{errors.email}</div>}
              </div>

              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Lock size={13} className="ws-auth-icon" />
                  <input
                    type="password"
                    name="password"
                    className={`ws-auth-input ${errors.password ? 'error' : ''}`}
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                {errors.password && <div className="ws-auth-error-text">{errors.password}</div>}
              </div>

              <div className="ws-auth-input-group">
                <div className="ws-auth-input-wrap">
                  <Lock size={13} className="ws-auth-icon" />
                  <input
                    type="password"
                    name="confirmPassword"
                    className={`ws-auth-input ${errors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                {errors.confirmPassword && <div className="ws-auth-error-text">{errors.confirmPassword}</div>}
              </div>

              <button type="submit" className="ws-auth-btn-submit" disabled={loading}>
                {loading ? 'Creating Account...' : 'Continue'}
              </button>

              <div className="ws-auth-switch" style={{marginTop: 8}}>
                Already have an account? <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Log in</Link>
              </div>
            </form>

            <p className="ws-auth-legal" style={{marginTop: 'auto', paddingTop: 28}}>
              By inserting your details you confirm you agree to Workshop contacting you about our
              products and services. You can opt out any time by clicking unsubscribe in our emails.
              Find out more about how we use data in our <a href="#">privacy policy</a>.
            </p>
          </div>

          {/* Right Content */}
          <div className="ws-auth-right">
            <h2 className="ws-auth-right-title">Welcome to Workshop.</h2>
            <p className="ws-auth-right-p">
              Workshop is a radically new type of retail platform. Built specifically for Indian
              shops to manage billing, inventory, and customers effortlessly.
            </p>
            <p className="ws-auth-right-p">
              Every interaction within your store in minutes, always updated in real-time.
            </p>
            <p className="ws-auth-right-p" style={{ marginTop: 20, fontWeight: 500, color: 'var(--black)' }}>
              Let's begin.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ws-auth-footer">
        © {new Date().getFullYear()} Workshop Limited
        <a href="#">Privacy Policy</a>
        <a href="#">Support</a>
      </div>
    </div>
  )
}
