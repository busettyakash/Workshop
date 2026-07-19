import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { FileText, Plus, Search, Trash2, Edit3, Loader2, StickyNote, Paperclip, X } from 'lucide-react'
import api from '../../api/client'
import '../Dashboard/Dashboard.css'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Notes() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editAttachName, setEditAttachName] = useState(null)
  const [editAttachData, setEditAttachData] = useState(null)
  const [saving, setSaving] = useState(false)

  // New note state
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newAttachName, setNewAttachName] = useState(null)
  const [newAttachData, setNewAttachData] = useState(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    dispatch(setActiveNav('Notes'))
    fetchNotes()
  }, [dispatch])

  const fetchNotes = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.get(`/notes${q ? `?search=${encodeURIComponent(q)}` : ''}`)
      const data = res.data?.data || []
      setNotes(data)
      // Keep selection in sync
      if (selected) {
        const updated = data.find(n => n.id === selected.id)
        setSelected(updated || data[0] || null)
      } else {
        setSelected(data[0] || null)
      }
    } catch {
      dispatch(addToast({ message: 'Failed to load notes', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchNotes(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const handleSelect = (note) => {
    setSelected(note)
    setEditing(false)
  }

  const handleEdit = () => {
    setEditTitle(selected.title)
    setEditBody(selected.body || '')
    setEditAttachName(selected.attachment_name || null)
    setEditAttachData(selected.attachment_data || null)
    setEditing(true)
  }

  const handleFileChange = (e, mode) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (mode === 'new') {
        setNewAttachName(file.name)
        setNewAttachData(reader.result)
      } else {
        setEditAttachName(file.name)
        setEditAttachData(reader.result)
      }
      dispatch(addToast({ message: `Attached: ${file.name}`, type: 'success' }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return
    setSaving(true)
    try {
      const res = await api.put(`/notes/${selected.id}`, {
        title: editTitle,
        body: editBody,
        attachment_name: editAttachName,
        attachment_data: editAttachData
      })
      const updated = res.data
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      setSelected(updated)
      setEditing(false)
      dispatch(addToast({ message: 'Note updated', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Failed to update note', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notes/${id}`)
      const updated = notes.filter(n => n.id !== id)
      setNotes(updated)
      setSelected(updated[0] || null)
      setEditing(false)
      dispatch(addToast({ message: 'Note deleted', type: 'info' }))
    } catch {
      dispatch(addToast({ message: 'Failed to delete note', type: 'error' }))
    }
  }

  const handleAddNote = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/notes', {
        title: newTitle,
        body: newBody,
        attachment_name: newAttachName,
        attachment_data: newAttachData
      })
      const note = res.data
      setNotes(prev => [note, ...prev])
      setSelected(note)
      setNewTitle('')
      setNewBody('')
      setNewAttachName(null)
      setNewAttachData(null)
      setShowNew(false)
      dispatch(addToast({ message: 'Note created', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Failed to create note', type: 'error' }))
    } finally {
      setCreating(false)
    }
  }

  const filtered = search ? notes : notes

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body" style={{ padding: 0, display: 'flex', overflow: 'hidden', flex: 1, minHeight: 0 }}>

          {/* ── Left panel: notes list ── */}
          <div style={{
            width: 280, flexShrink: 0,
            borderRight: '1px solid #e5e7eb',
            display: 'flex', flexDirection: 'column',
            background: '#fff', height: '100%', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '18px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: 0 }}>Notes</h1>
                <button
                  onClick={() => { setShowNew(true); setEditing(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={13} /> New
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 10px' }}>
                <Search size={13} style={{ color: '#9ca3af' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search notes…"
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.82rem', color: '#374151', width: '100%' }}
                />
              </div>
            </div>

            {/* New note inline form */}
            {showNew && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#f8faff' }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Note title"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.83rem', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
                />
                <textarea
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  placeholder="Write your note…"
                  rows={3}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.82rem', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 6 }}
                />

                {/* Attachment info in Form */}
                {newAttachName ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'center', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 5, fontSize: '0.72rem', marginBottom: 8 }}>
                    <Paperclip size={10} style={{ marginRight: 4 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newAttachName}</span>
                    <button onClick={() => { setNewAttachName(null); setNewAttachData(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', display: 'flex' }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyCenter: 'center', width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', flexShrink: 0, paddingLeft: 6 }}>
                    <input type="file" onChange={e => handleFileChange(e, 'new')} style={{ display: 'none' }} />
                    <Paperclip size={13} style={{ color: '#6b7280' }} />
                  </label>

                  <button
                    onClick={handleAddNote}
                    disabled={creating || !newTitle.trim()}
                    style={{ flex: 1, padding: '5px 0', background: creating ? '#6b7280' : '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    {creating ? <Loader2 size={12} className="ws-chat-loader-spin" /> : null}
                    Save
                  </button>
                  <button onClick={() => { setShowNew(false); setNewTitle(''); setNewBody(''); setNewAttachName(null); setNewAttachData(null) }} style={{ flex: 1, padding: '5px 0', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={20} className="ws-chat-loader-spin" style={{ color: '#9ca3af' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  <p style={{ fontSize: '0.82rem', margin: 0 }}>{search ? 'No notes match your search' : 'No notes yet. Create one!'}</p>
                </div>
              ) : (
                filtered.map(note => (
                  <div
                    key={note.id}
                    onClick={() => handleSelect(note)}
                    style={{
                      padding: '10px 16px', cursor: 'pointer',
                      background: selected?.id === note.id ? '#f0f4ff' : 'transparent',
                      borderLeft: selected?.id === note.id ? '2px solid #3d68f5' : '2px solid transparent',
                      borderBottom: '1px solid #f9fafb',
                      transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => { if (selected?.id !== note.id) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { if (selected?.id !== note.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ fontSize: '0.845rem', fontWeight: 600, color: '#111827', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</div>
                    {note.body && (
                      <div style={{ fontSize: '0.76rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{note.body}</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{timeAgo(note.updated_at)}</div>
                      {note.attachment_name && (
                        <Paperclip size={10} style={{ color: '#9ca3af' }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: note detail / editor ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fff' }}>
            {selected ? (
              <>
                {/* Detail header */}
                <div style={{ padding: '18px 28px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  {editing ? (
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', border: 'none', outline: 'none', flex: 1 }}
                    />
                  ) : (
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>{selected.title}</h2>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    {editing ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                        >
                          {saving ? <Loader2 size={12} className="ws-chat-loader-spin" /> : null}
                          Save
                        </button>
                        <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: '0.8rem', color: '#374151', cursor: 'pointer' }}>
                          <Edit3 size={13} /> Edit
                        </button>
                        <button onClick={() => handleDelete(selected.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, fontSize: '0.8rem', color: '#e11d48', cursor: 'pointer' }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Note body */}
                <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginBottom: 18 }}>
                    Last edited {timeAgo(selected.updated_at)}
                  </div>
                  {editing ? (
                    <>
                      <textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        style={{ width: '100%', minHeight: 280, border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px', fontSize: '0.9rem', color: '#374151', lineHeight: 1.75, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
                      />

                      {/* Editing Attachment selection */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
                          <input type="file" onChange={e => handleFileChange(e, 'edit')} style={{ display: 'none' }} />
                          <Paperclip size={13} /> Attach File
                        </label>

                        {editAttachName ? (
                          <div style={{ display: 'flex', alignItems: 'center', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 5, fontSize: '0.76rem' }}>
                            <span style={{ marginRight: 6 }}>{editAttachName}</span>
                            <button onClick={() => { setEditAttachName(null); setEditAttachData(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', display: 'flex' }}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: '0.9rem', color: selected.body ? '#374151' : '#9ca3af', fontStyle: selected.body ? 'normal' : 'italic', lineHeight: 1.75, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
                        {selected.body || 'No content. Click Edit to add some.'}
                      </p>

                      {/* Display attachment */}
                      {selected.attachment_name && selected.attachment_data ? (
                        <div style={{ marginTop: 24, padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400 }}>
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
                    </>
                  )}
                </div>
              </>
            ) : !loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <FileText size={40} style={{ marginBottom: 12, opacity: 0.35 }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Select a note or create a new one</p>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
