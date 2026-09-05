import React, { useEffect, useState, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import { useLocation, useNavigate, Link } from 'react-router'
import {
  ChevronDown, ArrowUp, Plus, Bot, Loader2, Star, Clock, Trash2,
  Home, HelpCircle, ChevronLeft, ChevronRight, MoreHorizontal, MoreVertical, Compass, Paperclip,
  FileText, Mail, StickyNote, Inbox, Sparkles, TrendingUp, Package, UserPlus, GraduationCap, Mic
} from 'lucide-react'
import { getRandomString } from '../../utils/cryptoUtils'
import { hasModulePermission, getFirstAccessibleRoute } from '../../utils/permissionUtils'
import './Dashboard.css'

export default function Dashboard() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user } = useAuth()

  const [view, setView] = useState('home')

  // ── Permission state ──
  const canAccessDashboard = hasModulePermission('dashboard')
  const canAccessNotes = hasModulePermission('notes')
  const canAccessEmails = hasModulePermission('emails')
  const canAccessChats = hasModulePermission('chats')

  // ── If user does not have permission for Dashboard, redirect to first allowed route ──
  useEffect(() => {
    if (!hasModulePermission('dashboard')) {
      const searchParams = new URLSearchParams(location.search)
      const isChatMode = searchParams.get('chat') || searchParams.get('session')
      // If user has chat permission and is in chat mode, allow chat view
      if (isChatMode && hasModulePermission('chats')) {
        return
      }
      const targetRoute = getFirstAccessibleRoute()
      if (targetRoute && targetRoute !== '/dashboard') {
        navigate(targetRoute, { replace: true })
      }
    }
  }, [navigate, location.search])

  // ── Chat State ──
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [homeInputText, setHomeInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}_${getRandomString(6)}`)
  const [chatTitle, setChatTitle] = useState('Untitled chat')
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [favorited, setFavorited] = useState(false)

  // ── Home section data ──
  const [recentNotes, setRecentNotes] = useState([])
  const [recentEmails, setRecentEmails] = useState([])
  const [totalNotesCount, setTotalNotesCount] = useState(0)
  const [totalEmailsCount, setTotalEmailsCount] = useState(0)
  const [notesLoading, setNotesLoading] = useState(true)
  const [emailsLoading, setEmailsLoading] = useState(true)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // ── Time-aware greeting ──
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // ── User display name (First Name + Last Name) ──
  const userFirstName = user?.firstName || user?.first_name || ''
  const userLastName = user?.lastName || user?.last_name || ''
  const userEmail = user?.email || ''
  const emailPrefix = userEmail ? userEmail.split('@')[0] : ''
  const fallbackName = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : 'there'
  const userFullName = [userFirstName, userLastName].filter(Boolean).join(' ') || fallbackName

  // Fetch recent sessions + home data on mount
  useEffect(() => {
    dispatch(setActiveNav('Home'))
    if (hasModulePermission('chats')) {
      fetchSessions()
    }
    if (hasModulePermission('notes')) {
      fetchRecentNotes()
    } else {
      setNotesLoading(false)
    }
    if (hasModulePermission('emails')) {
      fetchRecentEmails()
    } else {
      setEmailsLoading(false)
    }
  }, [dispatch])

  const processedPromptRef = useRef(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Listen to URL changes to switch views
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const sessionId = searchParams.get('session')
    const chatActive = searchParams.get('chat')

    if (sessionId) {
      fetchSessionById(sessionId)
    } else if (chatActive) {
      setView('chat')
    } else {
      setView('home')
      // Clean slate for Home view
      setMessages([])
      setCurrentSessionId(null)
      setConversationId(`conv_${Date.now()}_${getRandomString(6)}`)
      setChatTitle('Untitled chat')
    }
  }, [location.search])

  const fetchSessions = async () => {
    try {
      const res = await api.get('/chat/sessions')
      setSessions(res.data || [])
    } catch (err) {
      console.error('Failed to fetch sessions', err)
    }
  }

  const fetchRecentNotes = async () => {
    setNotesLoading(true)
    try {
      const res = await api.get('/notes')
      const data = res.data?.data || []
      setRecentNotes(data.slice(0, 3))
      setTotalNotesCount(res.data?.total || data.length)
    } catch { /* silent */ } finally {
      setNotesLoading(false)
    }
  }

  const fetchRecentEmails = async () => {
    setEmailsLoading(true)
    try {
      const res = await api.get('/emails?direction=inbox')
      const data = res.data?.data || []
      setRecentEmails(data.slice(0, 3))
      setTotalEmailsCount(res.data?.total || data.length)
    } catch { /* silent */ } finally {
      setEmailsLoading(false)
    }
  }

  const fetchSessionById = async (id) => {
    if (!id) return
    const idStr = String(id)

    // If already viewing this session and messages are loaded, just switch view
    if (String(currentSessionId) === idStr && messages.length > 0) {
      setView('chat')
      return
    }

    setSessionLoading(true)
    setView('chat')
    setCurrentSessionId(id)

    // Pre-populate title and conversation_id immediately from existing sessions list if known
    const knownSession = sessions.find(item => String(item.id) === idStr)
    if (knownSession) {
      if (knownSession.title) setChatTitle(knownSession.title)
      if (knownSession.conversation_id) setConversationId(knownSession.conversation_id)
    }

    try {
      const res = await api.get(`/chat/sessions/${id}`)
      const data = res.data || {}
      const rawMsgs = data.messages || []
      const formatted = rawMsgs.map((m, idx) => ({
        ...m,
        id: m.id || (Date.now() + idx),
        time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
      setMessages(formatted)
      if (data.title) setChatTitle(data.title)
      if (data.conversation_id) setConversationId(data.conversation_id)
    } catch (err) {
      dispatch(addToast({ message: 'Could not load chat session', type: 'error' }))
    } finally {
      setSessionLoading(false)
    }
  }

  const deleteSession = async (id, e) => {
    e.stopPropagation()
    try {
      await api.delete(`/chat/sessions/${id}`)
      dispatch(addToast({ message: 'Chat session deleted', type: 'success' }))
      fetchSessions()
      if (currentSessionId === id) {
        navigate('/dashboard')
      }
    } catch (err) {
      dispatch(addToast({ message: 'Failed to delete chat session', type: 'error' }))
    }
  }

  const handleNewChat = () => {
    const freshConvId = `conv_${Date.now()}_${getRandomString(6)}`
    setMessages([])
    setInputText('')
    setCurrentSessionId(null)
    setConversationId(freshConvId)
    setChatTitle('Untitled chat')
    setFavorited(false)
    return freshConvId
  }

  const handleNewChatClick = () => {
    handleNewChat()
    navigate('/dashboard?chat=true')
  }

  const sendMessage = async (overrideText, customOpts = {}) => {
    const text = (overrideText || inputText).trim()
    if (!text || isLoading) return

    const isNew = Boolean(customOpts.isNewChat)
    const activeConvId = customOpts.conversationId || (isNew ? `conv_${Date.now()}_${getRandomString(6)}` : conversationId)
    const baseMessages = isNew ? [] : (customOpts.messages !== undefined ? customOpts.messages : messages)

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { id: Date.now(), role: 'user', content: text, time }

    const updated = [...baseMessages, userMsg]
    setMessages(updated)
    if (!overrideText) setInputText('')
    setIsLoading(true)

    let currentTitle = isNew ? (text.length > 35 ? text.slice(0, 35) + '…' : text) : chatTitle
    if (!isNew && (baseMessages.length === 0 || chatTitle === 'Untitled chat')) {
      currentTitle = text.length > 35 ? text.slice(0, 35) + '…' : text
      setChatTitle(currentTitle)
    }

    if (isNew) {
      setCurrentSessionId(null)
      setConversationId(activeConvId)
      setChatTitle(currentTitle)
      setFavorited(false)
      setView('chat')
    }

    try {
      const payload = updated.map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/chat', {
        messages: payload,
        conversationId: activeConvId,
        title: currentTitle
      })

      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.content,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cached: res.data.cached
      }
      setMessages(prev => [...prev, aiMsg])
      fetchSessions()
    } catch (err) {
      dispatch(addToast({ message: 'AI response failed. Please try again.', type: 'error' }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleHomeSend = async () => {
    const text = homeInputText.trim()
    if (!text) return
    setHomeInputText('')

    const freshConvId = `conv_${Date.now()}_${getRandomString(6)}`
    navigate('/dashboard?chat=true')
    sendMessage(text, { isNewChat: true, conversationId: freshConvId, messages: [] })
  }

  const handleKey = (e, target) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (target === 'home') {
        handleHomeSend()
      } else {
        sendMessage()
      }
    }
  }

  const renderContent = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
      p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
    )
  }

  const renderInlineBold = (text) => {
    if (!text) return ''
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
      p.startsWith('**') ? <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong> : p
    )
  }

  const renderMarkdown = (text) => {
    if (!text) return null
    
    // Normalize lines: join table rows or separate blocks
    const lines = text.split('\n')
    const elements = []
    let listItems = []
    let inList = false
    let inTable = false
    let rawTableLines = []
    
    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'disc' }}>
            {listItems}
          </ul>
        )
        listItems = []
      }
      inList = false
    }

    const flushTable = (key) => {
      if (rawTableLines.length > 0) {
        // Parse all rows
        const parsedRows = rawTableLines
          .map(line => line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1))
          .filter(row => row.length > 0 && !row.every(c => /^[-:]+$/.test(c)))

        if (parsedRows.length > 0) {
          const headerRow = parsedRows[0]
          // Find indices of internal technical columns to exclude (ID, user_id, etc.)
          const excludedIndices = new Set()
          headerRow.forEach((col, cIdx) => {
            const cleanCol = col.replaceAll('*', '').trim().toLowerCase()
            if (cleanCol === 'id' || cleanCol === 'user_id' || cleanCol === 'uid') {
              excludedIndices.add(cIdx)
            }
          })

          const cleanRows = parsedRows.map(row => row.filter((_, idx) => !excludedIndices.has(idx)))

          if (cleanRows.length > 0) {
            const headers = cleanRows[0]
            const dataRows = cleanRows.slice(1)

            elements.push(
              <div key={`table-${key}`} style={{ margin: '14px 0', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', maxWidth: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {headers.map((h, hIdx) => (
                          <th key={hIdx} style={{ padding: '10px 14px', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {renderInlineBold(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: rIdx === dataRows.length - 1 ? 'none' : '1px solid #f1f5f9', background: rIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{ padding: '9px 14px', color: '#334155', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {renderInlineBold(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        }
        rawTableLines = []
      }
      inTable = false
    }

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      
      // Handle table rows
      if (trimmed.startsWith('|')) {
        if (inList) flushList(idx)
        inTable = true
        rawTableLines.push(trimmed)
        return
      } else {
        if (inTable) flushTable(idx)
      }

      // Handle lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true
        listItems.push(
          <li key={`li-${idx}`} style={{ fontSize: '0.92rem', color: '#374151', margin: '4px 0', lineHeight: 1.5 }}>
            {renderInlineBold(trimmed.slice(2))}
          </li>
        )
        return
      } else {
        if (inList) flushList(idx)
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={idx} style={{ fontSize: '1.28rem', fontWeight: 700, margin: '14px 0 8px', color: '#111827' }}>{trimmed.slice(2)}</h1>)
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={idx} style={{ fontSize: '1.12rem', fontWeight: 600, margin: '12px 0 6px', color: '#111827' }}>{trimmed.slice(3)}</h2>)
      } else if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={idx} style={{ fontSize: '0.98rem', fontWeight: 600, margin: '10px 0 4px', color: '#111827' }}>{trimmed.slice(4)}</h3>)
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={idx} style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: '12px', color: '#6b7280', margin: '10px 0', fontStyle: 'italic' }}>
            {renderInlineBold(trimmed.slice(2))}
          </blockquote>
        )
      } else if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '8px' }} />)
      } else {
        elements.push(
          <p key={idx} style={{ margin: '6px 0', fontSize: '0.92rem', color: '#374151', lineHeight: 1.6 }}>
            {renderInlineBold(line)}
          </p>
        )
      }
    })

    if (inList) flushList('end')
    if (inTable) flushTable('end')

    return elements
  }

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        
        {/* ─── HOME VIEW ─── */}
        {view === 'home' && (
          <>
            <Topbar />
            <main className="ws-dash-body" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ maxWidth: 720, width: '100%', padding: '40px 20px 60px' }}>
                
                {/* Greeting */}
                <h1 className="ws-home-greeting" style={{ textAlign: 'left', marginBottom: 24 }}>
                  {getGreeting()}, {userFullName}.
                </h1>

                {/* Recent Chat Indicator Pill (Cleanly separated) */}
                {sessions.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div 
                      role="button"
                      tabIndex={0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 20,
                        fontSize: '0.80rem',
                        color: '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        maxWidth: '100%'
                      }}
                      onClick={() => navigate(`/dashboard?session=${sessions[0].id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/dashboard?session=${sessions[0].id}`) }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.background = '#f1f5f9'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.background = '#f8fafc'
                      }}
                      title="Open recent chat conversation"
                    >
                      <Clock size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                      <span style={{ color: '#64748b', fontWeight: 500 }}>Recent chat:</span>
                      <span style={{ color: '#0f172a', fontWeight: 600, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sessions[0].title}
                      </span>
                      <ChevronRight size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    </div>
                  </div>
                )}

                {/* Central New Chat card */}
                <div className="ws-chat-input-wrapper" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 18px rgba(0,0,0,0.03)', marginBottom: 40, padding: '16px 18px 12px' }}>
                  <textarea
                    className="ws-chat-textarea"
                    placeholder="Ask anything..."
                    value={homeInputText}
                    onChange={e => setHomeInputText(e.target.value)}
                    onKeyDown={e => handleKey(e, 'home')}
                    rows={2}
                    style={{ minHeight: 48 }}
                  />
                  <div className="ws-chat-input-controls">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Controls */}
                    </div>
                    <button 
                      className={`ws-chat-send-btn ${homeInputText.trim() ? 'active' : ''}`}
                      onClick={handleHomeSend}
                      disabled={!homeInputText.trim()}
                      title="Start new chat"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>


                {/* ── Notes Section ── */}
                {canAccessNotes && (
                  <section style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: 36 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4b5563', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                        Notes
                        {!notesLoading && <span style={{ fontSize: '0.75rem', fontWeight: 550, color: '#9ca3af', marginLeft: 6 }}>{totalNotesCount}</span>}
                      </h2>
                      <Link to="/notes" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3d68f5', textDecoration: 'none' }}>View all</Link>
                    </div>

                    {notesLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                        <Loader2 size={18} className="ws-chat-loader-spin" style={{ color: '#d1d5db' }} />
                      </div>
                    ) : recentNotes.length === 0 ? (
                      <div style={{ padding: '28px 20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>No notes yet</p>
                        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 14px' }}>Capture ideas, meeting notes and more</p>
                        <Link to="/notes" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                          <Plus size={13} /> New note
                        </Link>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentNotes.map(note => (
                          <Link key={note.id} to="/notes" style={{ textDecoration: 'none', display: 'block' }}>
                            <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, transition: 'border-color 0.1s, box-shadow 0.1s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3d68f5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(61,104,245,0.06)' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
                            >
                              <div style={{ fontSize: '0.845rem', fontWeight: 600, color: '#111827', marginBottom: 3 }}>{note.title}</div>
                              {note.body && <div style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.body}</div>}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* ── Emails Section ── */}
                {canAccessEmails && (
                  <section style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4b5563', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                        Emails
                        {!emailsLoading && <span style={{ fontSize: '0.75rem', fontWeight: 550, color: '#9ca3af', marginLeft: 6 }}>{totalEmailsCount}</span>}
                      </h2>
                      <Link to="/emails" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3d68f5', textDecoration: 'none' }}>View all</Link>
                    </div>

                    {emailsLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                        <Loader2 size={18} className="ws-chat-loader-spin" style={{ color: '#d1d5db' }} />
                      </div>
                    ) : recentEmails.length === 0 ? (
                      <div style={{ padding: '28px 20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>No emails yet</p>
                        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 14px' }}>Compose your first email or wait for replies</p>
                        <Link to="/emails?compose=true" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.15s' }}>
                          <Plus size={13} /> Compose
                        </Link>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentEmails.map(email => (
                          <Link key={email.id} to="/emails" style={{ textDecoration: 'none', display: 'block' }}>
                            <div style={{ padding: '12px 16px', background: email.is_read ? '#fff' : '#f8faff', border: `1px solid ${email.is_read ? '#e5e7eb' : '#c7d7fd'}`, borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'border-color 0.1s, box-shadow 0.1s' }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(61,104,245,0.06)' }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                            >
                              {!email.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3d68f5', flexShrink: 0, marginTop: 5 }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                  <span style={{ fontSize: '0.84rem', fontWeight: email.is_read ? 500 : 700, color: '#111827' }}>{email.from_name || email.from_email}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', flexShrink: 0, marginLeft: 10 }}>
                                    {new Date(email.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#374151', fontWeight: email.is_read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
                                {email.preview && <div style={{ fontSize: '0.76rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{email.preview}</div>}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                )}

              </div>
            </main>
          </>
        )}

        {/* ─── CHAT VIEW ─── */}
        {view === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#ffffff' }}>
            
            {/* Chat header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #f1f5f9', background: '#ffffff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>{chatTitle || 'Untitled chat'}</span>
                <button 
                  onClick={() => setFavorited(!favorited)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  title={favorited ? "Remove favorite" : "Favorite chat"}
                >
                  <Star size={14} fill={favorited ? "#f59e0b" : "none"} stroke={favorited ? "#f59e0b" : "currentColor"} />
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button 
                  onClick={handleNewChatClick}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.78rem', fontWeight: 500, color: '#0f172a', cursor: 'pointer', transition: 'all 0.12s ease' }}
                  title="Start new chat"
                >
                  <Plus size={14} />
                  <span>New chat</span>
                </button>

                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="History"
                  >
                    <Clock size={16} />
                  </button>
                  {showHistory && (
                    <div className="ws-chat-history-dropdown">
                      <div className="ws-chat-history-title">Recent Chats</div>
                      {sessions.length === 0 ? (
                        <div className="ws-chat-history-empty">No recent chats</div>
                      ) : (
                        sessions.map(s => (
                          <div 
                            key={s.id} 
                            className={`ws-chat-history-item ${s.conversation_id === conversationId ? 'active' : ''}`}
                            onClick={() => navigate(`/dashboard?session=${s.id}`)}
                          >
                            <div className="ws-chat-history-item-content">
                              <span className="ws-chat-history-item-title">{s.title}</span>
                              <span className="ws-chat-history-item-msg">{s.last_message}</span>
                            </div>
                            <button 
                              className="ws-chat-history-delete-btn"
                              onClick={(e) => deleteSession(s.id, e)}
                              title="Delete chat"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleNewChatClick}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="More options"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {/* Chat message list area */}
            <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              {sessionLoading ? (
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  <Loader2 size={32} className="ws-chat-loader-spin" style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: '#64748b' }}>Loading conversation...</span>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px 20px' }}>
                  
                  {/* Title */}
                  <h1 style={{ fontSize: '1.55rem', fontWeight: 600, color: '#0f172a', margin: '0 0 28px', letterSpacing: '-0.02em', textAlign: 'center' }}>
                    What can I help with?
                  </h1>

                  {/* Main Central Card */}
                  <div style={{
                    width: '100%',
                    maxWidth: 640,
                    background: '#ffffff',
                    border: '1.5px solid #dbeafe',
                    borderRadius: 16,
                    padding: '16px 18px 12px',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}>
                    <textarea
                      ref={textareaRef}
                      placeholder="Ask anything..."
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => handleKey(e, 'chat')}
                      rows={3}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '0.92rem',
                        color: '#0f172a',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                      autoFocus
                    />

                    {/* Bottom controls row inside card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                      <button 
                        onClick={() => sendMessage()}
                        disabled={!inputText.trim() || isLoading}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: inputText.trim() && !isLoading ? '#3b82f6' : '#bfdbfe',
                          color: '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Footer "Learn more" Card */}
                  <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
                      Learn more
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                      width: 340,
                      cursor: 'pointer'
                    }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#475569',
                        background: '#f8fafc',
                        flexShrink: 0
                      }}>
                        <GraduationCap size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>Ask Assistant</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>See what Ask Assistant can do for you</div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {messages.map((msg, idx) => (
                    <div key={msg.id || `msg-${idx}`} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: msg.role === 'user' ? '#0f172a' : '#f1f5f9',
                        color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                        fontSize: '0.85rem',
                        lineHeight: 1.6
                      }}>
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : renderContent(msg.content)}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderRadius: 12, background: '#f1f5f9', width: 'fit-content' }}>
                      <Loader2 size={16} className="ws-chat-loader-spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </main>

            {/* Chat bottom floating input only when conversation has messages */}
            {messages.length > 0 && (
              <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0 }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <textarea
                    ref={textareaRef}
                    placeholder="Ask anything..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => handleKey(e, 'chat')}
                    rows={1}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#0f172a', resize: 'none', fontFamily: 'inherit' }}
                  />
                  <button 
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim() || isLoading}
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: inputText.trim() && !isLoading ? '#2563eb' : '#e2e8f0', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed' }}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
