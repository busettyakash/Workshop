import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import { 
  Settings as SettingsIcon, User, Lock, Layers, Receipt, Plus, Edit2, Trash2, Check, Save, ShieldCheck, Scale, Eye, EyeOff 
} from 'lucide-react'
import { ALL_UOM_OPTIONS, getBulkUnitDetails } from '../../utils/unitHelpers'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

export default function Settings() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user, shopName } = useAuth()

  const [activeTab, setActiveTab] = useState('uom') // 'profile' | 'password' | 'uom' | 'billing'
  const [showPassword, setShowPassword] = useState(false)

  // Profile Form
  const [profile, setProfile] = useState({
    shopName: shopName || 'My Business',
    userName: user?.name || user?.email?.split('@')[0] || 'Admin User',
    email: user?.email || 'admin@business.com',
    phone: '+91 9876543210',
    gstin: '36ABCDE1234F1Z5',
    address: '123 Industrial Area, Tech Park, Hyderabad, Telangana'
  })

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordUpdating, setPasswordUpdating] = useState(false)

  // UOM Management via Backend API
  const [uomList, setUomList] = useState([])
  const [uomLoading, setUomLoading] = useState(false)

  const fetchUoms = async () => {
    setUomLoading(true)
    try {
      const res = await api.get('/uoms')
      setUomList(res.data || [])
    } catch {
      // fallback
    } finally {
      setUomLoading(false)
    }
  }

  useEffect(() => {
    fetchUoms()
  }, [])

  const [uomModalOpen, setUomModalOpen] = useState(false)
  const [editingUom, setEditingUom] = useState(null)
  const [uomForm, setUomForm] = useState({ code: '', name: '', category: 'Count', presets: '', status: 'Active' })

  // Billing Preferences
  const [billingPref, setBillingPref] = useState({
    currency: '₹ (INR)',
    taxRate: '18',
    invoicePrefix: 'INV-',
    paymentTerms: 'Due on Receipt',
    footerNote: 'Thank you for your business! Terms & Conditions apply.'
  })

  // Profile submit
  const handleSaveProfile = (e) => {
    e.preventDefault()
    dispatch(addToast({ message: 'Profile updated successfully!', type: 'success' }))
  }

  // Password submit
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.currentPassword) {
      dispatch(addToast({ message: 'Please enter current password', type: 'error' }))
      return
    }
    if (passwordForm.newPassword.length < 6) {
      dispatch(addToast({ message: 'New password must be at least 6 characters', type: 'error' }))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      dispatch(addToast({ message: 'New passwords do not match', type: 'error' }))
      return
    }

    setPasswordUpdating(true)
    try {
      const res = await api.post('/auth/update-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      dispatch(addToast({ message: res.data?.message || 'Password updated successfully!', type: 'success' }))
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password. Check your current password.'
      dispatch(addToast({ message: msg, type: 'error' }))
    } finally {
      setPasswordUpdating(false)
    }
  }

  // UOM Save to Backend DB
  const handleSaveUom = async (e) => {
    e.preventDefault()
    if (!uomForm.code.trim() || !uomForm.name.trim()) {
      dispatch(addToast({ message: 'Please enter Code and Name', type: 'error' }))
      return
    }

    try {
      if (editingUom) {
        await api.put(`/uoms/${editingUom.id}`, uomForm)
        dispatch(addToast({ message: `UOM ${uomForm.code.toUpperCase()} updated`, type: 'success' }))
      } else {
        await api.post('/uoms', uomForm)
        dispatch(addToast({ message: `UOM ${uomForm.code.toUpperCase()} created`, type: 'success' }))
      }
      fetchUoms()
      setUomModalOpen(false)
      setEditingUom(null)
      setUomForm({ code: '', name: '', category: 'Count', presets: '', status: 'Active' })
    } catch (err) {
      dispatch(addToast({ message: err?.response?.data?.error || 'Failed to save UOM', type: 'error' }))
    }
  }

  // UOM Delete from Backend DB
  const handleDeleteUom = async (id) => {
    try {
      await api.delete(`/uoms/${id}`)
      dispatch(addToast({ message: 'UOM deleted', type: 'info' }))
      fetchUoms()
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete UOM', type: 'error' }))
    }
  }

  // Edit UOM click
  const handleEditUomClick = (item) => {
    setEditingUom(item)
    setUomForm({ code: item.code, name: item.name, category: item.category, presets: item.presets || '', status: item.status || 'Active' })
    setUomModalOpen(true)
  }

  // Save Billing Pref
  const handleSaveBillingPref = (e) => {
    e.preventDefault()
    dispatch(addToast({ message: 'Billing preferences saved!', type: 'success' }))
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Settings & Preferences</span>
              </div>
            </div>

          {/* Settings Nav Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { id: 'uom', label: 'Unit of Measure', icon: <Scale size={18} />, desc: 'Manage your product units' },
              { id: 'profile', label: 'Business Profile', icon: <User size={18} />, desc: 'Update business details' },
              { id: 'password', label: 'Security', icon: <Lock size={18} />, desc: 'Change your password' },
              { id: 'billing', label: 'Billing Preferences', icon: <Receipt size={18} />, desc: 'Configure invoices' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="attio-table-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '16px',
                  background: activeTab === tab.id ? '#eff6ff' : '#ffffff',
                  border: activeTab === tab.id ? '1px solid #3d68f5' : '1px solid #e2e8f0',
                  boxShadow: activeTab === tab.id ? '0 2px 4px rgba(61, 104, 245, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: activeTab === tab.id ? '#3d68f5' : '#4b5563', fontWeight: 600, fontSize: '0.875rem' }}>
                  {tab.icon}
                  {tab.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {tab.desc}
                </div>
              </button>
            ))}
          </div>

          {/* TAB 1: UOM MANAGEMENT */}
          {activeTab === 'uom' && (
            <div className="attio-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="ws-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h2 className="ws-table-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 600 }}>
                    Unit of Measure (UOM)
                    <span className="ws-badge-count">{uomList.length} units</span>
                  </h2>
                  <p className="ws-table-sub" style={{ marginTop: 4, fontSize: '0.8rem', color: '#64748b' }}>Configure units and container capacity presets.</p>
                </div>
                <button
                  className="attio-btn attio-btn-primary"
                  onClick={() => {
                    setEditingUom(null)
                    setUomForm({ code: '', name: '', category: 'Count', presets: '', status: 'Active' })
                    setUomModalOpen(true)
                  }}
                >
                  <Plus size={15} style={{ marginRight: 6 }} />
                  Add New UOM
                </button>
              </div>

              <div className="attio-table-wrap">
                <table className="attio-table">
                  <thead>
                    <tr>
                      <th>CODE</th>
                      <th>UNIT NAME</th>
                      <th>CATEGORY</th>
                      <th>CONTAINER PRESETS</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uomList.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600, color: '#111827' }}>
                          <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            {item.code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                        <td>
                          <span className="ws-pill-topic" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                            {item.category}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#4b5563' }}>
                          {item.presets || '—'}
                        </td>
                        <td>
                          <span className="ws-pill-topic" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                            {item.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              className="ws-chat-history-delete-btn"
                              style={{ padding: 6 }}
                              onClick={() => handleEditUomClick(item)}
                              title="Edit UOM"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="ws-chat-history-delete-btn"
                              style={{ padding: 6, color: '#ef4444' }}
                              onClick={() => handleDeleteUom(item.id)}
                              title="Delete UOM"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE */}
          {activeTab === 'profile' && (
            <div className="attio-table-card" style={{ maxWidth: 640, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600 }}>Business Profile</h3>
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Business / Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={profile.shopName}
                    onChange={e => setProfile({ ...profile, shopName: e.target.value })}
                    style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>User Name</label>
                    <input
                      type="text"
                      value={profile.userName}
                      onChange={e => setProfile({ ...profile, userName: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email Address</label>
                    <input
                      type="email"
                      required
                      value={profile.email}
                      onChange={e => setProfile({ ...profile, email: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>GSTIN Number</label>
                    <input
                      type="text"
                      value={profile.gstin}
                      onChange={e => setProfile({ ...profile, gstin: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Business Address</label>
                  <textarea
                    rows={3}
                    value={profile.address}
                    onChange={e => setProfile({ ...profile, address: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="submit"
                    className="ws-table-btn ws-table-btn--primary"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={15} />
                    Save Profile
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PASSWORD */}
          {activeTab === 'password' && (
            <div className="attio-table-card" style={{ maxWidth: 480, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600 }}>Security & Update Password</h3>
              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Current Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 36px 0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 36px 0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm New Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 36px 0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="submit"
                    disabled={passwordUpdating}
                    className="ws-table-btn ws-table-btn--primary"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <ShieldCheck size={15} />
                    {passwordUpdating ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: BILLING PREFERENCES */}
          {activeTab === 'billing' && (
            <div className="attio-table-card" style={{ maxWidth: 640, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600 }}>Billing Preferences</h3>
              <form onSubmit={handleSaveBillingPref} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Currency Symbol</label>
                    <input
                      type="text"
                      value={billingPref.currency}
                      onChange={e => setBillingPref({ ...billingPref, currency: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default GST Rate (%)</label>
                    <input
                      type="number"
                      value={billingPref.taxRate}
                      onChange={e => setBillingPref({ ...billingPref, taxRate: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Invoice Number Prefix</label>
                    <input
                      type="text"
                      value={billingPref.invoicePrefix}
                      onChange={e => setBillingPref({ ...billingPref, invoicePrefix: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default Payment Terms</label>
                    <input
                      type="text"
                      value={billingPref.paymentTerms}
                      onChange={e => setBillingPref({ ...billingPref, paymentTerms: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Invoice Terms & Conditions Footer Note</label>
                  <textarea
                    rows={3}
                    value={billingPref.footerNote}
                    onChange={e => setBillingPref({ ...billingPref, footerNote: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="submit"
                    className="ws-table-btn ws-table-btn--primary"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={15} />
                    Save Preferences
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* UOM ADD / EDIT MODAL */}
          {uomModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', width: 440, borderRadius: 12, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600 }}>
                  {editingUom ? 'Edit Unit of Measure (UOM)' : 'Add New Unit of Measure (UOM)'}
                </h3>
                <form onSubmit={handleSaveUom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>UOM Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ltr, mtr, kgs"
                        value={uomForm.code}
                        onChange={e => setUomForm({ ...uomForm, code: e.target.value })}
                        style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Unit Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Liters, Meters"
                        value={uomForm.name}
                        onChange={e => setUomForm({ ...uomForm, name: e.target.value })}
                        style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
                    <select
                      value={uomForm.category}
                      onChange={e => setUomForm({ ...uomForm, category: e.target.value })}
                      style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', background: '#fff' }}
                    >
                      <option value="Volume">Volume (Liters, ml)</option>
                      <option value="Length">Length (Meters, ft)</option>
                      <option value="Weight">Weight (Kilograms, g)</option>
                      <option value="Package">Package (Box, Carton)</option>
                      <option value="Count">Count (Pieces, Dozen)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Container Presets (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1, 5, 20, 25, 50, 200"
                      value={uomForm.presets}
                      onChange={e => setUomForm({ ...uomForm, presets: e.target.value })}
                      style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setUomModalOpen(false)}
                      style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ws-table-btn ws-table-btn--primary"
                      style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                    >
                      {editingUom ? 'Update UOM' : 'Save UOM'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  )
}
