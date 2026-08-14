import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { selectSidebarOpen, addToast, setActiveNav } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import { 
  ArrowLeft, Search, User, Palette, Mail, PhoneCall, HardDrive, Share2, Bell, MessageSquare, Plug,
  Building2, Users, Radio, CreditCard, DollarSign, Code, Headphones, ArrowRightLeft, Grid, Info, Camera, HelpCircle, Save, Lock
} from 'lucide-react'
import '../Dashboard/Dashboard.css'

function getSanitizedImageUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  const isSafeProtocol = /^(blob:|data:image\/(png|jpeg|jpg|gif|webp);base64,|https?:\/\/)/i.test(trimmed)
  if (!isSafeProtocol) return ''
  try {
    return encodeURI(decodeURI(trimmed))
  } catch {
    return encodeURI(trimmed)
  }
}

export default function AccountSettings() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user, shopName } = useAuth()

  useEffect(() => {
    dispatch(setActiveNav('Settings'))
  }, [dispatch])

  const [activeSection, setActiveSection] = useState('profile') // 'profile' | 'security' | 'appearance'
  const fileInputRef = useRef(null)

  // Profile Form state
  const [firstName, setFirstName] = useState(() => user?.name?.split(' ')[0] || 'Akash')
  const [lastName, setLastName] = useState(() => user?.name?.split(' ').slice(1).join(' ') || 'Busetty')
  const [email, setEmail] = useState(() => user?.email || '21btrcs126@jainuniversity.ac.in')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [startWeekOn, setStartWeekOn] = useState('Monday')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedImageTypes.includes(file.type)) {
        dispatch(addToast({ message: 'Invalid file type. Please upload a PNG, JPEG, GIF, or WEBP image.', type: 'error' }))
        return
      }
      setAvatarUrl(URL.createObjectURL(file))
      dispatch(addToast({ message: 'Profile picture updated', type: 'success' }))
    }
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    dispatch(addToast({ message: 'Profile details saved successfully!', type: 'success' }))
  }

  const handleSavePassword = (e) => {
    e.preventDefault()
    if (!currentPassword) {
      dispatch(addToast({ message: 'Please enter current password', type: 'error' }))
      return
    }
    if (newPassword.length < 6) {
      dispatch(addToast({ message: 'New password must be at least 6 characters', type: 'error' }))
      return
    }
    if (newPassword !== confirmPassword) {
      dispatch(addToast({ message: 'Passwords do not match', type: 'error' }))
      return
    }
    dispatch(addToast({ message: 'Password updated successfully!', type: 'success' }))
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Settings Top Header Bar */}
      <div style={{
        height: 44,
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#0f172a',
              fontFamily: 'inherit'
            }}
          >
            <ArrowLeft size={15} />
            <span>Settings</span>
          </button>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            {activeSection === 'profile' ? 'Profile' : activeSection === 'security' ? 'Security & Password' : 'Appearance'}
          </span>
        </div>

        <button
          onClick={() => dispatch(addToast({ message: 'Help center opened', type: 'info' }))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78rem', fontFamily: 'inherit' }}
        >
          <HelpCircle size={14} />
          <span>Help</span>
        </button>
      </div>

      {/* Settings Inner Body (Left Settings Sidebar + Main Content) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#ffffff' }}>
        
        {/* Left Settings Sidebar (Matching Main Sidebar font size, weight & styling) */}
        <div style={{
          width: 235,
          borderRight: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 8px',
          overflowY: 'auto',
          flexShrink: 0,
          fontFamily: 'inherit'
        }}>
          {/* Search Box */}
          <div style={{ padding: '2px 0 8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 27,
              padding: '0 8px',
              borderRadius: 7,
              border: '1px solid #e2e8f0',
              background: '#ffffff'
            }}>
              <Search size={13} style={{ color: '#64748b', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search settings..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '0.77rem',
                  color: '#0f172a',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* Personal Section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '8px 8px 4px'
            }}>
              Personal
            </div>

            <button
              onClick={() => setActiveSection('profile')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'profile' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'profile' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'profile' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 1
              }}
            >
              <User size={14} style={{ color: activeSection === 'profile' ? '#0f172a' : '#64748b' }} />
              <span>Profile</span>
            </button>


            <button
              onClick={() => setActiveSection('appearance')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'appearance' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'appearance' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'appearance' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 1
              }}
            >
              <Palette size={14} style={{ color: activeSection === 'appearance' ? '#0f172a' : '#64748b' }} />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => navigate('/workspace-settings')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: '#344054',
                fontWeight: 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              <Bell size={14} style={{ color: '#64748b' }} />
              <span>Notifications</span>
            </button>
          </div>

          {/* Workspace Section Link */}
          <div>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '8px 8px 4px'
            }}>
              Workspace
            </div>

            <button
              onClick={() => navigate('/workspace-settings')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: '#344054',
                fontWeight: 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              <Building2 size={14} style={{ color: '#64748b' }} />
              <span>General</span>
            </button>
          </div>
        </div>

          {/* Main Content Area (Matching Screenshot Design 100%) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
            {activeSection === 'profile' && (
              <div style={{ maxWidth: 720 }}>
                {/* Title & Subtitle */}
                <div style={{ marginBottom: 20 }}>
                  <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    Profile
                  </h1>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Manage your personal details. 
                    <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }} onClick={e => e.preventDefault()}>
                      Learn more ↗
                    </a>
                  </p>
                </div>

                {/* Info Alert Box */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: 12,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 28,
                  color: '#475569',
                  fontSize: '0.84rem'
                }}>
                  <Info size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                  <span>Changes to your profile will apply to all of your workspaces.</span>
                </div>

                {/* Profile Picture Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                  {getSanitizedImageUrl(avatarUrl) ? (
                    <img src={getSanitizedImageUrl(avatarUrl)} alt="Profile" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: '#10b981',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {(firstName || 'A')[0].toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Profile Picture</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>We only support PNGs, JPEGs and GIFs under 10MB</span>
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        <Camera size={14} />
                        Upload Image
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                    </div>
                  </div>
                </div>

                {/* Form Fields: First Name & Last Name */}
                <form onSubmit={handleSaveProfile}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>First Name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        style={{
                          width: '100%',
                          height: 40,
                          padding: '0 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          outline: 'none',
                          background: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        style={{
                          width: '100%',
                          height: 40,
                          padding: '0 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          outline: 'none',
                          background: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Primary email address */}
                  <div style={{ marginBottom: 32 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Primary email address</label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: 40,
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '0 8px 0 14px',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '0.875rem',
                          color: '#0f172a'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => dispatch(addToast({ message: 'Email edit requested', type: 'info' }))}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '4px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Time Preferences Section */}
                  <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid #f1f5f9' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>
                      Time preferences
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 20px' }}>
                      Manage your time preferences
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Preferred Timezone</label>
                        <select
                          value={timezone}
                          onChange={e => setTimezone(e.target.value)}
                          style={{
                            width: '100%',
                            height: 40,
                            padding: '0 14px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            fontSize: '0.875rem',
                            color: '#0f172a',
                            background: '#ffffff',
                            outline: 'none',
                            cursor: 'pointer',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata</option>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York (EST)</option>
                          <option value="Europe/London">Europe/London (GMT)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Start week on</label>
                        <select
                          value={startWeekOn}
                          onChange={e => setStartWeekOn(e.target.value)}
                          style={{
                            width: '100%',
                            height: 40,
                            padding: '0 14px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            fontSize: '0.875rem',
                            color: '#0f172a',
                            background: '#ffffff',
                            outline: 'none',
                            cursor: 'pointer',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="Monday">Monday</option>
                          <option value="Sunday">Sunday</option>
                          <option value="Saturday">Saturday</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 20px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeSection === 'security' && (
              <div style={{ maxWidth: 480 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Security & Password</h1>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 24 }}>Update your account password</p>

                <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="submit"
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 20px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
