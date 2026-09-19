import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Sparkles, X, Send, Plus, Maximize2, Loader2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { selectChatOpen, setChatOpen } from '../../redux/slices/uiSlice'
import api from '../../api/client'
import './AiChatDrawer.css'

const SUGGESTIONS = [
  'Summarize unpaid bills & revenues',
  'Check low stock products in inventory',
  'Show recent quotations status',
  'How many customers are registered?'
]

export default function AiChatDrawer() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isOpen = useAppSelector(selectChatOpen)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(() => `drawer_${Date.now()}`)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Don't show drawer on landing/auth pages or when already on the full chat page
  const isPublicPage = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms'].includes(location.pathname)
  const isFullChatPage = location.pathname === '/dashboard' && (location.search.includes('chat=true') || location.search.includes('session='))
  if (isPublicPage || isFullChatPage) return null

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { id: Date.now(), role: 'user', content: text, time }

    const updated = [...messages, userMsg]
    setMessages(updated)
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const payload = updated.map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/chat', {
        messages: payload,
        conversationId,
        title: text.slice(0, 30)
      })

      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data?.content || 'I processed your request.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      console.error('[AI Chat Drawer Error]', err)
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '⚠️ Sorry, I could not complete this request right now. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      dispatch(setChatOpen(false))
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setInput('')
    setConversationId(`drawer_${Date.now()}`)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleOpenFull = () => {
    dispatch(setChatOpen(false))
    navigate('/dashboard?chat=true')
  }

  const renderInlineBold = (text) => {
    if (!text) return ''
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
      p.startsWith('**') ? <strong key={`bold-${i}`} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong> : p
    )
  }

  const renderMarkdown = (text) => {
    if (!text) return null
    const lines = text.split('\n')
    const elements = []
    let listItems = []
    let inList = false
    let inTable = false
    let rawTableLines = []

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} style={{ margin: '6px 0', paddingLeft: '18px', listStyleType: 'disc' }}>
            {listItems}
          </ul>
        )
        listItems = []
      }
      inList = false
    }

    const flushTable = (key) => {
      if (rawTableLines.length > 0) {
        const parsedRows = rawTableLines
          .map(line => line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1))
          .filter(row => row.length > 0 && !row.every(c => /^[-:]+$/.test(c)))

        if (parsedRows.length > 0) {
          const headerRow = parsedRows[0]
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
              <div key={`table-${key}`} style={{ margin: '10px 0', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {headers.map((h, hIdx) => (
                          <th key={`th-${hIdx}-${h}`} style={{ padding: '8px 10px', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {renderInlineBold(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, rIdx) => (
                        <tr key={`row-${rIdx}`} style={{ borderBottom: rIdx === dataRows.length - 1 ? 'none' : '1px solid #f1f5f9', background: rIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          {row.map((cell, cIdx) => (
                            <td key={`cell-${rIdx}-${cIdx}`} style={{ padding: '7px 10px', color: '#334155', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
      if (trimmed.startsWith('|')) {
        if (inList) flushList(idx)
        inTable = true
        rawTableLines.push(trimmed)
        return
      } else if (inTable) {
        flushTable(idx)
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true
        listItems.push(
          <li key={`li-${idx}`} style={{ fontSize: '0.84rem', color: '#374151', margin: '3px 0', lineHeight: 1.45 }}>
            {renderInlineBold(trimmed.slice(2))}
          </li>
        )
        return
      } else if (inList) {
        flushList(idx)
      }

      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={idx} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '10px 0 6px', color: '#111827' }}>{trimmed.slice(2)}</h1>)
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={idx} style={{ fontSize: '1.05rem', fontWeight: 600, margin: '8px 0 4px', color: '#111827' }}>{trimmed.slice(3)}</h2>)
      } else if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={idx} style={{ fontSize: '0.92rem', fontWeight: 600, margin: '8px 0 4px', color: '#111827' }}>{trimmed.slice(4)}</h3>)
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={idx} style={{ borderLeft: '3px solid #e2e8f0', paddingLeft: '10px', color: '#64748b', margin: '8px 0', fontStyle: 'italic' }}>
            {renderInlineBold(trimmed.slice(2))}
          </blockquote>
        )
      } else if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '6px' }} />)
      } else {
        elements.push(
          <div key={idx} style={{ margin: '3px 0', fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
            {renderInlineBold(line)}
          </div>
        )
      }
    })

    if (inList) flushList('end')
    if (inTable) flushTable('end')
    return elements
  }

  return (
    <>
      {/* ── Backdrop Click to Close ── */}
      <div 
        className={`ws-ai-drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => dispatch(setChatOpen(false))}
        aria-hidden="true"
      />

      {/* ── Sliding AI Drawer Panel ── */}
      <div className={`ws-ai-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="ws-ai-drawer-header">
          <div className="ws-ai-drawer-header-left">
            <div className="ws-ai-drawer-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="ws-ai-drawer-title">Workshop AI</div>
              <div className="ws-ai-drawer-status">
                <span className="ws-ai-status-dot" />
                <span>Assistant Ready</span>
              </div>
            </div>
          </div>

          <div className="ws-ai-drawer-header-actions">
            <button
              type="button"
              className="ws-ai-action-btn"
              onClick={handleNewChat}
              title="Start New Chat"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="ws-ai-action-btn"
              onClick={handleOpenFull}
              title="Open Full Page View"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              className="ws-ai-action-btn"
              onClick={() => dispatch(setChatOpen(false))}
              title="Close Assistant"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Message Body */}
        <div className="ws-ai-drawer-messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ws-ai-empty-state">
              <div className="ws-ai-empty-icon">
                <Sparkles size={24} />
              </div>
              <div className="ws-ai-empty-title">How can I help you today?</div>
              <div className="ws-ai-empty-subtitle">
                Ask anything about your invoices, inventory, quotations, customers, or reports.
              </div>

              <div className="ws-ai-suggestions-list">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    className="ws-ai-suggestion-chip"
                    onClick={() => handleSend(sug)}
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`ws-ai-msg ${m.role}`}>
                <div className="ws-ai-msg-bubble">
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
                <div className="ws-ai-msg-time">{m.time}</div>
              </div>
            ))
          )}

          {loading && (
            <div className="ws-ai-thinking">
              <Loader2 size={14} className="ws-chat-loader-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Workshop AI is thinking</span>
              <div className="ws-ai-typing-dot" />
              <div className="ws-ai-typing-dot" />
              <div className="ws-ai-typing-dot" />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="ws-ai-drawer-footer">
          <div className="ws-ai-input-wrap">
            <textarea
              ref={inputRef}
              className="ws-ai-textarea"
              placeholder="Ask Workshop AI anything..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="ws-ai-send-btn"
              disabled={loading || !input.trim()}
              onClick={() => handleSend()}
              title="Send message"
            >
              {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
