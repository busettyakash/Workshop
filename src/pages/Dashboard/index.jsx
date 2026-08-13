import React, { useEffect, useState, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import { useLocation, useNavigate, Link } from 'react-router'
import {
  ChevronDown, ArrowUp, Plus, Bot, Loader2, Star, Clock, Trash2,
  Home, HelpCircle, ChevronLeft, ChevronRight, MoreHorizontal, Compass, Paperclip,
  FileText, Mail, StickyNote, Inbox, Sparkles, TrendingUp, Package, UserPlus
} from 'lucide-react'
import './Dashboard.css'

export default function Dashboard() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user } = useAuth()

  const [view, setView] = useState('home')

  // ── Chat State ──
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [homeInputText, setHomeInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
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
    fetchSessions()
    fetchRecentNotes()
    fetchRecentEmails()
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
    setIsLoading(true)
    setView('chat')
    try {
      const res = await api.get(`/chat/sessions/${id}`)
      const rawMsgs = res.data?.messages || []
      const formatted = rawMsgs.map((m, idx) => ({
        ...m,
        id: m.id || (Date.now() + idx),
        time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
      setMessages(formatted)
      setCurrentSessionId(id)

      // Find or query title
      const s = sessions.find(item => String(item.id) === String(id))
      if (s) {
        setChatTitle(s.title)
        setConversationId(s.conversation_id)
      } else {
        const sessionsRes = await api.get('/chat/sessions')
        const freshSessions = sessionsRes.data || []
        setSessions(freshSessions)
        const found = freshSessions.find(item => String(item.id) === String(id))
        if (found) {
          setChatTitle(found.title)
          setConversationId(found.conversation_id)
        }
      }
    } catch (err) {
      dispatch(addToast({ message: 'Could not load chat session', type: 'error' }))
    } finally {
      setIsLoading(false)
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
    setMessages([])
    setInputText('')
    setCurrentSessionId(null)
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    setChatTitle('Untitled chat')
    setFavorited(false)
  }

  const handleNewChatClick = () => {
    handleNewChat()
    navigate('/dashboard?chat=true')
  }

  const sendMessage = async (overrideText) => {
    const text = (overrideText || inputText).trim()
    if (!text || isLoading) return

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { id: Date.now(), role: 'user', content: text, time }

    const updated = [...messages, userMsg]
    setMessages(updated)
    if (!overrideText) setInputText('')
    setIsLoading(true)

    let currentTitle = chatTitle
    if (messages.length === 0 || chatTitle === 'Untitled chat') {
      currentTitle = text.length > 35 ? text.slice(0, 35) + '…' : text
      setChatTitle(currentTitle)
    }

    try {
      const payload = updated.map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/chat', {
        messages: payload,
        conversationId,
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

  const handleHomeSend = () => {
    const text = homeInputText.trim()
    if (!text) return
    setHomeInputText('')
    handleNewChat()
    setView('chat')
    sendMessage(text)
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
    let tableRows = []
    
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
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${key}`} style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', margin: '12px 0', maxWidth: '100%' }}>
            {tableRows}
          </div>
        )
        tableRows = []
      }
      inTable = false
    }

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      
      // Handle table rows
      if (trimmed.startsWith('|')) {
        if (inList) flushList(idx)
        inTable = true
        // Skip separator lines like |---|---|
        if (trimmed.includes('---')) return
        
        const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
        const isHeader = tableRows.length === 0
        tableRows.push(
          <div key={`tr-${idx}`} style={{ display: 'flex', background: isHeader ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '10px 14px', gap: '16px' }}>
            {cells.map((cell, cIdx) => (
              <span key={cIdx} style={{ flex: 1, fontSize: '0.86rem', fontWeight: isHeader ? '600' : '450', color: isHeader ? '#111827' : '#374151' }}>
                {renderInlineBold(cell)}
              </span>
            ))}
          </div>
        )
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
        
        {/* ─── HOME VIEW (Image 1 Style) ─── */}
        {view === 'home' && (
          <>
            {/* Home header */}
            <header className="ws-chat-header" style={{ padding: '0 28px' }}>
              <div className="ws-chat-header-left" style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: 500 }}>
                <Home size={15} style={{ marginRight: 6 }} />
                <span>Home</span>
              </div>
              <div className="ws-chat-header-right" style={{ color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={15} />
                <span>Help</span>
              </div>
            </header>

            <main className="ws-dash-body" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ maxWidth: 720, width: '100%', padding: '40px 20px 60px' }}>
                
                {/* Greeting */}
                <h1 className="ws-home-greeting" style={{ textAlign: 'left', marginBottom: 28 }}>
                  {getGreeting()}, {userFullName}.
                </h1>

                {/* Central Recent Chat card */}
                <div className="ws-chat-input-wrapper" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 18px rgba(0,0,0,0.03)', marginBottom: 40, padding: '16px 18px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                    <Bot size={12} style={{ color: '#6b7280' }} />
                    <span>Recent chat</span>
                    {sessions.length > 0 && (
                      <>
                        <span>·</span>
                        <span 
                          style={{ color: '#2563eb', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => navigate(`/dashboard?session=${sessions[0].id}`)}
                          title="Open recent chat"
                        >
                          {sessions[0].title}
                        </span>
                      </>
                    )}
                  </div>
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
                      {/* Controls removed */}
                    </div>
                    <button 
                      className={`ws-chat-send-btn ${homeInputText.trim() ? 'active' : ''}`}
                      onClick={handleHomeSend}
                      disabled={!homeInputText.trim()}
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>


                {/* ── Notes Section ── */}
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

                {/* ── Emails Section ── */}
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
                      <Link to="/emails?compose=true" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#111827', color: '#fff', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
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
                                  {new Date(email.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
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

              </div>
            </main>
          </>
        )}

        {/* ─── CHAT VIEW (Image 2 Style) ─── */}
        {view === 'chat' && (
          <>
            {/* Chat header */}
            <header className="ws-chat-header">
              <div className="ws-chat-header-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="ws-chat-header-title">{chatTitle}</span>
                <button 
                  className={`ws-chat-star-btn ${favorited ? 'active' : ''}`}
                  onClick={() => setFavorited(!favorited)}
                  title={favorited ? "Remove favorite" : "Favorite chat"}
                >
                  <Star size={14} fill={favorited ? "#f59e0b" : "none"} stroke={favorited ? "#f59e0b" : "currentColor"} />
                </button>
              </div>
              
              <div className="ws-chat-header-right">
                <button className="ws-chat-control-btn" onClick={handleNewChatClick} title="New chat">
                  <Plus size={14} />
                  <span>New chat</span>
                </button>
                <div style={{ position: 'relative' }}>
                  <button 
                    className={`ws-chat-control-btn ${showHistory ? 'active' : ''}`} 
                    onClick={() => setShowHistory(!showHistory)}
                    title="History"
                  >
                    <Clock size={15} />
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
              </div>
            </header>

            {/* Chat message list area */}
            <main className="ws-chat-body">
              {messages.length === 0 ? (
                <div style={{ maxWidth: 680, margin: '30px auto 0', textAlign: 'center', padding: '0 16px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)', marginBottom: 16 }}>
                    <Sparkles size={26} />
                  </div>

                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    What can I help you with today?
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 24px', maxWidth: 480, marginInline: 'auto' }}>
                    Ask anything about your products, stock levels, quotes, bills, or dispatch automated customer emails.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, textAlign: 'left' }}>
                    <div 
                      onClick={() => sendMessage("Show today's total revenue, bills created, and sales summary")}
                      style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      className="attio-table-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontWeight: 600, fontSize: '0.84rem', marginBottom: 4 }}>
                        <TrendingUp size={16} /> Sales & Revenue Summary
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
                        Check today's bills, total revenue, and top-selling products.
                      </div>
                    </div>

                    <div 
                      onClick={() => sendMessage("Check low stock items and list current inventory levels")}
                      style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      className="attio-table-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 600, fontSize: '0.84rem', marginBottom: 4 }}>
                        <Package size={16} /> Stock & Inventory Status
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
                        View low stock alerts, remaining quantities, and batch imports.
                      </div>
                    </div>

                    <div 
                      onClick={() => sendMessage("Show me quotes created today and quote status summary")}
                      style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      className="attio-table-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', fontWeight: 600, fontSize: '0.84rem', marginBottom: 4 }}>
                        <FileText size={16} /> Check Today's Quotes
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
                        Review quotations sent to buyers and check pending quote deals.
                      </div>
                    </div>

                    <div 
                      onClick={() => sendMessage("Add a new contact person to database")}
                      style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      className="attio-table-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9333ea', fontWeight: 600, fontSize: '0.84rem', marginBottom: 4 }}>
                        <UserPlus size={16} /> Add Customer or Contact
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
                        Create a new customer, lead, or supplier contact instantly.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ws-chat-messages-wrapper">
                  {messages.map((msg, idx) => (
                    <div 
                      key={msg.id || `msg-${idx}`} 
                      className={`ws-chat-message-row ws-chat-message-${msg.role}`}
                    >
                      <div className="ws-chat-message-container">
                        <div className="ws-chat-message-bubble-wrap">
                          <div className="ws-chat-message-bubble">
                            {msg.role === 'assistant' ? renderMarkdown(msg.content) : renderContent(msg.content)}
                          </div>
                          {msg.role === 'assistant' && (
                            <div className="ws-chat-assistant-actions">
                              <button className="ws-chat-action-btn" title="Copy response" onClick={() => {
                                navigator.clipboard.writeText(msg.content)
                                dispatch(addToast({ message: 'Copied to clipboard', type: 'success' }))
                              }}>
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="ws-chat-message-row ws-chat-message-assistant">
                      <div className="ws-chat-message-container">
                        <div className="ws-chat-message-bubble-wrap">
                          <div className="ws-chat-message-bubble ws-chat-typing">
                            <span className="ws-chat-dot" />
                            <span className="ws-chat-dot" />
                            <span className="ws-chat-dot" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </main>

            {/* Chat bottom floating input */}
            <div className="ws-chat-input-section">
              <div className="ws-chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="ws-chat-textarea"
                  placeholder="Ask anything..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => handleKey(e, 'chat')}
                  rows={1}
                />
                <div className="ws-chat-input-controls">
                  <div className="ws-chat-input-right-controls" style={{ marginLeft: 'auto' }}>
                    {isLoading && <Loader2 size={14} className="ws-chat-loader-spin" />}
                    <button 
                      className={`ws-chat-send-btn ${inputText.trim() && !isLoading ? 'active' : ''}`}
                      onClick={() => sendMessage()}
                      disabled={!inputText.trim() || isLoading}
                      aria-label="Send message"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
