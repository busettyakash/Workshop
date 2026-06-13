import React, { useEffect, useState, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { addToast, setActiveNav, selectSidebarOpen } from '../../redux/slices/uiSlice'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  ChevronDown, ArrowUp, Plus, Bot, Loader2, Star, Clock, Trash2,
  Home, HelpCircle, ChevronLeft, ChevronRight, MoreHorizontal, Compass, Paperclip
} from 'lucide-react'
import './Dashboard.css'

export default function Dashboard() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { user } = useAuth()

  // ── View Mode: 'home' | 'chat' ──
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

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // ── Time-aware greeting ──
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // ── User name from email ──
  const userEmail = user?.email || ''
  const emailPrefix = userEmail.split('@')[0]
  const firstName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : 'there'

  // Fetch recent sessions on mount
  useEffect(() => {
    dispatch(setActiveNav('Home'))
    fetchSessions()
  }, [dispatch])

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
      const initialPrompt = location.state?.initialPrompt
      if (initialPrompt) {
        handleNewChat()
        setView('chat')
        // Clear location state to avoid double send on reload
        navigate(location.pathname + location.search, { replace: true, state: {} })
        sendMessage(initialPrompt)
      } else if (view !== 'chat') {
        handleNewChat()
        setView('chat')
      }
    } else {
      setView('home')
    }
  }, [location])

  const fetchSessions = async () => {
    try {
      const res = await api.get('/chat/sessions')
      setSessions(res.data || [])
    } catch (err) {
      console.error('Failed to fetch sessions', err)
    }
  }

  const fetchSessionById = async (id) => {
    setIsLoading(true)
    setView('chat')
    try {
      const res = await api.get(`/chat/sessions/${id}`)
      setMessages(res.data.messages || [])
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
    navigate('/dashboard?chat=true', { state: { initialPrompt: text } })
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
                  {getGreeting()}, {firstName}.
                </h1>

                {/* Central Recent Chat card */}
                <div className="ws-chat-input-wrapper" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 18px rgba(0,0,0,0.03)', marginBottom: 40, padding: '16px 18px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                    <Bot size={12} style={{ color: '#6b7280' }} />
                    <span>Recent chat</span>
                    {sessions.length > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#4b5563', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>{sessions[0].title}</span>
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
                      <button className="ws-chat-model-selector">
                        <span>Auto</span>
                        <ChevronDown size={11} />
                      </button>
                      <button className="ws-chat-star-btn" style={{ padding: 4 }} title="Explore">
                        <Compass size={14} />
                      </button>
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

                {/* Meetings Section */}
                <section className="ws-home-section" style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: 36 }}>
                  <div className="ws-home-section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 className="ws-home-section-title" style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4b5563' }}>Meetings</h2>
                    <div className="ws-home-section-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: '#6b7280' }}>
                      <span>Today, May 31</span>
                      <div className="ws-home-arrows" style={{ display: 'flex', gap: 4 }}>
                        <button className="ws-home-arrow-btn" style={{ padding: 2, background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}><ChevronLeft size={13} /></button>
                        <button className="ws-home-arrow-btn" style={{ padding: 2, background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}><ChevronRight size={13} /></button>
                      </div>
                      <MoreHorizontal size={14} style={{ cursor: 'pointer' }} />
                    </div>
                  </div>

                  <div className="ws-home-empty-card" style={{ padding: '36px 20px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center' }}>
                    <p className="ws-home-empty-title" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>Turn meetings into opportunities</p>
                    <p className="ws-home-empty-desc" style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 16 }}>Sync your calendar to get instant meeting context</p>
                    <button className="ws-home-google-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Sync Google Account
                    </button>
                  </div>
                </section>

                {/* Tasks Section */}
                <section className="ws-home-section" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <div className="ws-home-section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 className="ws-home-section-title" style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4b5563' }}>Tasks <span style={{ fontSize: '0.75rem', fontWeight: 550, color: '#9ca3af', marginLeft: 6 }}>0</span></h2>
                    <span className="ws-tasks-view-all" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3d68f5', cursor: 'pointer' }}>View all</span>
                  </div>

                  <div className="ws-home-empty-card" style={{ padding: '36px 20px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center' }}>
                    <p className="ws-home-empty-title" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111827', marginBottom: 4 }}>Stay on top of work</p>
                    <p className="ws-home-empty-desc" style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 16 }}>Create tasks for yourself or your team to track next steps</p>
                    <button className="ws-home-new-btn">
                      <Plus size={13} />
                      New task
                    </button>
                  </div>
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
              <div className="ws-chat-header-left">
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
                <div className="ws-chat-welcome-container">
                  <div className="ws-chat-welcome-avatar">
                    <Bot size={32} />
                  </div>
                  <h2 className="ws-chat-welcome-title">How can I help you today?</h2>
                  <p className="ws-chat-welcome-subtitle">Ask anything about your products, customers, bills, or workflows.</p>
                  
                  <div className="ws-chat-welcome-pills">
                    <button className="ws-chat-welcome-pill" onClick={() => sendMessage('How do I manage my workflows?')}>
                      <span>How to automate business?</span>
                    </button>
                    <button className="ws-chat-welcome-pill" onClick={() => sendMessage('Show me my products and check inventory status')}>
                      <span>List all products</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ws-chat-messages-wrapper">
                  {messages.map(msg => (
                    <div 
                      key={msg.id} 
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
                              <span className="ws-chat-action-divider">•</span>
                              {msg.cached && <span className="ws-chat-cached-label">cached</span>}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="ws-chat-model-selector">
                      <span>Auto</span>
                      <ChevronDown size={11} />
                    </button>
                    <button className="ws-chat-star-btn" style={{ padding: 4 }} title="Explore">
                      <Compass size={14} />
                    </button>
                  </div>
                  <div className="ws-chat-input-right-controls">
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
