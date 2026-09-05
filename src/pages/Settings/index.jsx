import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, setActiveNav } from '../../redux/slices/uiSlice'
import { updateUser } from '../../redux/slices/authSlice'
import { useAuth } from '../../hooks/useAuth'
import {
  ChevronLeft, ArrowLeft, Search, User, Palette, Bell, Lock, Building2, LayoutGrid, Scale, Users, DollarSign, Info, Camera, HelpCircle, Save, Plus, Trash2, Copy, Download, Calendar, X
} from 'lucide-react'
import api from '../../api/client'
import UomManager from '../../components/settings/UomManager'
import MembersManager from '../../components/settings/MembersManager'
import { usePermissions, isOwnerOrAdmin } from '../../utils/permissionUtils'
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

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, shopName } = useAuth()

  const { role } = usePermissions()
  const isOwnerAdmin = isOwnerOrAdmin(role)

  const VALID_SECTIONS = isOwnerAdmin ? ['profile', 'general', 'uom', 'members', 'billing'] : ['profile']

  // Determine initial active section based on URL or pathname or localStorage
  const [activeSection, setActiveSection] = useState(() => {
    if (!isOwnerAdmin) return 'profile'
    if (location.pathname === '/workspace-settings') return 'general'
    if (location.pathname === '/account-settings') return 'profile'
    const searchParams = new URLSearchParams(location.search)
    const tab = searchParams.get('tab')
    if (tab && VALID_SECTIONS.includes(tab)) return tab
    const saved = localStorage.getItem('ws_active_settings_tab')
    if (saved && VALID_SECTIONS.includes(saved)) return saved
    return 'profile'
  })

  useEffect(() => {
    dispatch(setActiveNav('Settings'))
  }, [dispatch])

  useEffect(() => {
    if (!isOwnerAdmin) {
      if (activeSection !== 'profile') {
        setActiveSection('profile')
      }
      if (location.pathname === '/workspace-settings' || (location.pathname === '/settings' && location.search)) {
        navigate('/account-settings', { replace: true })
      }
      return
    }
    if (location.pathname === '/workspace-settings') {
      setActiveSection('general')
    } else if (location.pathname === '/account-settings') {
      setActiveSection('profile')
    } else {
      const searchParams = new URLSearchParams(location.search)
      const tab = searchParams.get('tab')
      if (tab && VALID_SECTIONS.includes(tab)) {
        setActiveSection(tab)
      } else if (!VALID_SECTIONS.includes(activeSection)) {
        setActiveSection('profile')
      }
    }
  }, [location.pathname, location.search, isOwnerAdmin])

  const selectSection = (key) => {
    if (!isOwnerAdmin) {
      setActiveSection('profile')
      navigate('/account-settings', { replace: true })
      return
    }
    const validKey = VALID_SECTIONS.includes(key) ? key : 'profile'
    setActiveSection(validKey)
    localStorage.setItem('ws_active_settings_tab', validKey)
    if (validKey === 'general') {
      navigate('/workspace-settings', { replace: true })
    } else if (validKey === 'profile') {
      navigate('/account-settings', { replace: true })
    } else {
      navigate(`/settings?tab=${validKey}`, { replace: true })
    }
  }

  const profileInputRef = useRef(null)
  const logoInputRef = useRef(null)

  // Profile Form state
  const [firstName, setFirstName] = useState(() => {
    const saved = localStorage.getItem('ws_profile_settings')
    if (saved) {
      try { return JSON.parse(saved).firstName || '' } catch { }
    }
    return user?.firstName || user?.name?.split(' ')[0] || ''
  })
  const [lastName, setLastName] = useState(() => {
    const saved = localStorage.getItem('ws_profile_settings')
    if (saved) {
      try { return JSON.parse(saved).lastName || '' } catch { }
    }
    return user?.lastName || user?.name?.split(' ').slice(1).join(' ') || ''
  })
  const [email, setEmail] = useState(() => {
    const saved = localStorage.getItem('ws_profile_settings')
    if (saved) {
      try { return JSON.parse(saved).email || '' } catch { }
    }
    return user?.email || ''
  })
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('ws_avatar_url') || ''
  })

  // Workspace Form state
  const [workspaceForm, setWorkspaceForm] = useState(() => {
    const saved = localStorage.getItem('ws_workspace_settings')
    if (saved) {
      try { return JSON.parse(saved) } catch { }
    }
    return {
      shopName: shopName || user?.shopName || '',
      phone: '',
      gstin: '',
      address: ''
    }
  })

  // Billing Preferences state
  const [billingForm, setBillingForm] = useState(() => {
    const saved = localStorage.getItem('ws_billing_preferences')
    if (saved) {
      try { return JSON.parse(saved) } catch { }
    }
    return {
      currencySymbol: '₹ (INR)',
      defaultGstRate: '18',
      invoicePrefix: 'INV-',
      paymentTerms: 'Due on Receipt',
      footerNote: 'Thank you for your business! Terms & Conditions apply.'
    }
  })

  const handleSaveBillingPreferences = (e) => {
    e.preventDefault()
    localStorage.setItem('ws_billing_preferences', JSON.stringify(billingForm))
    dispatch(addToast({ message: 'Billing preferences saved successfully!', type: 'success' }))
  }

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Settings Search state
  const [settingsSearch, setSettingsSearch] = useState('')

  const personalMenuItems = [
    { key: 'profile', label: 'Profile', icon: User }
  ]

  const workspaceMenuItems = isOwnerAdmin ? [
    { key: 'general', label: 'General', icon: LayoutGrid },
    { key: 'uom', label: 'Unit of Measure (UOM)', icon: Scale },
    { key: 'members', label: 'Members & Teams', icon: Users },
    { key: 'billing', label: 'Billing', icon: DollarSign }
  ] : []

  const filteredPersonal = personalMenuItems.filter(item =>
    item.label.toLowerCase().includes(settingsSearch.toLowerCase().trim())
  )

  const filteredWorkspace = workspaceMenuItems.filter(item =>
    item.label.toLowerCase().includes(settingsSearch.toLowerCase().trim())
  )

  useEffect(() => {
    api.get('/auth/profile')
      .then(res => {
        if (res.data) {
          const fName = res.data.firstName || res.data.first_name || ''
          const lName = res.data.lastName || res.data.last_name || ''
          if (fName) setFirstName(fName)
          if (lName) setLastName(lName)
          if (res.data.email) setEmail(res.data.email)
          dispatch(updateUser({ firstName: fName, lastName: lName, email: res.data.email }))
          setWorkspaceForm(prev => ({
            ...prev,
            shopName: res.data.shopName || prev.shopName || '',
            phone: res.data.phone || prev.phone || '',
            gstin: res.data.gstin || prev.gstin || '',
            address: res.data.address || prev.address || ''
          }))
        }
      })
      .catch(() => { })
  }, [dispatch])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedImageTypes.includes(file.type)) {
        dispatch(addToast({ message: 'Invalid file type. Please upload a PNG, JPEG, GIF, or WEBP image.', type: 'error' }))
        return
      }
      const tempUrl = URL.createObjectURL(file)
      setAvatarUrl(tempUrl)
      localStorage.setItem('ws_avatar_url', tempUrl)

      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setAvatarUrl(reader.result)
          localStorage.setItem('ws_avatar_url', reader.result)
        }
      }
      reader.readAsDataURL(file)
      dispatch(addToast({ message: 'Workspace logo updated successfully!', type: 'success' }))
    }
  }

  const handleWorkspaceNameChange = (val) => {
    const updatedForm = { ...workspaceForm, shopName: val }
    setWorkspaceForm(updatedForm)

    // Auto-save locally & update sidebar header live!
    localStorage.setItem('ws_workspace_settings', JSON.stringify(updatedForm))
    sessionStorage.setItem('ws_active_workspace_name', val)
    localStorage.setItem('ws_workspace_name', val)
    dispatch(updateUser({ shopName: val }))
    window.dispatchEvent(new Event('workspace_updated'))

    // Debounced API call to backend
    if (window.wsNameDebounce) clearTimeout(window.wsNameDebounce)
    window.wsNameDebounce = setTimeout(() => {
      api.put('/auth/workspace', updatedForm).catch(() => { })
    }, 400)
  }

  const handleDeleteWorkspace = async () => {
    const wsName = workspaceForm.shopName || 'this workspace'
    if (window.confirm(`Are you sure you want to delete "${wsName}"? All data will be permanently removed.`)) {
      try {
        localStorage.removeItem('ws_workspace_settings')
        sessionStorage.removeItem('ws_active_workspace_name')
        sessionStorage.removeItem('ws_active_workspace_id')
        dispatch(addToast({ message: 'Workspace deleted successfully.', type: 'info' }))
        navigate('/dashboard')
      } catch {
        dispatch(addToast({ message: 'Failed to delete workspace.', type: 'error' }))
      }
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (newPassword || currentPassword) {
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

      try {
        await api.post('/auth/update-password', { currentPassword, newPassword })
        dispatch(addToast({ message: 'Password updated successfully!', type: 'success' }))
      } catch (err) {
        dispatch(addToast({ message: err.response?.data?.message || 'Failed to update password', type: 'error' }))
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }

    const updated = { firstName, lastName, email }
    localStorage.setItem('ws_profile_settings', JSON.stringify(updated))
    dispatch(updateUser({ firstName, lastName, email }))

    try {
      await api.put('/auth/profile', updated)
    } catch { }

    dispatch(addToast({ message: 'Profile details saved successfully!', type: 'success' }))
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#ffffff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>

      {/* Settings Top Header Bar (Matching Image 3) */}
      <div style={{
        height: 44,
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0
      }}>
        {/* Left header zone (aligned with left Settings sidebar) */}
        <div style={{
          width: 235,
          height: '100%',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#0f172a',
              padding: 0,
              fontFamily: 'inherit'
            }}
          >
            <ChevronLeft size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Settings</span>
          </button>
        </div>

        {/* Right header zone (aligned with content area - NO profile icon matching Image 3!) */}
        <div style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          boxSizing: 'border-box'
        }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
            {!isOwnerAdmin || activeSection === 'profile' ? 'Profile' :
              activeSection === 'general' ? 'General' :
                activeSection === 'uom' ? 'Unit of Measure (UOM)' :
                  activeSection === 'members' ? 'Members & Teams' :
                    activeSection === 'billing' ? 'Billing' : 'Settings'}
          </span>

          <button
            onClick={() => dispatch(addToast({ message: 'Help center opened', type: 'info' }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78rem', fontFamily: 'inherit' }}
          >
            <HelpCircle size={15} />
            <span>Help</span>
          </button>
        </div>
      </div>

      {/* Settings Inner Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#ffffff' }}>

        {/* Unified Left Settings Sidebar containing ALL Personal & Workspace Sections */}
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
                value={settingsSearch}
                onChange={e => setSettingsSearch(e.target.value)}
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
              {settingsSearch && (
                <button
                  type="button"
                  onClick={() => setSettingsSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Section: Personal */}
          {filteredPersonal.length > 0 && (
            <div style={{ marginBottom: 14 }}>
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

              {filteredPersonal.map(item => {
                const IconComponent = item.icon
                const isActive = activeSection === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => selectSection(item.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? '#f1f5f9' : 'transparent',
                      color: isActive ? '#0f172a' : '#344054',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      marginBottom: 1
                    }}
                  >
                    <IconComponent size={14} style={{ color: isActive ? '#0f172a' : '#64748b' }} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Section: WORKSPACE */}
          {filteredWorkspace.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '8px 8px 4px'
              }}>
                WORKSPACE
              </div>

              {filteredWorkspace.map(item => {
                const IconComponent = item.icon
                const isActive = activeSection === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => selectSection(item.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? '#f1f5f9' : 'transparent',
                      color: isActive ? '#0f172a' : '#344054',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      marginBottom: 1
                    }}
                  >
                    <IconComponent size={14} style={{ color: isActive ? '#0f172a' : '#64748b' }} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {filteredPersonal.length === 0 && filteredWorkspace.length === 0 && (
            <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
              No settings found
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: (activeSection === 'uom' || activeSection === 'members') ? 'stretch' : 'center',
          justifyContent: 'flex-start',
          padding: (activeSection === 'uom' || activeSection === 'members') ? '20px 24px' : '36px 24px 20px',
          overflowY: 'auto',
          background: '#ffffff'
        }}>


          {/* PROFILE SECTION */}
          {(activeSection === 'profile' || !VALID_SECTIONS.includes(activeSection)) && (
            <div style={{ width: '100%', maxWidth: 640 }}>

              {/* Header Title & Subtitle */}
              <div style={{ marginBottom: 12 }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  Profile
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                borderRadius: 10,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                color: '#475569',
                fontSize: '0.79rem'
              }}>
                <Info size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                <span>Changes to your profile will apply to all of your workspaces.</span>
              </div>

              {/* Profile Picture Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {getSanitizedImageUrl(avatarUrl) ? (
                  <img src={getSanitizedImageUrl(avatarUrl)} alt="Profile" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {(firstName || 'A')[0].toUpperCase()}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>Profile Picture</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>We only support PNGs, JPEGs and GIFs under 10MB</span>
                  <div style={{ marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => profileInputRef.current?.click()}
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 7,
                        padding: '4px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      <Camera size={13} />
                      Upload Image
                    </button>
                    <input ref={profileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </div>
                </div>
              </div>

              {/* Form Fields: First Name & Last Name */}
              <form onSubmit={handleSaveProfile}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Primary email address */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Primary email address</label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 36,
                    border: '1px solid #e2e8f0',
                    borderRadius: 7,
                    padding: '0 6px 0 12px',
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
                        fontSize: '0.84rem',
                        color: '#0f172a'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => dispatch(addToast({ message: 'Email edit requested', type: 'info' }))}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 5,
                        padding: '3px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 500,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Password Reset Section (Replacing Time Preferences) */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>
                    Password Reset
                  </h2>
                  <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 12px' }}>
                    Update your account password
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        style={{
                          width: '100%',
                          height: 36,
                          padding: '0 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 7,
                          fontSize: '0.84rem',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{
                          width: '100%',
                          height: 36,
                          padding: '0 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 7,
                          fontSize: '0.84rem',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={{
                          width: '100%',
                          height: 36,
                          padding: '0 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 7,
                          fontSize: '0.84rem',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 7,
                      padding: '7px 18px',
                      fontSize: '0.8rem',
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

          {/* GENERAL WORKSPACE SECTION */}
          {isOwnerAdmin && activeSection === 'general' && (
            <div style={{ width: '100%', maxWidth: 720 }}>

              {/* Header Title & Subtitle */}
              <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  General
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Change the settings for your current workspace.
                  <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }} onClick={e => e.preventDefault()}>
                    Learn more ↗
                  </a>
                </p>
              </div>

              {/* Workspace Logo Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                {getSanitizedImageUrl(avatarUrl) ? (
                  <img src={getSanitizedImageUrl(avatarUrl)} alt="Workspace Logo" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {(workspaceForm.shopName || 'W')[0].toUpperCase()}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>Workspace logo</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>We only support PNGs, JPEGs and GIFs under 10MB</span>
                  <div style={{ marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 7,
                        padding: '5px 14px',
                        fontSize: '0.76rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      <Camera size={13} />
                      Upload logo
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </div>
                </div>
              </div>

              {/* Fields: Name & Slug */}
              <form onSubmit={e => e.preventDefault()}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Name</label>
                    <input
                      type="text"
                      required
                      value={workspaceForm.shopName}
                      onChange={e => handleWorkspaceNameChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Slug</label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: 38,
                      border: '1px solid #e2e8f0',
                      borderRadius: 7,
                      padding: '0 10px',
                      background: '#f8fafc',
                      boxSizing: 'border-box'
                    }}>
                      <span style={{ flex: 1, fontSize: '0.84rem', color: '#0f172a', fontWeight: 500 }}>
                        {(workspaceForm.shopName || 'workspace').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = (workspaceForm.shopName || 'workspace').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                          navigator.clipboard.writeText(slug)
                          dispatch(addToast({ message: 'Slug copied to clipboard!', type: 'success' }))
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                        title="Copy slug"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Danger Zone Section */}
                <div>
                  <h2 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#0f172a', margin: '0 0 10px' }}>
                    Danger zone
                  </h2>

                  <div style={{
                    border: '1px solid #fee2e2',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                        Delete workspace
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        Once deleted, your workspace cannot be recovered
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteWorkspace}
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 7,
                        padding: '7px 16px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      <Trash2 size={14} />
                      Delete workspace
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* UOM SECTION */}
          {isOwnerAdmin && activeSection === 'uom' && (
            <UomManager />
          )}

          {/* MEMBERS & TEAMS SECTION */}
          {isOwnerAdmin && activeSection === 'members' && (
            <MembersManager />
          )}

          {/* BILLING SECTION */}
          {isOwnerAdmin && activeSection === 'billing' && (
            <div style={{ width: '100%', maxWidth: 720 }}>
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  Billing
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Manage currency, tax defaults, and invoice preferences for your workspace.
                </p>
              </div>

              <form onSubmit={handleSaveBillingPreferences}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      value={billingForm.currencySymbol}
                      onChange={e => setBillingForm({ ...billingForm, currencySymbol: e.target.value })}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                      Default GST Rate (%)
                    </label>
                    <input
                      type="text"
                      value={billingForm.defaultGstRate}
                      onChange={e => setBillingForm({ ...billingForm, defaultGstRate: e.target.value })}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                      Invoice Number Prefix
                    </label>
                    <input
                      type="text"
                      value={billingForm.invoicePrefix}
                      onChange={e => setBillingForm({ ...billingForm, invoicePrefix: e.target.value })}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                      Default Payment Terms
                    </label>
                    <input
                      type="text"
                      value={billingForm.paymentTerms}
                      onChange={e => setBillingForm({ ...billingForm, paymentTerms: e.target.value })}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                    Invoice Terms & Conditions Footer Note
                  </label>
                  <textarea
                    rows={3}
                    value={billingForm.footerNote}
                    onChange={e => setBillingForm({ ...billingForm, footerNote: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 7,
                      fontSize: '0.84rem',
                      color: '#0f172a',
                      outline: 'none',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.5
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 7,
                      padding: '7px 18px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    Save Preferences
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
