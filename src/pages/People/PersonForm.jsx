import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Info } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

const PERSONA_OPTIONS = ['Lead', 'Prospect', 'Customer', 'Partner', 'Vendor', 'Other']
const STATUS_OPTIONS  = ['active', 'inactive']

const S = {
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: '40px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputFocus: {
    borderColor: '#3d68f5',
    boxShadow: '0 0 0 3px rgba(61,104,245,0.1)',
  },
  inputError: {
    borderColor: '#dc2626',
    boxShadow: '0 0 0 3px rgba(220,38,38,0.08)',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.75rem',
    marginTop: '4px',
    display: 'block',
  },
  field: { marginBottom: '20px' },
}

export default function PersonForm() {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', persona: 'Lead', status: 'active', notes: ''
  })

  useEffect(() => {
    dispatch(setActiveNav('People'))
    if (id) fetchPerson()
  }, [id, dispatch])

  const fetchPerson = async () => {
    try {
      const res = await api.get(`/people/${id}`)
      const item = res.data?.data
      if (item) {
        setForm({
          name: item.name || '',
          email: item.email || '',
          phone: item.phone || '',
          persona: item.persona || 'Lead',
          status: item.status || 'active',
          notes: item.notes || ''
        })
      } else {
        dispatch(addToast({ message: 'Person not found', type: 'error' }))
        navigate('/people')
      }
    } catch {
      dispatch(addToast({ message: 'Failed to load person details', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.name.trim()) err.name = 'Full name is required'
    if (Object.keys(err).length) { setErrors(err); return }

    setSaving(true)
    try {
      if (id) {
        await api.put(`/people/${id}`, form)
        dispatch(addToast({ message: 'Person updated successfully!', type: 'success' }))
      } else {
        await api.post('/people', form)
        dispatch(addToast({ message: 'Person added successfully!', type: 'success' }))
      }
      navigate('/people')
    } catch {
      dispatch(addToast({ message: 'Failed to save person details', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <button
              onClick={() => navigate('/people')}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                {id ? 'Edit Person' : 'Add Person'}
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '1px 0 0' }}>
                People / {id ? 'Edit' : 'Add'}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={28} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

              {/* Left Column: Input Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Basic Info & Contact */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Contact Information</p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={S.field}>
                      <label style={S.label}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Akash Busetty" style={inp('name')} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
                      {errors.name && <span style={S.error}>{errors.name}</span>}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={S.label}>Email Address</label>
                        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@example.com" style={inp('email')} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
                      </div>
                      <div>
                        <label style={S.label}>Phone Number</label>
                        <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" style={inp('phone')} onFocus={() => setFocus('phone')} onBlur={() => setFocus(null)} />
                      </div>
                    </div>

                    <div>
                      <label style={S.label}>Notes</label>
                      <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Add optional details or history..." rows={5} style={{ ...inp('notes'), height: 'auto', padding: '10px 12px', resize: 'vertical' }} onFocus={() => setFocus('notes')} onBlur={() => setFocus(null)} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Status / Persona & Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Attributes (Persona & Status) */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', margin: 0 }}>Attributes</p>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={S.label}>Persona</label>
                      <select name="persona" value={form.persona} onChange={handleChange} style={{ ...S.input, cursor: 'pointer' }}>
                        {PERSONA_OPTIONS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Status</label>
                      <select name="status" value={form.status} onChange={handleChange} style={{ ...S.input, cursor: 'pointer' }}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Information Card */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e40af', margin: '0 0 4px' }}>People Directory</p>
                      <p style={{ fontSize: '0.7875rem', color: '#3b82f6', margin: 0, lineHeight: 1.5 }}>
                        People records saved here are used to manage contacts, assign ownership in deals, and link invoices in billing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ width: '100%', height: 40, border: 'none', borderRadius: '8px', background: saving ? '#9ca3af' : '#111827', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {saving && <Loader2 size={14} className="ws-chat-loader-spin" />}
                    {saving ? 'Saving...' : id ? 'Update Person' : 'Save Person'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/people')}
                    style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    Cancel
                  </button>
                </div>

              </div>

            </form>
          )}

        </main>
      </div>
    </div>
  )
}
