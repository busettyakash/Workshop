import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { selectSidebarOpen, addToast, setActiveNav } from '../../redux/slices/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import { 
  ArrowLeft, Search, User, Palette, Mail, PhoneCall, HardDrive, Share2, Bell, MessageSquare, Plug,
  Building2, Users, Radio, CreditCard, DollarSign, Code, Headphones, ArrowRightLeft, Grid, Info, Scale, Plus, Edit2, Trash2, Save, HelpCircle
} from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

export default function WorkspaceSettings() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user, shopName } = useAuth()

  useEffect(() => {
    dispatch(setActiveNav('Settings'))
  }, [dispatch])

  const [activeSection, setActiveSection] = useState('general') // 'general' | 'uom' | 'members' | 'billing'

  // Workspace Form
  const [workspaceForm, setWorkspaceForm] = useState({
    shopName: shopName || 'Akash Traders',
    phone: '+91 9876543210',
    gstin: '36ABCDE1234F1Z5',
    address: '123 Industrial Area, Tech Park, Hyderabad, Telangana'
  })

  // UOM state
  const [uomList, setUomList] = useState([])
  const [uomLoading, setUomLoading] = useState(false)
  const [uomModalOpen, setUomModalOpen] = useState(false)
  const [editingUom, setEditingUom] = useState(null)
  const [uomForm, setUomForm] = useState({ code: '', name: '', category: 'Count', presets: '', status: 'Active' })

  const fetchUoms = async () => {
    setUomLoading(true)
    try {
      const res = await api.get('/uoms')
      setUomList(res.data || [])
    } catch {
      /* silent fallback */
    } finally {
      setUomLoading(false)
    }
  }

  useEffect(() => {
    fetchUoms()
  }, [])

  const handleSaveWorkspace = (e) => {
    e.preventDefault()
    dispatch(addToast({ message: 'Workspace details saved!', type: 'success' }))
  }

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

  const handleDeleteUom = async (id) => {
    try {
      await api.delete(`/uoms/${id}`)
      dispatch(addToast({ message: 'UOM deleted', type: 'info' }))
      fetchUoms()
    } catch {
      dispatch(addToast({ message: 'Failed to delete UOM', type: 'error' }))
    }
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
            {activeSection === 'general' ? 'General' : activeSection === 'uom' ? 'Unit of Measure (UOM)' : activeSection === 'members' ? 'Members & Teams' : 'Billing'}
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

          {/* Personal Section Link */}
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
              onClick={() => navigate('/account-settings')}
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
              <User size={14} style={{ color: '#64748b' }} />
              <span>Profile</span>
            </button>
          </div>

          {/* Workspace Section */}
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
              onClick={() => setActiveSection('general')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'general' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'general' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'general' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 1
              }}
            >
              <Building2 size={14} style={{ color: activeSection === 'general' ? '#0f172a' : '#64748b' }} />
              <span>General</span>
            </button>

            <button
              onClick={() => setActiveSection('uom')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'uom' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'uom' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'uom' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 1
              }}
            >
              <Scale size={14} style={{ color: activeSection === 'uom' ? '#0f172a' : '#64748b' }} />
              <span>Unit of Measure (UOM)</span>
            </button>

            <button
              onClick={() => setActiveSection('members')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'members' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'members' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'members' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                marginBottom: 1
              }}
            >
              <Users size={14} style={{ color: activeSection === 'members' ? '#0f172a' : '#64748b' }} />
              <span>Members & Teams</span>
            </button>

            <button
              onClick={() => setActiveSection('billing')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: activeSection === 'billing' ? '#f1f5f9' : 'transparent',
                color: activeSection === 'billing' ? '#0f172a' : '#344054',
                fontWeight: activeSection === 'billing' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              <DollarSign size={14} style={{ color: activeSection === 'billing' ? '#0f172a' : '#64748b' }} />
              <span>Billing</span>
            </button>
          </div>
        </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
            {activeSection === 'general' && (
              <div style={{ maxWidth: 640 }}>
                <h1 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>General Workspace Settings</h1>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 28 }}>Manage workspace details, contact info, and tax registration</p>

                <form onSubmit={handleSaveWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Workspace / Shop Name *</label>
                    <input
                      type="text"
                      required
                      value={workspaceForm.shopName}
                      onChange={e => setWorkspaceForm({ ...workspaceForm, shopName: e.target.value })}
                      style={{ width: '100%', height: 40, padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Phone Number</label>
                      <input
                        type="text"
                        value={workspaceForm.phone}
                        onChange={e => setWorkspaceForm({ ...workspaceForm, phone: e.target.value })}
                        style={{ width: '100%', height: 40, padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>GSTIN Number</label>
                      <input
                        type="text"
                        value={workspaceForm.gstin}
                        onChange={e => setWorkspaceForm({ ...workspaceForm, gstin: e.target.value })}
                        style={{ width: '100%', height: 40, padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Workspace Address</label>
                    <textarea
                      rows={3}
                      value={workspaceForm.address}
                      onChange={e => setWorkspaceForm({ ...workspaceForm, address: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
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
                      Save Workspace Details
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeSection === 'uom' && (
              <div style={{ maxWidth: 800 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Unit of Measure (UOM)</h1>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>Configure units and container capacity presets.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingUom(null)
                      setUomForm({ code: '', name: '', category: 'Count', presets: '', status: 'Active' })
                      setUomModalOpen(true)
                    }}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={15} />
                    Add UOM
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>CODE</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>UNIT NAME</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>CATEGORY</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uomList.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{item.code}</td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>{item.name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.category}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button onClick={() => handleDeleteUom(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
