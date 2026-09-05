import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Shield,
  UserCheck,
  Check,
  X,
  Trash2,
  Lock,
  Layers,
  FileText,
  CreditCard,
  Download,
  TrendingUp,
  Mail,
  GitBranch,
  User,
  StickyNote,
  LayoutDashboard,
  Loader2,
  UserPlus,
  Plus,
  Edit2,
  ArrowLeft,
  CheckCircle2,
  Save,
  Sliders,
  ChevronRight,
  ChevronDown,
  Info,
  MessageSquare,
  BarChart3,
  Receipt,
  ShoppingCart,
  Percent
} from 'lucide-react'
import { useAppDispatch } from '../../redux/hooks'
import { addToast } from '../../redux/slices/uiSlice'
import { authApi } from '../../services/authApi'
import { getPillStyle } from '../../utils/tableHelpers'
import ConfirmModal from '../ui/ConfirmModal'
import '../../pages/Dashboard/Dashboard.css'
import '../../pages/Products/Products.css'

// ── Helper: Permission Badges for Member Table Row ──────────────────────────
function MemberPermissionBadges({ member, isAdmin }) {
  let perms = member.permissions || {}
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms) } catch { perms = {} }
  }
  const accessibleCount = MODULE_DEFINITIONS.filter(m => perms[m.id]?.read === true).length
  const editCount = MODULE_DEFINITIONS.filter(m => perms[m.id]?.edit === true).length
  const deleteCount = MODULE_DEFINITIONS.filter(m => perms[m.id]?.delete === true).length

  if (isAdmin) {
    return (
      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
        Full Access ({MODULE_DEFINITIONS.length}/{MODULE_DEFINITIONS.length})
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
        Read ({accessibleCount}/{MODULE_DEFINITIONS.length})
      </span>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
        Edit ({editCount})
      </span>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
        Del ({deleteCount})
      </span>
    </div>
  )
}

// ── Helper: Full-Page Permissions / Invite Editor View ───────────────────────
function PermissionsEditorView({
  selectedMember,
  isInvitingNewMember,
  inviteEmailInput,
  setInviteEmailInput,
  activeRole,
  setActiveRole,
  activePermissions,
  saving,
  onBack,
  onSave,
  onSendInvite,
  onGrantFull,
  onGrantReadOnly,
  onClearAll,
  onTogglePermission,
  onToggleRowAll
}) {
  const isMemberOwner = selectedMember?.isOwner || (selectedMember?.role || '').toLowerCase() === 'owner'
  const readCount = MODULE_DEFINITIONS.filter(m => activePermissions[m.id]?.read).length
  const editCount = MODULE_DEFINITIONS.filter(m => activePermissions[m.id]?.edit).length
  const deleteCount = MODULE_DEFINITIONS.filter(m => activePermissions[m.id]?.delete).length

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 40 }}>
      {/* ── Top Navigation & Back Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button type="button" onClick={onBack} className="attio-btn"
          style={{ padding: '6px 12px', fontSize: '0.80rem', fontWeight: 600, gap: 6, color: '#334155' }}>
          <ArrowLeft size={14} /> Back to Members & Teams
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onBack} className="attio-btn"
            style={{ padding: '6px 14px', fontSize: '0.80rem' }}>
            Cancel
          </button>
          {isInvitingNewMember ? (
            <button type="button" onClick={onSendInvite} disabled={saving}
              className="attio-btn attio-btn-primary"
              style={{ padding: '6px 18px', fontSize: '0.80rem', fontWeight: 600, background: '#2563eb' }}>
              {saving ? (<><Loader2 size={13} className="ws-chat-loader-spin" /><span>Sending Invite...</span></>) : <span>Send Invite</span>}
            </button>
          ) : (
            <button type="button" onClick={onSave} disabled={saving}
              className="attio-btn attio-btn-primary"
              style={{ padding: '6px 18px', fontSize: '0.80rem', fontWeight: 600 }}>
              {saving && <Loader2 size={13} className="ws-chat-loader-spin" />}
              <span>Save Permissions</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Member Profile Card & Role Presets ── */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Member Info / Input */}
          {isInvitingNewMember ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: '280px', maxWidth: '420px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                Work Email Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={15} style={{ position: 'absolute', left: 10, color: '#64748b' }} />
                <input
                  type="email"
                  placeholder="e.g. colleague@company.com"
                  value={inviteEmailInput}
                  onChange={e => setInviteEmailInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') onSendInvite(e) }}
                  style={{ width: '100%', height: 36, paddingLeft: 34, paddingRight: 12, borderRadius: 8, border: '1.5px solid #2563eb', fontSize: '0.86rem', fontWeight: 500, color: '#0f172a', outline: 'none', boxShadow: '0 0 0 3px rgba(37,99,235,0.1)' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 21, background: activeRole === 'Admin' ? '#eff6ff' : '#f1f5f9', color: activeRole === 'Admin' ? '#2563eb' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0, border: activeRole === 'Admin' ? '1.5px solid #bfdbfe' : '1.5px solid #e2e8f0' }}>
                {(selectedMember.member_email || 'M')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>{selectedMember.member_email}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: activeRole === 'Admin' ? '#eff6ff' : '#f1f5f9', color: activeRole === 'Admin' ? '#2563eb' : '#475569', border: activeRole === 'Admin' ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
                    {activeRole}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>Configure what this member can view in the left sidebar, create/edit, or delete across all workspace modules.</div>
              </div>
            </div>
          )}

          {/* Role Selector & Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Role:</span>
              {isMemberOwner ? (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: 6 }}>Admin (Full Access)</span>
              ) : (
                <select value={activeRole}
                  onChange={e => {
                    const newRole = e.target.value
                    setActiveRole(newRole)
                    if (newRole === 'Admin') onGrantFull()
                  }}
                  style={{ height: 32, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.80rem', fontWeight: 600, color: '#0f172a', background: '#ffffff', outline: 'none', cursor: 'pointer' }}>
                  <option value="Member">Member (Granular Access)</option>
                  <option value="Admin">Admin (Full Access)</option>
                </select>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={onGrantFull} className="attio-btn"
                style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, color: '#2563eb', borderColor: '#bfdbfe' }}>Grant Full Access</button>
              <button type="button" onClick={onGrantReadOnly} className="attio-btn"
                style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Read-Only</button>
              <button type="button" onClick={onClearAll} className="attio-btn"
                style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, color: '#dc2626' }}>Clear All</button>
            </div>
          </div>
        </div>

        {/* Active stats pills summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Active Permissions:</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>Read ({readCount}/{MODULE_DEFINITIONS.length})</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>Edit ({editCount}/{MODULE_DEFINITIONS.length})</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>Delete ({deleteCount}/{MODULE_DEFINITIONS.length})</span>
        </div>
      </div>

      {/* ── Full-Width Module Permissions Matrix Table ── */}
      <div className="attio-table-card" style={{ marginTop: 0 }}>
        <div className="attio-table-wrap">
          <table className="attio-table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>SIDEBAR MODULE & CAPABILITY</th>
                <th style={{ width: '15%', textAlign: 'center' }}>READ / VIEW MENU</th>
                <th style={{ width: '15%', textAlign: 'center' }}>EDIT / CREATE</th>
                <th style={{ width: '15%', textAlign: 'center' }}>DELETE</th>
                <th style={{ width: '13%', textAlign: 'right' }}>ROW ACCESS</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_DEFINITIONS.map(m => {
                const Icon = m.icon
                const p = activePermissions[m.id] || { read: false, edit: false, delete: false }
                const isAllChecked = p.read && p.edit && p.delete
                return (
                  <tr key={m.id} style={{ background: p.read ? '#ffffff' : '#fafafa', transition: 'background 0.1s' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: p.read ? '#eff6ff' : '#f1f5f9', color: p.read ? '#2563eb' : '#94a3b8', border: p.read ? '1px solid #dbeafe' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: p.read ? '#0f172a' : '#64748b', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{m.label}</span>
                            {p.read && <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Visible in Menu</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2, lineHeight: 1.35 }}>{m.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}>
                        <input type="checkbox" checked={!!p.read} onChange={() => onTogglePermission(m.id, 'read')} className="attio-chk" style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }} />
                      </label>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}>
                        <input type="checkbox" checked={!!p.edit} onChange={() => onTogglePermission(m.id, 'edit')} className="attio-chk" style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }} />
                      </label>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}>
                        <input type="checkbox" checked={!!p.delete} onChange={() => onTogglePermission(m.id, 'delete')} className="attio-chk" style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }} />
                      </label>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => onToggleRowAll(m.id)} className="attio-btn"
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, color: isAllChecked ? '#dc2626' : '#2563eb', borderColor: isAllChecked ? '#fecaca' : '#bfdbfe', background: isAllChecked ? '#fef2f2' : '#eff6ff' }}>
                        {isAllChecked ? 'Clear All' : 'Select All'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const MODULE_DEFINITIONS = [
  // ── Main Section ──
  { id: 'dashboard', label: 'Dashboard / Home', icon: LayoutDashboard, desc: 'Overview metrics, live analytics, recent activity logs, and widgets' },
  { id: 'notes', label: 'Notes', icon: StickyNote, desc: 'Workspace scratchpad notes, memos, and internal team documentation' },
  { id: 'emails', label: 'Emails & Inbox', icon: Mail, desc: 'Direct email communications, multi-contact invoice dispatches, and client mail log' },
  { id: 'reports', label: 'Reports', icon: BarChart3, desc: 'Financial reports, revenue analytics, and performance summaries' },
  { id: 'workflows', label: 'Automations & Workflows', icon: GitBranch, desc: 'Visual drag-and-drop workflow canvas, condition nodes, and automation triggers' },

  // ── Records Section ──
  { id: 'products', label: 'Products & Inventory', icon: Layers, desc: 'Product catalog, unit pricing, barcode management, and stock updates' },
  { id: 'people', label: 'People & Contacts', icon: User, desc: 'Customer and supplier directory, contact cards, and outreach profiles' },
  { id: 'price_history', label: 'Product / Price History', icon: TrendingUp, desc: 'Historical price tracking, date-range analytics, and rate margin changes' },
  { id: 'quotes', label: 'Quotations', icon: FileText, desc: 'Draft, issue, customize, and convert official customer quotations' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, desc: 'Purchase orders, sales delivery challans, and customer fulfillment records' },
  { id: 'import_stock', label: 'Import Stock', icon: Download, desc: 'Bulk inventory CSV imports, batch logs, and supplier payment ledger' },
  { id: 'profit_margin', label: 'Profit Margin', icon: Percent, desc: 'Procurement vs retail sales margins, per-unit earnings, and stock potential profit' },

  // ── Invoices & Finance Section ──
  { id: 'billing', label: 'Billing', icon: CreditCard, desc: 'Official GST tax invoices, invoice generator, and payment ledger' },
  { id: 'paid', label: 'Paid Invoices', icon: CheckCircle2, desc: 'Completed invoice payments, settlement receipts, and paid records' },
  { id: 'unpaid', label: 'Unpaid Invoices', icon: Receipt, desc: 'Outstanding bills, overdue customer receivables, and payment reminders' },

  // ── Chats Section ──
  { id: 'chats', label: 'Chats & AI Assistant', icon: MessageSquare, desc: 'Team communication threads, AI assistant chat sessions, and conversation history' },
]

export default function MembersManager() {
  const dispatch = useAppDispatch()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All')
  
  // Full-page permissions / invite view state
  const [selectedMember, setSelectedMember] = useState(null)
  const [isInvitingNewMember, setIsInvitingNewMember] = useState(false)
  const [inviteEmailInput, setInviteEmailInput] = useState('')
  const [activeRole, setActiveRole] = useState('Member')
  const [activePermissions, setActivePermissions] = useState({})
  const [saving, setSaving] = useState(false)

  // Delete modal state
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, email: '' })

  const loadMembers = async () => {
    setLoading(true)
    try {
      const data = await authApi.getMembers()
      setMembers(data || [])
    } catch (err) {
      console.error('[MEMBERS LOAD ERROR]', err)
      dispatch(addToast({ message: 'Failed to load team members', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
    const handleEvent = () => handleOpenInviteFullPage()
    window.addEventListener('ws-open-invite', handleEvent)
    const params = new URLSearchParams(window.location.search)
    if (params.get('invite') === 'true') {
      handleOpenInviteFullPage()
    }
    return () => window.removeEventListener('ws-open-invite', handleEvent)
  }, [])

  const handleOpenInviteFullPage = () => {
    setSelectedMember(null)
    setIsInvitingNewMember(true)
    setInviteEmailInput('')
    setActiveRole('Member')
    const initial = {}
    MODULE_DEFINITIONS.forEach(m => {
      initial[m.id] = { read: m.id !== 'profit_margin', edit: false, delete: false }
    })
    setActivePermissions(initial)
  }

  const handleOpenPermissions = (member) => {
    setIsInvitingNewMember(false)
    const isMemberAdmin = member.isOwner || (member.role || '').toLowerCase() === 'admin' || (member.role || '').toLowerCase() === 'owner'
    const roleToSet = isMemberAdmin ? 'Admin' : (member.role || 'Member')
    
    setSelectedMember(member)
    setActiveRole(roleToSet)
    
    // Normalize permissions object with all default modules
    let current = member.permissions || {}
    if (typeof current === 'string') {
      try { current = JSON.parse(current) } catch { current = {} }
    }
    const full = {}
    MODULE_DEFINITIONS.forEach(m => {
      full[m.id] = {
        read: isMemberAdmin ? true : (current[m.id] !== undefined ? current[m.id]?.read === true : m.id !== 'profit_margin'),
        edit: isMemberAdmin ? true : (current[m.id]?.edit === true),
        delete: isMemberAdmin ? true : (current[m.id]?.delete === true)
      }
    })
    setActivePermissions(full)
  }

  const handleTogglePermission = (moduleId, actionType) => {
    setActivePermissions(prev => {
      const mod = prev[moduleId] || { read: false, edit: false, delete: false }
      const nextVal = !mod[actionType]
      
      const updated = {
        ...mod,
        [actionType]: nextVal
      }

      // If user enables edit or delete, auto-enable read
      if ((actionType === 'edit' || actionType === 'delete') && nextVal) {
        updated.read = true
      }
      // If user disables read, auto-disable edit and delete
      if (actionType === 'read' && !nextVal) {
        updated.edit = false
        updated.delete = false
      }

      return {
        ...prev,
        [moduleId]: updated
      }
    })
  }

  const handleToggleRowAll = (moduleId) => {
    setActivePermissions(prev => {
      const mod = prev[moduleId] || { read: false, edit: false, delete: false }
      const isAllOn = mod.read && mod.edit && mod.delete
      return {
        ...prev,
        [moduleId]: {
          read: !isAllOn,
          edit: !isAllOn,
          delete: !isAllOn
        }
      }
    })
  }

  const handleGrantFullAccess = () => {
    const full = {}
    MODULE_DEFINITIONS.forEach(m => {
      full[m.id] = { read: true, edit: true, delete: true }
    })
    setActivePermissions(full)
  }

  const handleGrantReadOnly = () => {
    const ro = {}
    MODULE_DEFINITIONS.forEach(m => {
      ro[m.id] = { read: true, edit: false, delete: false }
    })
    setActivePermissions(ro)
  }

  const handleClearAll = () => {
    const empty = {}
    MODULE_DEFINITIONS.forEach(m => {
      empty[m.id] = { read: false, edit: false, delete: false }
    })
    setActivePermissions(empty)
  }

  const handleSavePermissions = async () => {
    if (!selectedMember) return
    setSaving(true)
    try {
      await authApi.updateMemberPermissions(selectedMember.id, {
        role: activeRole,
        permissions: activePermissions
      })
      dispatch(addToast({ message: `Permissions saved for ${selectedMember.member_email}`, type: 'success' }))
      
      // Broadcast live sync signal across all open tabs and locally
      try {
        localStorage.setItem('ws_permissions_sync_signal', Date.now().toString())
        window.dispatchEvent(new CustomEvent('ws_permissions_updated', {
          detail: { role: activeRole, perms: activePermissions, memberEmail: selectedMember.member_email }
        }))
      } catch {}
      
      // Update local members list
      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, role: activeRole, permissions: activePermissions } : m))
      setSelectedMember(null)
      setIsInvitingNewMember(false)
    } catch (err) {
      console.error('[SAVE PERMISSIONS ERROR]', err)
      dispatch(addToast({ message: 'Failed to update member permissions', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const handleSendInviteFullPage = async (e) => {
    if (e) e.preventDefault()
    const email = inviteEmailInput.trim()
    if (!email) {
      dispatch(addToast({ message: 'Please enter a valid work email address', type: 'error' }))
      return
    }
    setSaving(true)
    try {
      await authApi.invite({
        email,
        role: activeRole,
        permissions: activeRole === 'Admin' ? null : activePermissions
      })
      dispatch(addToast({ message: `Invitation sent to ${email}`, type: 'success' }))
      setIsInvitingNewMember(false)
      setInviteEmailInput('')
      loadMembers()
    } catch (err) {
      console.error('[INVITE ERROR]', err)
      dispatch(addToast({ message: err.response?.data?.message || 'Failed to send invite', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    const { id, email } = confirmDelete
    const target = id || email
    if (!target) return
    try {
      await authApi.deleteMember(target)
      dispatch(addToast({ message: `Member ${email || ''} removed from workspace`, type: 'success' }))
      setMembers(prev => prev.filter(m => m.id !== id && m.member_email !== email))
      loadMembers()
    } catch (err) {
      console.error('[DELETE MEMBER ERROR]', err)
      dispatch(addToast({ message: 'Failed to remove member', type: 'error' }))
    } finally {
      setConfirmDelete({ isOpen: false, id: null, email: '' })
    }
  }

  // Filtered List & Counts
  const roles = ['All', 'Admin', 'Member']
  const filteredMembers = members.filter(m => {
    const matchSearch = 
      (m.member_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.role || '').toLowerCase().includes(search.toLowerCase())
    const matchRole = selectedRoleFilter === 'All' || (m.role || 'Member') === selectedRoleFilter
    return matchSearch && matchRole
  })

  const countByRole = (role) => {
    if (role === 'All') return members.length
    return members.filter(m => (m.role || 'Member') === role).length
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL PAGE VIEW: GRANULAR MENU PERMISSIONS & INVITE FULL-PAGE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedMember || isInvitingNewMember) {
    const backHandler = () => {
      setSelectedMember(null)
      setIsInvitingNewMember(false)
    }
    return (
      <PermissionsEditorView
        selectedMember={selectedMember}
        isInvitingNewMember={isInvitingNewMember}
        inviteEmailInput={inviteEmailInput}
        setInviteEmailInput={setInviteEmailInput}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        activePermissions={activePermissions}
        saving={saving}
        onBack={backHandler}
        onSave={handleSavePermissions}
        onSendInvite={handleSendInviteFullPage}
        onGrantFull={handleGrantFullAccess}
        onGrantReadOnly={handleGrantReadOnly}
        onClearAll={handleClearAll}
        onTogglePermission={handleTogglePermission}
        onToggleRowAll={handleToggleRowAll}
      />
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN VIEW: MEMBERS & TEAMS TABLE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Unified Page Header ── */}
      <div className="ws-unified-page-header" style={{ marginBottom: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div className="ws-unified-header-left">
          <span className="ws-unified-header-title">Members &amp; Teams</span>
          <span className="ws-unified-header-badge">{members.length} members</span>
        </div>

        <div className="ws-unified-header-actions">
          {/* Search Box */}
          <div className="attio-search-box">
            <Search size={14} className="attio-search-icon" />
            <input
              type="text"
              className="attio-input-search"
              placeholder="Search members by email or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {roles.map(r => {
              const count = countByRole(r)
              const isSelected = selectedRoleFilter === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRoleFilter(r)}
                  className="attio-btn"
                  style={{
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#2563eb' : '#475569',
                    borderColor: isSelected ? '#bfdbfe' : '#e2e8f0',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    gap: 5
                  }}
                >
                  {r}
                  <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: 10, background: isSelected ? '#dbeafe' : '#f1f5f9', color: isSelected ? '#1d4ed8' : '#64748b', fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Invite Member button */}
          <button type="button" onClick={handleOpenInviteFullPage} className="attio-btn attio-btn-primary">
            <Plus size={14} /> Invite Member
          </button>
        </div>
      </div>

      {/* ── Members Table ── */}
      <div className="attio-table-card" style={{ marginTop: 0 }}>
        <div className="attio-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
              <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
              <Users size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>No team members found</div>
              <div style={{ fontSize: '0.80rem', color: '#64748b', marginTop: 4 }}>
                {search ? `No members matched "${search}"` : 'Get started by inviting your first team member.'}
              </div>
              <button type="button" onClick={handleOpenInviteFullPage} className="attio-btn attio-btn-primary" style={{ marginTop: 14 }}>
                <Plus size={13} /> Invite Member
              </button>
            </div>
          ) : (
            <table className="attio-table">
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'left', paddingLeft: 4 }}>
                    <input type="checkbox" className="attio-chk" readOnly />
                  </th>
                  <th>MEMBER / EMAIL</th>
                  <th>ROLE</th>
                  <th>MENU PERMISSIONS</th>
                  <th>JOINED DATE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(member => {
                  const isAdmin = member.isOwner || (member.role || '').toLowerCase() === 'admin' || (member.role || '').toLowerCase() === 'owner'
                  const pillStyle = getPillStyle('active')

                  return (
                    <tr key={member.id}>
                      <td style={{ textAlign: 'left', paddingLeft: 4 }}>
                        <input type="checkbox" className="attio-chk" readOnly />
                      </td>

                      {/* Member Avatar & Email */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 13, background: isAdmin ? '#eff6ff' : '#f1f5f9', color: isAdmin ? '#2563eb' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.74rem', flexShrink: 0 }}>
                            {(member.member_email || 'M')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>{member.member_email}</span>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: isAdmin ? '#eff6ff' : '#f1f5f9', color: isAdmin ? '#2563eb' : '#475569', border: isAdmin ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
                          {isAdmin ? 'Admin' : (member.role || 'Member')}
                        </span>
                      </td>

                      {/* Menu Permissions Badges */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <MemberPermissionBadges member={member} isAdmin={isAdmin} />
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                        {new Date(member.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Status */}
                      <td>
                        <span style={{ ...pillStyle, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" onClick={() => handleOpenPermissions(member)} className="attio-btn" style={{ padding: '3px 9px', fontSize: '0.74rem', fontWeight: 600 }}>
                            Permissions
                          </button>
                          {!member.isOwner && (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ isOpen: true, id: member.id, email: member.member_email })}
                              style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px 6px', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
                              title="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${confirmDelete.email} from this workspace? They will lose access to all modules.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, email: '' })}
      />
    </div>
  )
}
