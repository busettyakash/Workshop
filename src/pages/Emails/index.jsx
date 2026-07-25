import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { useLocation } from 'react-router-dom'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { Mail, Send, Trash2, Plus, Search, Paperclip, Loader2, X, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import '../Dashboard/Dashboard.css'

function getInitials(name = '') {
  return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?'
}

const AVATAR_COLORS = ['#3d68f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
function avatarColor(name = '') {
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString('en-IN', { weekday: 'short' })
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function Emails() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user } = useAuth()
  const location = useLocation()

  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [directionTab, setDirectionTab] = useState('inbox') // 'inbox' | 'sent'

  // Compose State
  const [composing, setComposing] = useState(() => new URLSearchParams(location.search).get('compose') === 'true')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachName, setAttachName] = useState(null)
  const [attachData, setAttachData] = useState(null)
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Reply State
  const [replyText, setReplyText] = useState('')

  const fetchEmails = useCallback(async (q = '', dir = 'inbox', options = {}) => {
    if (!options.silent) setLoading(true)
    try {
      const params = new URLSearchParams({ direction: dir })
      if (q) params.set('search', q)
      const res = await api.get(`/emails?${params}`)
      const data = res.data?.data || []
      setEmails(data)
      setSelected(current => current ? (data.find(e => e.id === current.id) || null) : current)
    } catch {
      if (!options.silent) {
        dispatch(addToast({ message: 'Failed to load emails', type: 'error' }))
      }
    } finally {
      if (!options.silent) setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    dispatch(setActiveNav('Emails'))
  }, [dispatch])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchEmails(search, directionTab), 300)
    return () => clearTimeout(t)
  }, [directionTab, fetchEmails, search])

  // Removed auto-sync polling. Sync only runs manually on button click.

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/emails/sync')
      const count = res.data?.synced || 0
      dispatch(addToast({ message: count > 0 ? `Synced ${count} new email(s)` : 'Inbox updated', type: 'success' }))
      await fetchEmails(search, 'inbox')
      setDirectionTab('inbox')
    } catch {
      await fetchEmails(search, 'inbox')
      dispatch(addToast({ message: 'Inbox refreshed', type: 'success' }))
    } finally {
      setSyncing(false)
    }
  }

  // Generate template message based on subject
  const handleSubjectBlur = () => {
    if (body.trim() !== '') return // Do not overwrite user input
    const sub = subject.toLowerCase()
    let template = ''

    if (sub.includes('invoice') || sub.includes('billing') || sub.includes('payment')) {
      template = `Dear Client,\n\nPlease find attached the invoice details for your recent order. The total amount due and payment options are specified in the document.\n\nPlease let us know if you have any questions or need further assistance.\n\nRegards,\nWorkshop Team`
    } else if (sub.includes('meeting') || sub.includes('schedule') || sub.includes('call')) {
      template = `Hi,\n\nI would like to schedule a quick meeting to discuss our upcoming projects, milestones, and timelines. Please let me know your availability for this week.\n\nLooking forward to speaking with you.\n\nRegards,\nWorkshop Team`
    } else if (sub.includes('product') || sub.includes('catalog') || sub.includes('price')) {
      template = `Hi,\n\nPlease find the product catalog and price list attached for your review. We have exciting updates to our inventory this quarter.\n\nLet us know if you'd like to place an order or receive samples.\n\nRegards,\nWorkshop Team`
    } else {
      template = `Hi,\n\nI hope this email finds you well.\n\n[Write your message here...]\n\nRegards,\nWorkshop Team`
    }

    setBody(template)
  }

  const handleSelect = async (email) => {
    setSelected(email)
    setComposing(false)
    setReplyText('')
    // Mark as read if unread
    if (!email.is_read) {
      try {
        await api.patch(`/emails/${email.id}/read`)
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e))
      } catch { /* silent */ }
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setAttachName(file.name)
      setAttachData(reader.result)
      dispatch(addToast({ message: `Attached: ${file.name}`, type: 'success' }))
    }
    reader.readAsDataURL(file)
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/emails/${id}`)
      setEmails(prev => prev.filter(e => e.id !== id))
      setSelected(null)
      dispatch(addToast({ message: 'Email deleted', type: 'info' }))
    } catch {
      dispatch(addToast({ message: 'Failed to delete', type: 'error' }))
    }
  }

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      dispatch(addToast({ message: 'Please fill in To and Subject', type: 'error' }))
      return
    }
    setSending(true)
    try {
      // Ensure the signature is included in the body
      let finalBody = body
      if (!finalBody.includes('Workshop Team')) {
        finalBody = `${finalBody}\n\nRegards,\nWorkshop Team`
      }

      await api.post('/emails', {
        from_name: 'Me',
        from_email: to.trim(),
        subject: subject.trim(),
        body: finalBody,
        preview: finalBody.slice(0, 120),
        direction: 'sent',
        attachment_name: attachName,
        attachment_data: attachData
      })

      setComposing(false)
      setTo('')
      setSubject('')
      setBody('')
      setAttachName(null)
      setAttachData(null)
      dispatch(addToast({ message: 'Email sent successfully!', type: 'success' }))
      // Refresh list if we are on 'sent' tab
      if (directionTab === 'sent') {
        fetchEmails(search, 'sent')
      }
    } catch {
      dispatch(addToast({ message: 'Failed to send email', type: 'error' }))
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return
    try {
      const recipientEmail = selected.from_email
      const replySubject = selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`
      
      await api.post('/emails', {
        from_name: user?.shopName || user?.email || 'Workshop Team',
        from_email: recipientEmail,
        subject: replySubject,
        body: replyText,
        direction: 'sent'
      })
      
      dispatch(addToast({ message: 'Reply sent!', type: 'success' }))
      setReplyText('')
      fetchEmails(search, directionTab)
    } catch {
      dispatch(addToast({ message: 'Failed to send reply', type: 'error' }))
    }
  }

  const unreadCount = emails.filter(e => !e.is_read).length

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body ws-dash-body-split" style={{ padding: 0, display: 'flex', overflow: 'hidden', flex: 1, minHeight: 0 }}>

          {/* ── Left panel: email list ── */}
          <div style={{
            width: 320, flexShrink: 0,
            borderRight: '1px solid #e5e7eb',
            display: 'flex', flexDirection: 'column',
            background: '#fff', height: '100%', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '10px 14px 10px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', margin: 0, paddingLeft: 14 }}>Mail</h1>
                  {directionTab === 'inbox' && unreadCount > 0 && (
                    <span style={{ background: '#3d68f5', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{unreadCount}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    title="Sync Gmail inbox"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', height: 26, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.75rem', fontWeight: 500, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1 }}
                  >
                    <RefreshCw size={13} className={syncing ? 'ws-chat-loader-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync'}
                  </button>
                  <button
                    onClick={() => { setComposing(true); setSelected(null); }}
                    className="attio-btn attio-btn-primary"
                    style={{ height: 26, fontSize: '0.75rem', padding: '2px 8px', gap: 4 }}
                  >
                    <Plus size={13} /> Compose
                  </button>
                </div>
              </div>

              {/* Inbox vs Sent Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', marginBottom: 8 }}>
                <button 
                  onClick={() => { setDirectionTab('inbox'); setSelected(null); setComposing(false); }}
                  style={{ flex: 1, padding: '6px 0', border: 'none', background: 'none', borderBottom: directionTab === 'inbox' ? '2px solid #2563eb' : '2px solid transparent', color: directionTab === 'inbox' ? '#2563eb' : '#6b7280', fontWeight: directionTab === 'inbox' ? 600 : 500, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Inbox
                </button>
                <button 
                  onClick={() => { setDirectionTab('sent'); setSelected(null); setComposing(false); }}
                  style={{ flex: 1, padding: '6px 0', border: 'none', background: 'none', borderBottom: directionTab === 'sent' ? '2px solid #2563eb' : '2px solid transparent', color: directionTab === 'sent' ? '#2563eb' : '#6b7280', fontWeight: directionTab === 'sent' ? 600 : 500, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Sent
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px', height: 28 }}>
                <Search size={13} style={{ color: '#9ca3af' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search emails…"
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.78rem', color: '#374151', width: '100%' }}
                />
              </div>
            </div>

            {/* Email list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={20} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
                </div>
              ) : emails.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  <p style={{ fontSize: '0.82rem', margin: 0 }}>No emails found</p>
                </div>
              ) : (
                emails.map(email => (
                  <div
                    key={email.id}
                    onClick={() => handleSelect(email)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: selected?.id === email.id ? '#f0f4ff' : (!email.is_read ? '#f8faff' : 'transparent'),
                      borderBottom: '1px solid #f3f4f6',
                      borderLeft: selected?.id === email.id ? '2px solid #3d68f5' : '2px solid transparent',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (selected?.id !== email.id) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { if (selected?.id !== email.id) e.currentTarget.style.background = !email.is_read ? '#f8faff' : 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(directionTab === 'inbox' ? email.from_name : email.from_email), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}>
                        {getInitials(directionTab === 'inbox' ? email.from_name : email.from_email)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: !email.is_read ? 600 : 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {directionTab === 'inbox' ? email.from_name : `To: ${email.from_email}`}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{formatDate(email.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: !email.is_read ? 600 : 400, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{email.subject}</div>
                        {email.preview && (
                          <div style={{ fontSize: '0.76rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.preview}</div>
                        )}
                        {email.attachment_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#6b7280', fontSize: '0.7rem' }}>
                            <Paperclip size={10} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.attachment_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: email detail or compose ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fff' }}>
            {composing ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Compose Header */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>New Message</h2>
                  <button 
                    onClick={() => { setComposing(false); setAttachName(null); setAttachData(null); }} 
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Recipients & Subject */}
                <div style={{ padding: '12px 28px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', width: 60 }}>To:</span>
                  <input 
                    value={to} 
                    onChange={e => setTo(e.target.value)} 
                    placeholder="recipient@example.com" 
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.875rem', color: '#374151', fontFamily: 'inherit' }} 
                  />
                </div>
                <div style={{ padding: '12px 28px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', width: 60 }}>Subject:</span>
                  <input 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)} 
                    onBlur={handleSubjectBlur}
                    placeholder="Enter subject" 
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.875rem', color: '#374151', fontFamily: 'inherit' }} 
                  />
                </div>
                {/* Body */}
                <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message here..."
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem', lineHeight: 1.75, fontFamily: 'inherit', resize: 'none', color: '#374151', padding: 0 }}
                  />
                </div>

                {/* Attachment Badge */}
                {attachName ? (
                  <div style={{ padding: '8px 28px', borderTop: '1px solid #f3f4f6', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
                    <Paperclip size={12} style={{ marginRight: 6 }} />
                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachName}</span>
                    <button onClick={() => { setAttachName(null); setAttachData(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : null}

                {/* Action Bar */}
                <div style={{ padding: '16px 28px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyCenter: 'center', width: 34, height: 34, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', flexShrink: 0, paddingLeft: 8 }}>
                    <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                    <Paperclip size={18} style={{ color: '#6b7280' }} />
                  </label>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="btn-blue"
                    style={{ background: sending ? '#9ca3af' : undefined, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? <Loader2 size={13} className="ws-chat-loader-spin" /> : <Send size={13} />}
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            ) : selected ? (
              <>
                {/* Email header */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.subject}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(directionTab === 'inbox' ? selected.from_name : selected.from_email), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
                          {getInitials(directionTab === 'inbox' ? selected.from_name : selected.from_email)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.845rem', fontWeight: 600, color: '#111827' }}>
                            {directionTab === 'inbox' ? selected.from_name : `To: ${selected.from_email}`}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>
                            {directionTab === 'inbox' ? selected.from_email : selected.from_email}
                          </div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af', flexShrink: 0 }}>{formatDate(selected.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, color: '#e11d48', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>

                {/* Email body */}
                <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
                  {selected.body && (selected.body.trim().startsWith('<') || selected.body.includes('</div>') || selected.body.includes('</p>') || selected.body.includes('<h3')) ? (
                    <div
                      style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.6, margin: '0 0 24px' }}
                      dangerouslySetInnerHTML={{ __html: selected.body }}
                    />
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.8, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
                      {selected.body || selected.preview || '(No content)'}
                    </p>
                  )}

                  {/* Attachment download */}
                  {selected.attachment_name && selected.attachment_data ? (
                    <div style={{ padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400 }}>
                      <Paperclip size={14} style={{ color: '#6b7280' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selected.attachment_name}
                      </span>
                      <a 
                        href={selected.attachment_data} 
                        download={selected.attachment_name}
                        style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3d68f5', textDecoration: 'none' }}
                      >
                        Download
                      </a>
                    </div>
                  ) : null}
                </div>

                {/* Quick reply */}
                {directionTab === 'inbox' && (
                  <div style={{ padding: '12px 28px 20px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Quick reply…"
                        rows={2}
                        style={{ width: '100%', padding: '12px 14px', border: 'none', outline: 'none', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'none', color: '#374151', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                        <button
                          onClick={handleReply}
                          disabled={!replyText.trim()}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: replyText.trim() ? '#111827' : '#e5e7eb', color: replyText.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, cursor: replyText.trim() ? 'pointer' : 'not-allowed' }}
                        >
                          <Send size={13} /> Reply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : !loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <Mail size={40} style={{ marginBottom: 12, opacity: 0.35 }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Select an email to read</p>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
