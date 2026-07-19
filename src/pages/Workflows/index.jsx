import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import api from '../../api/client'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import {
  GitBranch, HelpCircle, Search, Plus, Star, Filter,
  SlidersHorizontal, ChevronRight, MoreHorizontal, Grid,
  RefreshCw, Download, Layers, Zap, Calendar, AlertCircle,
  Settings, ArrowLeft, Play, Pause, Trash2
} from 'lucide-react'
import './Workflows.css'
import ConfirmModal from '../../components/ui/ConfirmModal'

/* ─── Trigger data ─── */
const TRIGGER_CATEGORIES = [
  {
    label: 'Records',
    items: [
      { id: 'record-command', name: 'Record command' },
      { id: 'record-created',  name: 'Record created' },
      { id: 'record-updated',  name: 'Record updated' },
    ]
  },
  {
    label: 'Lists',
    items: [
      { id: 'list-entry-command', name: 'List entry command' },
      { id: 'list-entry-updated', name: 'List entry updated' },
    ]
  }
]

/* ─── Main Export ─── */
export default function Workflows() {
  const dispatch    = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [view,            setView]            = useState('list') // 'list' | 'editor'
  const [workflows,       setWorkflows]       = useState([])
  const [currentWf,       setCurrentWf]       = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [confirmDelete,   setConfirmDelete]   = useState({ isOpen: false, id: null, name: '' })

  // Editor state
  const [wfName,          setWfName]          = useState('Untitled Workflow')
  const [isPublished,     setIsPublished]     = useState(false)
  const [activeTab,       setActiveTab]       = useState('editor')
  const [triggerSearch,   setTriggerSearch]   = useState('')
  const [selectedTrigger, setSelectedTrigger] = useState(null)
  const [zoom,            setZoom]            = useState(100)

  useEffect(() => {
    dispatch(setActiveNav('Workflows'))
    fetchWorkflows()
  }, [dispatch])

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const res = await api.get('/workflows')
      setWorkflows(res.data || [])
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleConfirmDelete = async () => {
    const { id } = confirmDelete
    setConfirmDelete({ isOpen: false, id: null, name: '' })
    try {
      await api.delete(`/workflows/${id}`)
      setWorkflows(prev => prev.filter(w => w.id !== id))
      dispatch(addToast({ message: 'Workflow deleted successfully!', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Could not delete workflow', type: 'error' }))
    }
  }


  /* ── Open existing workflow ── */
  const openWorkflow = (wf) => {
    setCurrentWf(wf)
    setWfName(wf.name)
    setIsPublished(!!wf.is_live)
    setSelectedTrigger(null)
    setActiveTab('editor')
    setView('editor')
  }

  /* ── Create new workflow ── */
  const handleNewWorkflow = async () => {
    try {
      const res = await api.post('/workflows', { name: 'Untitled Workflow' })
      setCurrentWf(res.data)
      setWfName('Untitled Workflow')
      setIsPublished(false)
      setSelectedTrigger(null)
      setActiveTab('editor')
      setView('editor')
    } catch {
      dispatch(addToast({ message: 'Could not create workflow', type: 'error' }))
    }
  }

  /* ── Publish ── */
  const handlePublish = async () => {
    if (!currentWf) return
    try {
      await api.put(`/workflows/${currentWf.id}`, { is_live: true, name: wfName })
      setIsPublished(true)
      setWorkflows(prev => prev.map(w => w.id === currentWf.id ? { ...w, is_live: true, name: wfName } : w))
      dispatch(addToast({ message: 'Workflow published!', type: 'success' }))
    } catch {
      dispatch(addToast({ message: 'Could not publish', type: 'error' }))
    }
  }

  /* ── Save name ── */
  const saveName = async (name) => {
    if (!currentWf || !name.trim()) return
    try {
      await api.put(`/workflows/${currentWf.id}`, { name })
      setWorkflows(prev => prev.map(w => w.id === currentWf.id ? { ...w, name } : w))
    } catch { /* silent */ }
  }

  /* ── Helpers ── */
  const getUserInfo = () => {
    try { return JSON.parse(sessionStorage.getItem('ws_user') || '{}') } catch { return {} }
  }
  const userInfo = getUserInfo()
  const initials = (userInfo.shopName || 'AB').slice(0, 2).toUpperCase()

  const statusBadge = (wf) => {
    if (wf.is_live) return { label: 'Live',   cls: 'live' }
    const hasNodes = (wf.nodes || []).length > 0
    return hasNodes
      ? { label: 'Paused', cls: 'paused' }
      : { label: 'Draft',  cls: 'draft' }
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return '—' }
  }

  /* ── Filtered triggers ── */
  const filteredCategories = TRIGGER_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(t =>
      !triggerSearch || t.name.toLowerCase().includes(triggerSearch.toLowerCase())
    )
  })).filter(c => c.items.length > 0)

  /* ─────────────────────────────────────────────────
     EDITOR VIEW
  ───────────────────────────────────────────────── */
  if (view === 'editor') {
    return (
      <div className="ws-dash-layout">
        <Sidebar />
        <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <WorkflowEditor
            wfName={wfName}           setWfName={setWfName}
            isPublished={isPublished}
            activeTab={activeTab}     setActiveTab={setActiveTab}
            triggerSearch={triggerSearch} setTriggerSearch={setTriggerSearch}
            selectedTrigger={selectedTrigger} setSelectedTrigger={setSelectedTrigger}
            filteredCategories={filteredCategories}
            zoom={zoom}               setZoom={setZoom}
            initials={initials}
            onBack={() => { setView('list'); fetchWorkflows() }}
            onPublish={handlePublish}
            onSaveName={saveName}
          />
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────────────────
     LIST VIEW
  ───────────────────────────────────────────────── */
  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-wfl-main">
          {loading ? (
            <div className="ws-wfl-center"><div className="ws-wfl-spin" /></div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="ws-wfl-toolbar">
                <div className="ws-wfl-toolbar-left">
                  <button className="ws-wfl-sort-btn">
                    <SlidersHorizontal size={12} />
                    Sorted by <strong>Last published</strong>
                  </button>
                  <button className="ws-wfl-filter-btn">
                    <Filter size={12} />
                    Filter
                  </button>
                </div>
                <div className="ws-wfl-toolbar-right">
                  <button className="ws-wfl-icon-btn" title="Search"><Search size={14} /></button>
                  <button className="ws-wfl-icon-btn ws-wfl-icon-btn--text">
                    <Grid size={13} />
                    View settings
                  </button>
                  <button className="ws-wfl-new-btn" onClick={handleNewWorkflow}>
                    <Plus size={14} />
                    New workflow
                  </button>
                </div>
              </div>

              {/* Favorites section */}
              <div className="ws-wfl-favorites">
                <div className="ws-wfl-section-label">
                  <Star size={13} className="ws-wfl-star-label" />
                  Favorites
                </div>
                <div className="ws-wfl-fav-empty">
                  <p className="ws-wfl-fav-title">Favorites</p>
                  <p className="ws-wfl-fav-desc">Workflows that you favorite will appear here</p>
                </div>
              </div>

              {/* Table */}
              <div className="ws-wfl-table-wrap">
                <table className="ws-wfl-table">
                  <thead>
                    <tr className="ws-wfl-thead-row">
                      <th className="ws-wfl-th ws-wfl-th--name">Workflow</th>
                      <th className="ws-wfl-th ws-wfl-th--center">Runs</th>
                      <th className="ws-wfl-th">Status</th>
                      <th className="ws-wfl-th">Created by</th>
                      <th className="ws-wfl-th">Last published</th>
                      <th className="ws-wfl-th">Last failed run</th>
                      <th className="ws-wfl-th" style={{ textAlign: 'right', width: 60 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.length > 0 && (
                      <tr className="ws-wfl-group-hdr">
                        <td colSpan={7}>
                          <span className="ws-wfl-group-name">Unpublished</span>
                          <span className="ws-wfl-group-count">{workflows.length}</span>
                        </td>
                      </tr>
                    )}
                    {workflows.map(wf => {
                      const badge = statusBadge(wf)
                      return (
                        <tr key={wf.id} className="ws-wfl-tr" onClick={() => openWorkflow(wf)}>
                          <td className="ws-wfl-td ws-wfl-td--name">
                            <button
                              className="ws-wfl-row-star"
                              onClick={e => e.stopPropagation()}
                              title="Favorite"
                            >
                              <Star size={12} />
                            </button>
                            <div className="ws-wfl-wf-icon">
                              <GitBranch size={12} />
                            </div>
                            <span className="ws-wfl-wf-name">{wf.name}</span>
                          </td>
                          <td className="ws-wfl-td ws-wfl-td--center">
                            <span className="ws-wfl-runs">0</span>
                          </td>
                          <td className="ws-wfl-td">
                            <span className={`ws-wfl-badge ws-wfl-badge--${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="ws-wfl-td">
                            <div className="ws-wfl-creator">
                              <div className="ws-wfl-creator-av">{initials}</div>
                              <span>Akash Busetty</span>
                            </div>
                          </td>
                          <td className="ws-wfl-td ws-wfl-td--muted">
                            {wf.is_live ? fmtDate(wf.updated_at) : '—'}
                          </td>
                          <td className="ws-wfl-td ws-wfl-td--muted">—</td>
                          <td className="ws-wfl-td" style={{ textAlign: 'right' }}>
                            <button
                              className="ws-chat-history-delete-btn"
                              style={{ padding: 6, color: '#ef4444' }}
                              onClick={e => {
                                e.stopPropagation()
                                e.preventDefault()
                                setConfirmDelete({ isOpen: true, id: wf.id, name: wf.name })
                              }}
                              title="Delete Workflow"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {workflows.length === 0 && (
                  <div className="ws-wfl-empty-state">
                    <GitBranch size={28} className="ws-wfl-empty-icon" />
                    <p className="ws-wfl-empty-title">No workflows yet</p>
                    <p className="ws-wfl-empty-desc">Create your first workflow to automate your business</p>
                    <button className="ws-wfl-new-btn" onClick={handleNewWorkflow}>
                      <Plus size={13} /> New workflow
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Workflow"
        message={`Are you sure you want to delete workflow "${confirmDelete.name}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   WORKFLOW EDITOR COMPONENT
───────────────────────────────────────────────────────────── */
function WorkflowEditor({
  wfName, setWfName, isPublished,
  activeTab, setActiveTab,
  triggerSearch, setTriggerSearch,
  selectedTrigger, setSelectedTrigger, filteredCategories,
  zoom, setZoom, initials,
  onBack, onPublish, onSaveName
}) {
  const [editingName, setEditingName] = useState(false)
  const [tempName,    setTempName]    = useState(wfName)
  const nameRef = useRef(null)

  const saveName = () => {
    const n = tempName.trim() || 'Untitled Workflow'
    setWfName(n)
    onSaveName(n)
    setEditingName(false)
  }

  return (
    <div className="ws-wfe-root">

      {/* ── Top bar ── */}
      <header className="ws-wfe-header">
        <div className="ws-wfe-header-left">
          <button className="ws-wfe-back" onClick={onBack}>
            <GitBranch size={12} />
            <span>Workflows</span>
          </button>
          <span className="ws-wfe-sep">/</span>

          {editingName ? (
            <input
              ref={nameRef}
              className="ws-wfe-name-input"
              value={tempName}
              autoFocus
              onChange={e => setTempName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
          ) : (
            <button
              className="ws-wfe-name-btn"
              onClick={() => { setEditingName(true); setTempName(wfName) }}
            >
              {wfName}
            </button>
          )}
          <button className="ws-wfe-star-btn" title="Favorite"><Star size={13} /></button>
        </div>

        <div className="ws-wfe-header-right">
          <div className="ws-wfe-avatar">{initials}</div>
          <button className="ws-wfe-share-btn">Share</button>
          <button className="ws-wfe-help-btn" title="Help"><HelpCircle size={15} /></button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="ws-wfe-tabbar">
        <div className="ws-wfe-tabs">
          {[
            { id: 'editor',   label: 'Editor',   icon: <Settings size={12} /> },
            { id: 'runs',     label: 'Runs',     icon: <RefreshCw size={12} />, badge: '0' },
            { id: 'settings', label: 'Settings', icon: <Layers size={12} /> },
          ].map(t => (
            <button
              key={t.id}
              className={`ws-wfe-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && <span className="ws-wfe-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="ws-wfe-tabbar-right">
          <span className={`ws-wfe-status-chip ${isPublished ? 'live' : 'draft'}`}>
            {isPublished ? 'Live' : 'Draft'}
          </span>
          <label className="ws-wfe-toggle">
            <input type="checkbox" checked={isPublished} onChange={onPublish} readOnly />
            <span className="ws-wfe-toggle-track">
              <span className="ws-wfe-toggle-thumb" />
            </span>
          </label>
        </div>
      </div>

      {/* ── Banner ── */}
      {!isPublished && (
        <div className="ws-wfe-banner">
          <div className="ws-wfe-banner-left">
            <AlertCircle size={13} />
            <span>This workflow has not yet been published</span>
          </div>
          <button className="ws-wfe-publish-btn" onClick={onPublish}>
            Publish workflow
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="ws-wfe-body">

        {/* Canvas */}
        <div className="ws-wfe-canvas">
          <div className="ws-wfe-canvas-inner">
            {selectedTrigger ? (
              <div className="ws-wfe-node-card">
                <div className="ws-wfe-node-icon-wrap">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="ws-wfe-node-type">Trigger</div>
                  <div className="ws-wfe-node-name">{selectedTrigger.name}</div>
                </div>
              </div>
            ) : (
              <div className="ws-wfe-canvas-empty">
                <div className="ws-wfe-trigger-placeholder">
                  <Zap size={16} className="ws-wfe-placeholder-zap" />
                  <span>Set a trigger in the sidebar</span>
                </div>
                <div className="ws-wfe-or-row">
                  <span className="ws-wfe-or-line" />
                  <span className="ws-wfe-or-text">OR</span>
                  <span className="ws-wfe-or-line" />
                </div>
                <button className="ws-wfe-template-btn">
                  <Calendar size={13} />
                  Start with a template
                </button>
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div className="ws-wfe-zoom">
            <button className="ws-wfe-zoom-btn">
              <Search size={12} />
              <span>{zoom}%</span>
              <ChevronRight size={10} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <div className="ws-wfe-zoom-sep" />
            <button className="ws-wfe-zoom-icon" title="Refresh" onClick={() => setZoom(100)}><RefreshCw size={13} /></button>
            <button className="ws-wfe-zoom-icon" title="Download"><Download size={13} /></button>
            <button className="ws-wfe-zoom-icon" title="Layers"><Layers size={13} /></button>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="ws-wfe-sidebar">
          <div className="ws-wfe-sb-header">
            <h3 className="ws-wfe-sb-title">Select trigger</h3>
            <p className="ws-wfe-sb-subtitle">Pick an event to start this workflow</p>
          </div>

          <div className="ws-wfe-sb-search">
            <Search size={13} className="ws-wfe-sb-search-icon" />
            <input
              className="ws-wfe-sb-search-input"
              placeholder="Search triggers..."
              value={triggerSearch}
              onChange={e => setTriggerSearch(e.target.value)}
            />
          </div>

          <div className="ws-wfe-trigger-list">
            {filteredCategories.map(cat => (
              <div key={cat.label} className="ws-wfe-trigger-group">
                <div className="ws-wfe-trigger-cat">{cat.label}</div>
                {cat.items.map(t => (
                  <button
                    key={t.id}
                    className={`ws-wfe-trigger-item ${selectedTrigger?.id === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTrigger(selectedTrigger?.id === t.id ? null : t)}
                  >
                    <div className="ws-wfe-trigger-icon">
                      <GitBranch size={11} />
                    </div>
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            ))}

            {/* Helpful resources */}
            <div className="ws-wfe-trigger-cat" style={{ marginTop: 20 }}>Helpful resources</div>
            <div className="ws-wfe-resources">
              <button className="ws-wfe-resource-card">
                <div className="ws-wfe-resource-emoji">📄</div>
                <div>
                  <div className="ws-wfe-resource-name">Documentation</div>
                  <div className="ws-wfe-resource-desc">Find out how to best set up workflows</div>
                </div>
              </button>
              <button className="ws-wfe-resource-card">
                <div className="ws-wfe-resource-emoji">📋</div>
                <div>
                  <div className="ws-wfe-resource-name">Templates</div>
                  <div className="ws-wfe-resource-desc">Get started with ready-made templates</div>
                </div>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
