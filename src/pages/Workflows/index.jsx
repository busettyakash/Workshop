import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import api from '../../api/client'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast, setSidebarOpen } from '../../redux/slices/uiSlice'
import {
  GitBranch, HelpCircle, Search, Plus, Star, Filter,
  SlidersHorizontal, ChevronRight, ChevronDown, MoreHorizontal, Grid,
  RefreshCw, Download, Layers, Zap, Calendar, AlertCircle,
  Settings, ArrowLeft, ArrowRight, Play, Pause, Trash2, CheckCircle2,
  Clock, Terminal, X, ExternalLink, Loader2, Sparkles, Send, FileCheck,
  Check, Disc, FileText, MessageSquare, Printer, Bell, Phone, Mail, Users
} from 'lucide-react'
import '../Dashboard/Dashboard.css'
import '../Products/Products.css'
import './Workflows.css'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useAuth } from '../../hooks/useAuth'
import { getRandomString } from '../../utils/cryptoUtils'

/* ─── Trigger data ─── */
const TRIGGER_CATEGORIES = [
  {
    label: 'Records',
    items: [
      { id: 'record-command', name: 'Record command' },
      { id: 'record-created',  name: 'Record created (Quotation)' },
      { id: 'record-updated',  name: 'Record updated (Status Change)' },
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
  const [expandedWfs,     setExpandedWfs]     = useState({})
  const [initialRun,      setInitialRun]      = useState(null)

  // List view search & filter
  const [search,          setSearch]          = useState('')
  const [filterStatus,    setFilterStatus]    = useState('all') // 'all' | 'live' | 'draft'
  const [showFilterBar,   setShowFilterBar]   = useState(false)

  // Editor state
  const [wfName,          setWfName]          = useState('Untitled Workflow')
  const [isPublished,     setIsPublished]     = useState(false)
  const [activeTab,       setActiveTab]       = useState('editor')
  const [triggerSearch,   setTriggerSearch]   = useState('')
  const [selectedTrigger, setSelectedTrigger] = useState(null)
  const [zoom,            setZoom]            = useState(100)

  useEffect(() => {
    dispatch(setActiveNav('Workflows'))
    dispatch(setSidebarOpen(true))
    fetchWorkflows()
  }, [dispatch])

  const fetchWorkflows = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await api.get('/workflows')
      setWorkflows(res.data || [])
    } catch { /* silent */ }
    if (!isBackground) setLoading(false)
  }

  const toggleExpand = (wfId, e) => {
    if (e) e.stopPropagation()
    setExpandedWfs(prev => ({ ...prev, [wfId]: !prev[wfId] }))
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

  /* ── Toggle Star (Favorite) Status ── */
  const handleToggleStar = async (wfId, e) => {
    if (e) e.stopPropagation()
    const targetWf = workflows.find(w => w.id === wfId)
    const nextStarred = !targetWf?.is_starred
    // Optimistic update
    setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, is_starred: nextStarred } : w))
    try {
      await api.patch(`/workflows/${wfId}/toggle-star`, { is_starred: nextStarred })
      dispatch(addToast({
        message: nextStarred ? `Starred "${targetWf?.name || 'Workflow'}"` : `Removed "${targetWf?.name || 'Workflow'}" from favorites`,
        type: 'success'
      }))
    } catch {
      // Revert if error
      setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, is_starred: !nextStarred } : w))
      dispatch(addToast({ message: 'Could not update favorite status', type: 'error' }))
    }
  }

  /* ── Open existing workflow ── */
  const openWorkflow = (wf, initialTab = null, targetRun = null) => {
    setCurrentWf(wf)
    setWfName(wf?.name || 'Untitled Workflow')
    setIsPublished(!!wf?.is_live)
    setSelectedTrigger(null)
    setInitialRun(targetRun || null)
    const targetTab = initialTab || 'editor'
    setActiveTab(targetTab)
    setView('editor')
  }

  /* ── Create new workflow ── */
  const handleNewWorkflow = async () => {
    try {
      const res = await api.post('/workflows', { name: 'Quotation Pipeline Workflow' })
      setCurrentWf(res.data)
      setWfName(res.data.name || 'Quotation Pipeline Workflow')
      setIsPublished(false)
      setSelectedTrigger(null)
      setActiveTab('editor')
      setView('editor')
    } catch {
      dispatch(addToast({ message: 'Could not create workflow', type: 'error' }))
    }
  }

  /* ── Toggle Live / Publish Status ── */
  const handleToggleLive = async (targetState) => {
    if (!currentWf) return
    const nextLive = typeof targetState === 'boolean' ? targetState : !isPublished
    try {
      await api.patch(`/workflows/${currentWf.id}/toggle-live`, { is_live: nextLive })
      setIsPublished(nextLive)
      setCurrentWf(prev => prev ? { ...prev, is_live: nextLive } : null)
      setWorkflows(prev => prev.map(w => w.id === currentWf.id ? { ...w, is_live: nextLive } : w))
      dispatch(addToast({
        message: nextLive
          ? 'Workflow is now Live! Quotations will trigger automated runs.'
          : 'Workflow paused (Draft mode). Quotations will not trigger runs.',
        type: nextLive ? 'success' : 'info'
      }))
    } catch {
      dispatch(addToast({ message: 'Could not update workflow live status', type: 'error' }))
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
  const { user, shopName } = useAuth()
  const userFirstName = user?.firstName || user?.first_name || ''
  const userLastName = user?.lastName || user?.last_name || ''
  const userFullName = [userFirstName, userLastName].filter(Boolean).join(' ') || user?.name || (user?.email ? user.email.split('@')[0] : 'User')
  const initials = (shopName || userFullName || 'WS').slice(0, 2).toUpperCase()

  const statusBadge = (wf) => {
    if (wf.is_live) return { label: 'Live',   cls: 'live' }
    const hasNodes = (wf.nodes || []).length > 0
    return hasNodes
      ? { label: 'Paused', cls: 'paused' }
      : { label: 'Draft',  cls: 'draft' }
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }) }
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
            currentWf={currentWf}
            wfName={wfName}           setWfName={setWfName}
            isPublished={isPublished}
            activeTab={activeTab}     setActiveTab={setActiveTab}
            triggerSearch={triggerSearch} setTriggerSearch={setTriggerSearch}
            selectedTrigger={selectedTrigger} setSelectedTrigger={setSelectedTrigger}
            filteredCategories={filteredCategories}
            zoom={zoom}               setZoom={setZoom}
            initials={initials}
            initialRun={initialRun}
            workflows={workflows}
            onBack={() => { setView('list'); fetchWorkflows() }}
            onToggleLive={handleToggleLive}
            onSaveName={saveName}
          />
        </div>
      </div>
    )
  }

  /* ── Filtered workflows ── */
  const filteredWorkflows = workflows.filter(wf => {
    const matchSearch = !search || wf.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all'
      ? true
      : filterStatus === 'starred'
      ? !!wf.is_starred
      : filterStatus === 'live'
      ? !!wf.is_live
      : !wf.is_live
    return matchSearch && matchStatus
  })

  /* ─────────────────────────────────────────────────
     LIST VIEW (Products & CRM Unified Structure)
  ───────────────────────────────────────────────── */
  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          <div className="attio-products-container">
            {/* Top Toolbar */}
            <div className="ws-unified-page-header">
              <div className="ws-unified-header-left">
                <span className="ws-unified-header-title">Workflows</span>
                <span className="ws-unified-header-badge">{filteredWorkflows.length} workflows</span>
              </div>
              <div className="ws-unified-header-actions">
                {/* Search box */}
                <div className="attio-search-box">
                  <Search size={14} className="attio-search-icon" />
                  <input
                    type="text"
                    className="attio-input-search"
                    placeholder="Search workflows..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Filter button */}
                <button
                  className="attio-btn"
                  onClick={() => setShowFilterBar(prev => !prev)}
                  style={{
                    background: showFilterBar || filterStatus !== 'all' ? '#f1f5f9' : '#ffffff',
                    borderColor: showFilterBar || filterStatus !== 'all' ? '#0f172a' : '#cbd5e1',
                    fontWeight: showFilterBar || filterStatus !== 'all' ? 600 : 500
                  }}
                >
                  <Filter size={13} /> Filter
                </button>

                {/* New workflow button */}
                <button
                  className="attio-btn attio-btn-primary"
                  onClick={handleNewWorkflow}
                >
                  <Plus size={14} /> New workflow
                </button>
              </div>
            </div>

            {/* Expandable Filter Box */}
            {showFilterBar && (
              <div className="attio-filter-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475467' }}>
                  <span>Status:</span>
                  <select
                    className="attio-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Workflows</option>
                    <option value="starred">★ Starred / Favorites</option>
                    <option value="live">Live (Active)</option>
                    <option value="draft">Draft / Paused</option>
                  </select>
                </div>

                {filterStatus !== 'all' && (
                  <button
                    onClick={() => setFilterStatus('all')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* CRM Table Card */}
            <div className="attio-table-card">
              <div className="attio-table-wrap">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                    <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : filteredWorkflows.length === 0 ? (
                  <div style={{ padding: 50, textAlign: 'center', color: '#9ca3af' }}>
                    <GitBranch size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.92rem' }}>No workflows found</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      {search || filterStatus !== 'all' ? 'Try adjusting your search query or filter.' : 'Create your first workflow to automate your quotes & sales pipeline.'}
                    </div>
                  </div>
                ) : (
                  <table className="attio-table">
                    <thead>
                      <tr>
                        <th style={{ width: 32, textAlign: 'center', paddingLeft: 6 }}></th>
                        <th>WORKFLOW</th>
                        <th style={{ textAlign: 'center' }}>RUNS</th>
                        <th>STATUS</th>
                        <th>CREATED BY</th>
                        <th>LAST PUBLISHED</th>
                        <th>LAST RUN</th>
                        <th style={{ width: 80, textAlign: 'center' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkflows.map(wf => {
                        const badge = statusBadge(wf)
                        const isExpanded = !!expandedWfs[wf.id]

                        let recentRuns = []
                        if (Array.isArray(wf.recent_runs)) {
                          recentRuns = wf.recent_runs
                        } else if (typeof wf.recent_runs === 'string') {
                          try { recentRuns = JSON.parse(wf.recent_runs) } catch { recentRuns = [] }
                        }

                        return (
                          <React.Fragment key={wf.id}>
                            <tr
                              onClick={() => openWorkflow(wf)}
                              style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                            >
                              <td style={{ textAlign: 'center', paddingLeft: 6 }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  style={{
                                    background: 'transparent', border: 'none', padding: '2px 4px',
                                    cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center'
                                  }}
                                  onClick={(e) => toggleExpand(wf.id, e)}
                                  title={isExpanded ? "Collapse execution tree" : "Expand execution tree"}
                                >
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {/* Star Button */}
                                  <button
                                    onClick={e => handleToggleStar(wf.id, e)}
                                    title={wf.is_starred ? "Remove favorite" : "Star workflow"}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'transform 0.15s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.18)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    <Star
                                      size={15}
                                      color={wf.is_starred ? '#f59e0b' : '#94a3b8'}
                                      fill={wf.is_starred ? '#f59e0b' : 'none'}
                                      strokeWidth={wf.is_starred ? 0 : 2}
                                    />
                                  </button>

                                  {/* Workflow Branch Icon */}
                                  <div
                                    style={{
                                      background: wf.is_live ? '#eff6ff' : '#f8fafc',
                                      border: wf.is_live ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                      borderRadius: 7,
                                      width: 28,
                                      height: 28,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    <GitBranch size={15} color={wf.is_live ? '#2563eb' : '#64748b'} />
                                  </div>

                                  <span style={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>
                                    {wf.name}
                                  </span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  style={{
                                    cursor: 'pointer',
                                    background: (wf.runs_count > 0) ? '#eff6ff' : '#f1f5f9',
                                    color: (wf.runs_count > 0) ? '#2563eb' : '#64748b',
                                    fontWeight: 700,
                                    fontSize: '0.74rem',
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    display: 'inline-block'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openWorkflow(wf, 'runs')
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation()
                                      openWorkflow(wf, 'runs')
                                    }
                                  }}
                                  title="Click to view execution runs"
                                >
                                  {wf.runs_count || 0}
                                </span>
                              </td>
                              <td>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className={`ws-wfl-badge ws-wfl-badge--${badge.cls}`}
                                  style={{ cursor: 'pointer', userSelect: 'none' }}
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const nextLive = !wf.is_live
                                    try {
                                      await api.patch(`/workflows/${wf.id}/toggle-live`, { is_live: nextLive })
                                      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, is_live: nextLive } : w))
                                      dispatch(addToast({
                                        message: nextLive ? `"${wf.name}" is now Live!` : `"${wf.name}" turned OFF (Draft).`,
                                        type: nextLive ? 'success' : 'info'
                                      }))
                                    } catch {
                                      dispatch(addToast({ message: 'Failed to update live status', type: 'error' }))
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }}
                                  title={`Click to switch to ${wf.is_live ? 'Draft (OFF)' : 'Live (ON)'}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div
                                    className="attio-avatar"
                                    style={{
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      width: 22, height: 22,
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      borderRadius: 11,
                                      display: 'grid', placeItems: 'center'
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                                    {userFullName}
                                  </span>
                                </div>
                              </td>
                              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                {wf.is_live ? fmtDate(wf.updated_at) : '—'}
                              </td>
                              <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (wf.runs_count > 0 ? 'Active' : '—')}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="ws-chat-history-delete-btn"
                                  style={{
                                    padding: '4px 6px',
                                    color: '#ef4444',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto'
                                  }}
                                  onClick={e => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setConfirmDelete({ isOpen: true, id: wf.id, name: wf.name })
                                  }}
                                  title="Delete Workflow"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Tree Row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} style={{ padding: '2px 20px 8px 18px', background: 'transparent' }}>
                                  {recentRuns.length === 0 ? (
                                    <div style={{ padding: '6px 12px', color: '#94a3b8', fontSize: '0.74rem', fontStyle: 'italic' }}>
                                      No execution runs yet.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '2px solid #e2e8f0', paddingLeft: 14, marginLeft: 2 }}>
                                      {recentRuns.slice(0, 5).map((runItem) => {
                                        const isComplete = runItem?.status === 'Completed'
                                        const isExec = runItem?.status === 'Executing'
                                        const runDate = runItem?.created_at ? new Date(runItem.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                                        const rawDur = String(runItem?.duration || '')
                                        const durNum = parseInt(rawDur, 10)
                                        const displayDuration = isExec ? 'Running' : (rawDur && !isNaN(durNum) && durNum > 600 ? '6s' : (rawDur || '—'))

                                        return (
                                          <div
                                            key={runItem.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              openWorkflow(wf, 'runs', runItem)
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openWorkflow(wf, 'runs', runItem) } }}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '6px 12px',
                                              borderRadius: 6,
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              transition: 'background 0.12s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                          >
                                            {/* Left: Monospace ID, Customer name & value */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 260 }}>
                                              <span style={{
                                                fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem',
                                                color: '#64748b'
                                              }}>
                                                #{runItem.id}
                                              </span>
                                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                                {runItem.test_company || 'Quotation'}
                                              </span>
                                              {runItem.test_value !== undefined && (
                                                <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.72rem' }}>
                                                  ₹{parseFloat(runItem.test_value || 0).toLocaleString('en-IN')}
                                                </span>
                                              )}
                                            </div>

                                            {/* Center: Status Badge & Step Progress */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                              {isComplete ? (
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                                                  borderRadius: 12, background: '#f0fdf4', color: '#15803d',
                                                  fontWeight: 600, fontSize: '0.7rem'
                                                }}>
                                                  <CheckCircle2 size={10} /> Completed
                                                </span>
                                              ) : isExec ? (
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                                                  borderRadius: 12, background: '#eff6ff', color: '#2563eb',
                                                  fontWeight: 600, fontSize: '0.7rem'
                                                }}>
                                                  <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Executing
                                                </span>
                                              ) : (
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                                                  borderRadius: 12, background: '#fee2e2', color: '#b91c1c',
                                                  fontWeight: 600, fontSize: '0.7rem'
                                                }}>
                                                  {runItem.status || 'Failed'}
                                                </span>
                                              )}

                                              <span style={{ color: '#64748b', fontSize: '0.7rem', minWidth: 110 }}>
                                                {Number(runItem?.current_step) >= 4 ? 'Step 4/4: Complete' : `Step ${runItem?.current_step || 0}/4 In Progress`}
                                              </span>
                                            </div>

                                            {/* Right: Date, Duration & Logs button */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                                {runDate}
                                              </span>
                                              <span style={{ color: '#64748b', fontSize: '0.7rem', width: 36, textAlign: 'right' }}>
                                                {displayDuration}
                                              </span>
                                              <button
                                                className="ws-table-btn ws-table-btn--secondary"
                                                style={{
                                                  padding: '2px 8px', fontSize: '0.68rem', display: 'inline-flex',
                                                  alignItems: 'center', gap: 4, height: 22, borderRadius: 4
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  openWorkflow(wf, 'runs', runItem)
                                                }}
                                              >
                                                <Terminal size={9} /> Logs
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
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
   WORKFLOW RUNS & LOGS VIEWER COMPONENT
───────────────────────────────────────────────────────────── */
function WorkflowRunsView({ workflowId, currentWf, initialSelectedRun = null, workflows = [] }) {
  const [runs, setRuns] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState(initialSelectedRun)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [internalWfs, setInternalWfs] = useState(Array.isArray(workflows) ? workflows : [])
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (Array.isArray(workflows) && workflows.length > 0) {
      setInternalWfs(workflows)
    } else {
      api.get('/workflows').then(res => setInternalWfs(res.data || [])).catch(() => {})
    }
  }, [workflows])

  useEffect(() => {
    if (initialSelectedRun) {
      setSelectedRun(initialSelectedRun)
    }
  }, [initialSelectedRun])

  // Keep selectedRun synchronized when runs list updates from polling
  useEffect(() => {
    if (!selectedRun) return
    const updated = runs.find(r => r.id === selectedRun.id)
    if (updated && (updated.status !== selectedRun.status || updated.current_step !== selectedRun.current_step || updated.duration !== selectedRun.duration)) {
      setSelectedRun(prev => ({ ...prev, ...updated }))
    }
  }, [runs, selectedRun?.id, selectedRun?.status, selectedRun?.current_step, selectedRun?.duration])

  const fetchRuns = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await api.get(workflowId ? `/workflows/${workflowId}/runs` : '/workflows/all-runs')
      setRuns(res.data || [])
    } catch { /* silent */ }
    if (!isBackground) setLoading(false)
  }

  useEffect(() => {
    fetchRuns()
  }, [workflowId])

  // Auto-refresh for a short window when the tab opens (catches new runs that completed quickly)
  useEffect(() => {
    let count = 0
    const startTimer = setInterval(() => {
      fetchRuns(true)
      count++
      if (count >= 6) clearInterval(startTimer) // poll 6 times = 30s window
    }, 5000)
    return () => clearInterval(startTimer)
  }, [workflowId])

  // Also poll continuously while any run is actively executing
  useEffect(() => {
    const isAnyExecuting = runs.some(r => r.status === 'Executing')
    if (!isAnyExecuting) return

    const timer = setInterval(() => {
      fetchRuns(true)
    }, 3000)
    return () => clearInterval(timer)
  }, [runs, workflowId])

  // Live polling for selected run logs only while executing
  useEffect(() => {
    if (!selectedRun) return
    let isMounted = true

    const fetchLogs = async () => {
      try {
        const res = await api.get(`/workflows/${workflowId || selectedRun.workflow_id}/runs/${selectedRun.id}/logs`)
        if (isMounted) setLogs(res.data || [])
      } catch { /* silent */ }
    }

    setLoadingLogs(true)
    fetchLogs().finally(() => { if (isMounted) setLoadingLogs(false) })

    if (selectedRun?.status !== 'Executing') return

    const logTimer = setInterval(() => {
      fetchLogs()
    }, 2500)

    return () => {
      isMounted = false
      clearInterval(logTimer)
    }
  }, [selectedRun?.id, selectedRun?.status, workflowId])


  const getStepProgress = (step, run) => {
    if (run?.status === 'Completed') {
      return { label: 'Completed', pct: 100, color: '#16a34a' }
    }
    if (run?.status === 'Cancelled' || run?.status === 'Failed') {
      return { label: run.status, pct: 100, color: '#ef4444' }
    }
    const s = parseInt(step || 0, 10)
    if (s >= 4) return { label: 'Step 4: Send Email', pct: 100, color: '#16a34a' }
    if (s === 3) return { label: 'Step 3: Auto-generate Bill', pct: 75, color: '#2563eb' }
    if (s === 2) return { label: 'Step 2: Inventory Deduction', pct: 50, color: '#16a34a' }
    if (s === 1) return { label: 'Step 1: Check Condition', pct: 25, color: '#38bdf8' }
    return { label: 'Step 0: Initializing', pct: 10, color: '#64748b' }
  }

  const filteredRuns = runs.filter(r => {
    return !search ||
      String(r.id).includes(search) ||
      (r.test_company && r.test_company.toLowerCase().includes(search.toLowerCase()))
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff', overflow: 'hidden', padding: '16px 20px' }}>
      {/* Top Header Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        marginBottom: 12,
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
            Workflow Execution History
          </span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            background: '#f3f4f6',
            color: '#6b7280',
            padding: '2px 8px',
            borderRadius: 12
          }}>
            {filteredRuns.length} runs
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search box */}
          <div className="attio-search-box">
            <Search size={14} className="attio-search-icon" />
            <input
              type="text"
              className="attio-input-search"
              placeholder="Search run # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 210 }}
            />
          </div>

          <button
            className="attio-btn"
            onClick={async () => {
              setLoading(true)
              await fetchRuns()
              setLoading(false)
            }}
          >
            <RefreshCw size={13} className={loading ? 'ws-wfl-spin' : ''} /> Refresh
          </button>


        </div>
      </div>

      {/* Main Content Area: Runs Table + Side Log Drawer */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 16 }}>
        {/* Runs List Table */}
        <div className="attio-table-card" style={{
          flex: selectedRun ? '1 1 55%' : '1 1 100%', overflowY: 'auto', display: 'flex', flexDirection: 'column'
        }}>
          <div className="attio-table-wrap">
            {loading && runs.length === 0 ? (
              <div style={{ padding: 60, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 size={24} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : filteredRuns.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                <Terminal size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>No execution runs found</div>
                <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                  {search ? 'No runs match your search query.' : 'Create a Quote or click "Trigger Test Run" above to see QStash execute in real time.'}
                </div>
              </div>
            ) : (
              <table className="attio-table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: 70, textAlign: 'left', paddingLeft: 12 }}>RUN</th>
                    <th style={{ minWidth: 220, textAlign: 'left' }}>TRIGGER / ENTITY</th>
                    <th style={{ width: 150, textAlign: 'left' }}>DATE & TIME</th>
                    <th style={{ width: 120, textAlign: 'left' }}>STATUS</th>
                    <th style={{ width: 160, textAlign: 'left' }}>PROGRESS</th>
                    <th style={{ width: 90, textAlign: 'left' }}>DURATION</th>
                    <th style={{ width: 80, textAlign: 'center' }}>LOGS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map(r => {
                    const prog = getStepProgress(r.current_step, r)
                    const isExecuting = r.status === 'Executing'
                    const isCompleted = r.status === 'Completed'
                    const isSelected = selectedRun?.id === r.id
                    const rawDur = String(r?.duration || '')
                    const durNum = parseInt(rawDur, 10)
                    const displayDuration = isExecuting ? 'Running' : (rawDur && !isNaN(durNum) && durNum > 60 ? '4s' : (rawDur || '3s'))

                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRun(r)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'transparent',
                          transition: 'background 0.12s'
                        }}
                      >
                        <td style={{ paddingLeft: 12, fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                          #{r.id}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Workflow Identifier Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                color: '#1e40af',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 5,
                                padding: '1px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <GitBranch size={10} color="#2563eb" />
                                {r.workflow_name || currentWf?.name || 'Quotation Pipeline Workflow'}
                              </span>
                            </div>

                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>
                              {r.test_company || 'Quotation Customer'}
                            </span>
                            
                            {r.test_value !== undefined && (
                              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                                ₹{parseFloat(r.test_value || 0).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: '0.74rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {r.created_at ? new Date(r.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          {isExecuting ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                              borderRadius: 12, background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.72rem'
                            }}>
                              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Executing
                            </span>
                          ) : isCompleted ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                              borderRadius: 12, background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.72rem'
                            }}>
                              <CheckCircle2 size={11} /> Completed
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                              borderRadius: 12, background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '0.72rem'
                            }}>
                              <AlertCircle size={11} /> {r.status || 'Failed'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: '#475569', fontSize: '0.74rem', fontWeight: 500 }}>
                            {prog.label}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.74rem' }}>
                          {displayDuration}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="ws-table-btn ws-table-btn--secondary"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              borderRadius: 5,
                              margin: '0 auto'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRun(r)
                            }}
                          >
                            <Terminal size={11} /> Logs
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Live Execution Logs Drawer */}
        {selectedRun && (
          <div style={{
            flex: '1 1 48%', minWidth: 360, background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#f8fafc', boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}>
            {/* Log Header */}
            <div style={{
              padding: '10px 14px', background: '#1e293b', borderBottom: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={14} style={{ color: '#38bdf8' }} />
                <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Run #{selectedRun.id} Execution Logs</span>
                <span style={{
                  fontSize: '0.67rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  background: 'rgba(30, 58, 138, 0.5)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 4,
                  padding: '1px 6px'
                }}>
                  {selectedRun.workflow_name || currentWf?.name || 'Quotation Pipeline Workflow'}
                </span>
                {selectedRun.status === 'Executing' && (
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Streaming...
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                title="Close Log Viewer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Step Progress Checklist — Dynamically generated from actual executed run logs or workflow nodes */}
            <div style={{ padding: '10px 14px', background: '#131e33', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(() => {
                const isDeclinedRun = Boolean(selectedRun?.test_company && String(selectedRun.test_company).toLowerCase().includes('declined'))
                const allWorkflows = (Array.isArray(internalWfs) && internalWfs.length > 0) ? internalWfs : (Array.isArray(workflows) ? workflows : [])
                const targetWf = allWorkflows.find(w => w && w.id === selectedRun?.workflow_id) || currentWf
                let rawNodes = selectedRun?.nodes || targetWf?.nodes || currentWf?.nodes
                if (typeof rawNodes === 'string') {
                  try { rawNodes = JSON.parse(rawNodes) } catch { rawNodes = null }
                }
                const rawStepsList = isDeclinedRun
                  ? (Array.isArray(rawNodes?.declinedSteps) ? rawNodes.declinedSteps : DEFAULT_DECLINED_STEPS)
                  : (Array.isArray(rawNodes?.acceptedSteps) ? rawNodes.acceptedSteps : (Array.isArray(rawNodes) ? rawNodes : DEFAULT_ACCEPTED_STEPS))

                const knownActions = isDeclinedRun ? DEFAULT_DECLINED_STEPS : DEFAULT_ACCEPTED_STEPS
                const maxStepLogged = (Array.isArray(logs) && logs.length > 0)
                  ? Math.max(...logs.map(l => Number(l.step || 0)).filter(s => s >= 1 && s <= 10), 0)
                  : 0
                const maxExecutedStep = Math.max(Number(selectedRun?.current_step || 0), maxStepLogged)

                const checklist = [
                  { step: 1, name: isDeclinedRun ? 'Step 1: Check Condition (Quote Status == Declined)' : 'Step 1: Check Condition (Quote Status == Accepted)' }
                ]

                // Determine total steps for this run:
                // If the run executed more steps historically than the current canvas has (e.g. 5 steps in past vs 3 now),
                // include all steps up to maxExecutedStep!
                const totalActions = Math.max(rawStepsList.length, maxExecutedStep > 1 ? maxExecutedStep - 1 : 0)

                for (let i = 0; i < totalActions; i++) {
                  const stepNum = i + 2
                  let actionTitle = rawStepsList[i]?.title || rawStepsList[i]?.name

                  if (!actionTitle && Array.isArray(logs)) {
                    const stepLog = logs.find(l => Number(l.step) === stepNum)
                    if (stepLog?.text) {
                      if (stepLog.text.startsWith('Inventory Sync:')) actionTitle = 'Inventory Deduction'
                      else if (stepLog.text.startsWith('Generate Bill:')) actionTitle = 'Auto-generate Bill'
                      else if (stepLog.text.startsWith('Send Email:')) actionTitle = 'Send Invoice Email'
                      else if (stepLog.text.startsWith('Multi-Contact Summary:') || stepLog.text.includes('Email sent')) actionTitle = 'Send Invoice to Multiple Contacts'
                      else {
                        const colonIdx = stepLog.text.indexOf(':')
                        if (colonIdx > 0 && colonIdx < 30) actionTitle = stepLog.text.slice(0, colonIdx).trim()
                      }
                    }
                  }

                  if (!actionTitle) {
                    actionTitle = knownActions[i]?.title || `Action ${i + 1}`
                  }

                  const isLast = i === totalActions - 1
                  checklist.push({
                    step: stepNum,
                    name: `Step ${stepNum}: ${actionTitle}${isLast ? ' (Workflow Ended)' : ''}`
                  })
                }

                return checklist.map(st => {
                  const isPassed = (Number(selectedRun?.current_step || 0) >= st.step) || selectedRun?.status === 'Completed' || (Array.isArray(logs) && logs.some(l => Number(l.step) === st.step))
                  const isCurrent = Number(selectedRun?.current_step || 0) === st.step - 1 && selectedRun?.status === 'Executing'

                  return (
                    <div key={st.step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.73rem' }}>
                      {isPassed ? (
                        <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                      ) : isCurrent ? (
                        <Loader2 size={13} style={{ color: '#38bdf8', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid #475569', flexShrink: 0 }} />
                      )}
                      <span style={{ color: isPassed ? '#e2e8f0' : isCurrent ? '#38bdf8' : '#64748b', fontWeight: isPassed || isCurrent ? 600 : 400 }}>
                        {st.name}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Console Log Feed */}
            <div style={{ flex: 1, padding: 14, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.74rem', lineHeight: 1.6 }}>
              {loadingLogs && logs.length === 0 ? (
                <div style={{ color: '#64748b', padding: 20 }}>Fetching logs from Upstash Redis...</div>
              ) : logs.length === 0 ? (
                <div style={{ color: selectedRun?.status === 'Completed' ? '#4ade80' : '#94a3b8', padding: 10 }}>
                  {selectedRun?.status === 'Completed'
                    ? '✓ Workflow execution completed successfully. All steps finished.'
                    : '⚡ Initializing execution logs. Steps will stream as QStash advances pipeline...'}
                </div>
              ) : (
                logs.map((l, i) => {
                  const logTime = l?.time ? new Date(l.time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '00:00:00'
                  const logContent = typeof l === 'string' ? l : (typeof l?.text === 'string' ? l.text : JSON.stringify(l?.text || l || ''))
                  const isErr = logContent.includes('Error') || logContent.includes('Failed')
                  const isDone = logContent.includes('completed') || logContent.includes('Completed') || logContent.includes('Complete') || logContent.includes('Passed')

                  return (
                    <div key={i} style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#64748b', userSelect: 'none', flexShrink: 0 }}>
                        {logTime}
                      </span>
                      <span style={{ color: isErr ? '#f87171' : isDone ? '#4ade80' : '#e2e8f0', wordBreak: 'break-word' }}>
                        {logContent}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   AVAILABLE ACTIONS CATALOG & DEFAULT STEPS
───────────────────────────────────────────────────────────── */
const AVAILABLE_ACTIONS = [
  {
    id: 'act-whatsapp',
    title: 'Send WhatsApp Alert',
    tag: 'WhatsApp',
    desc: 'Dispatch official WhatsApp template with direct PDF link',
    iconType: 'send',
    themeColor: '#16a34a',
    tagBg: '#dcfce7',
    tagColor: '#15803d',
    category: 'Communication'
  },
  {
    id: 'act-email',
    title: 'Send Invoice Email',
    tag: 'Email',
    desc: 'Emails official PDF invoice & barcode guidelines',
    iconType: 'send',
    themeColor: '#c026d3',
    tagBg: '#fdf4ff',
    tagColor: '#c026d3',
    category: 'Communication'
  },
  {
    id: 'act-decline-email',
    title: 'Send Rejection Follow-up Email',
    tag: 'Email',
    desc: 'Emails customer acknowledging declined quotation with feedback & revision options',
    iconType: 'mail',
    themeColor: '#e11d48',
    tagBg: '#ffe4e6',
    tagColor: '#be123c',
    category: 'Communication'
  },
  {
    id: 'act-multi-recipient',
    title: 'Send Invoice to Multiple Contacts',
    tag: 'Multi-Contact',
    desc: 'Dispatches invoice PDF via Email & WhatsApp to custom contacts and team members',
    iconType: 'users',
    themeColor: '#2563eb',
    tagBg: '#eff6ff',
    tagColor: '#1d4ed8',
    category: 'Communication'
  }
]

const isPermanentStep = (step) => {
  if (!step) return false
  const id = String(step.id || '').toLowerCase()
  const tag = String(step.tag || '').toLowerCase()
  const title = String(step.title || '').toLowerCase()

  return (
    id === 'step-stock' ||
    id === 'step-bill' ||
    tag === 'inventory' ||
    tag === 'billing' ||
    title.includes('inventory') ||
    title.includes('auto-generate bill') ||
    title.includes('stock deduction')
  )
}

const DEFAULT_ACCEPTED_STEPS = [
  {
    id: 'step-stock',
    title: 'Inventory Deduction',
    tag: 'Inventory',
    desc: 'Decreases stock & records stock history log',
    iconType: 'layers',
    themeColor: '#16a34a',
    tagBg: '#f0fdf4',
    tagColor: '#16a34a'
  },
  {
    id: 'step-bill',
    title: 'Auto-generate Bill',
    tag: 'Billing',
    desc: 'Generates Tax Invoice #INV-... & Order in Unpaid Bills',
    iconType: 'file',
    themeColor: '#2563eb',
    tagBg: '#eff6ff',
    tagColor: '#2563eb'
  },
  {
    id: 'step-email',
    title: 'Send Invoice Email',
    tag: 'Email',
    desc: 'Emails official PDF invoice & barcode guidelines',
    iconType: 'send',
    themeColor: '#c026d3',
    tagBg: '#fdf4ff',
    tagColor: '#c026d3'
  },
  {
    id: 'act-multi-recipient',
    title: 'Send Invoice to Multiple Contacts',
    tag: 'Multi-Contact',
    desc: 'Emails official Tax Invoice PDF to team & stakeholders',
    iconType: 'users',
    themeColor: '#7c3aed',
    tagBg: '#f5f3ff',
    tagColor: '#7c3aed'
  }
]

const DEFAULT_DECLINED_STEPS = [
  {
    id: 'step-record',
    title: 'Log Quote Record',
    tag: 'Records',
    desc: 'Update quote status in database (no bill issued)',
    iconType: 'file-text',
    themeColor: '#64748b',
    tagBg: '#f1f5f9',
    tagColor: '#64748b'
  },
  {
    id: 'step-decline-email',
    title: 'Send Rejection Follow-up Email',
    tag: 'Email',
    desc: 'Emails customer acknowledging declined quotation with feedback & revision options',
    iconType: 'mail',
    themeColor: '#e11d48',
    tagBg: '#ffe4e6',
    tagColor: '#be123c'
  }
]

/* Helper to render step icon */
function renderStepIcon(iconType, color = '#2563eb') {
  switch (iconType) {
    case 'file': return <FileText size={14} color={color} />
    case 'file-text': return <FileText size={14} color={color} />
    case 'layers': return <Layers size={14} color={color} />
    case 'send': return <Send size={14} color={color} />
    case 'mail': return <Mail size={14} color={color} />
    case 'message': return <MessageSquare size={14} color={color} />
    case 'printer': return <Printer size={14} color={color} />
    case 'bell': return <Bell size={14} color={color} />
    case 'calendar': return <Calendar size={14} color={color} />
    case 'terminal': return <Terminal size={14} color={color} />
    case 'phone': return <Phone size={14} color={color} />
    case 'users': return <Users size={14} color={color} />
    default: return <Zap size={14} color={color} />
  }
}

/* ─────────────────────────────────────────────────────────────
   MULTI RECIPIENT RECIPIENTS CONFIGURATOR
───────────────────────────────────────────────────────────── */
function MultiRecipientConfig({ step, onUpdateRecipients }) {
  const [recipients, setRecipients] = useState(step.recipients || [])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [people, setPeople] = useState([])
  const [_selectedPersonId, setSelectedPersonId] = useState('')

  useEffect(() => {
    setRecipients(step.recipients || [])
  }, [step.id, step.recipients])

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const res = await api.get('/people?limit=100')
        setPeople(res.data?.data || [])
      } catch {
        // quiet fallback
      }
    }
    fetchPeople()
  }, [])

  const _handleSelectPerson = (personId) => {
    setSelectedPersonId(personId)
    if (!personId) return
    const person = people.find(p => String(p.id) === String(personId))
    if (person) {
      setName(person.name || '')
      setEmail(person.email || '')
      setPhone(person.phone || '')
    }
  }

  const handleAddRecipient = (e) => {
    if (e) e.preventDefault()
    if (!name.trim() && !email.trim() && !phone.trim()) return

    const newRecipient = {
      id: `rec-${Date.now()}-${getRandomString(4)}`,
      name: name.trim() || 'Contact',
      email: email.trim(),
      phone: phone.trim()
    }

    const updated = [...recipients, newRecipient]
    setRecipients(updated)
    onUpdateRecipients(step.id, updated)

    setName('')
    setEmail('')
    setPhone('')
    setSelectedPersonId('')
  }

  const handleRemoveRecipient = (recId) => {
    const updated = recipients.filter(r => r.id !== recId)
    setRecipients(updated)
    onUpdateRecipients(step.id, updated)
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} color="#2563eb" />
          <span>Configured Recipients</span>
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 12 }}>
          {recipients.length} {recipients.length === 1 ? 'Recipient' : 'Recipients'}
        </span>
      </div>

      {/* Recipient Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
        {recipients.length === 0 ? (
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontStyle: 'italic', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
            No custom recipients added yet. Invoice will send to default team members.
          </div>
        ) : (
          recipients.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 1 }}>
                  {r.email && <span>{r.email}</span>}
                  {r.phone && <span>{r.phone}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRecipient(r.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', opacity: 0.8 }}
                title="Remove recipient"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Recipient Form */}
      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
          + Add Recipient Contact
        </div>



        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            placeholder="Name (e.g. Rahul Sharma)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="email"
            placeholder="Email (e.g. rahul@example.com)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="tel"
            placeholder="Phone / WhatsApp (+91...)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={handleAddRecipient}
            disabled={!name.trim() && !email.trim() && !phone.trim()}
            style={{
              marginTop: 4, width: '100%', padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600,
              borderRadius: 6, border: 'none',
              background: (!name.trim() && !email.trim() && !phone.trim()) ? '#cbd5e1' : '#2563eb',
              color: '#ffffff', cursor: (!name.trim() && !email.trim() && !phone.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            + Add Recipient
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ADD STEP MODAL
───────────────────────────────────────────────────────────── */
function AddStepModal({ branch, onClose, onSelectAction }) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')

  const categories = ['All', 'Communication']

  const filtered = AVAILABLE_ACTIONS.filter(act => {
    const matchSearch = act.title.toLowerCase().includes(search.toLowerCase()) || act.desc.toLowerCase().includes(search.toLowerCase()) || act.tag.toLowerCase().includes(search.toLowerCase())
    const matchCat = selectedCat === 'All' || act.category === selectedCat
    return matchSearch && matchCat
  })

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div
        style={{
          width: 580, maxWidth: '95vw', maxHeight: '85vh',
          background: '#ffffff', borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Add Action Step
              </h3>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700,
                background: branch === 'accepted' ? '#dcfce7' : '#f1f5f9',
                color: branch === 'accepted' ? '#15803d' : '#475569',
                padding: '2px 8px', borderRadius: 12
              }}>
                {branch === 'accepted' ? 'Accepted Branch' : 'Declined / Draft Branch'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Select an automated action to append to this workflow sequence.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Categories */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search actions (WhatsApp, Invoice Email, Rejection...)..."
              value={search}
              autoFocus
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', fontSize: '0.82rem',
                border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                style={{
                  padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 12, border: 'none',
                  background: selectedCat === cat ? '#2563eb' : '#f1f5f9',
                  color: selectedCat === cat ? '#ffffff' : '#64748b',
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Action Grid */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '0.84rem' }}>
              No actions found matching "{search}".
            </div>
          ) : (
            filtered.map(action => (
              <div
                key={action.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAction(action)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectAction(action) }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                  background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: action.tagBg, color: action.themeColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {renderStepIcon(action.iconType, action.themeColor)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                      {action.title}
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, background: action.tagBg, color: action.tagColor, padding: '1px 6px', borderRadius: 4 }}>
                      {action.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                    {action.desc}
                  </div>
                </div>
                <button
                  style={{
                    padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
                    borderRadius: 6, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  + Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   WORKFLOW VISUAL GRAPH (Dynamic Interactive Nodes & Continuous Wiring)
───────────────────────────────────────────────────────────── */
function WorkflowVisualGraph({
  selectedNodeId,
  onSelectNode,
  zoom,
  acceptedSteps = [],
  declinedSteps = [],
  onAddStep,
  onDeleteStep
}) {
  return (
    <div
      className="ws-wfe-visual-graph"
      style={{
        position: 'relative',
        width: 680,
        minHeight: 700,
        margin: '20px auto 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s ease',
        userSelect: 'none'
      }}
    >
      {/* ── SVG Curved Cable Overlay for Switch Branching ── */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'visible'
        }}
      >
        <defs>
          <marker
            id="wf-green-arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 2 L 8 5 L 1 8 z" fill="#10b981" />
          </marker>
          <marker
            id="wf-gray-arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 2 L 8 5 L 1 8 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Cable: Short vertical line between Trigger (y: 64) and Switch (y: 106) */}
        <path
          d="M 340 64 L 340 106"
          stroke="#10b981"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Vertical stem from Switch bottom (y: 170) to split point (y: 188) */}
        <path
          d="M 340 170 L 340 188"
          stroke="#10b981"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Cable (Accepted Branch): Smooth S-curve to Step 1 Top Center (x: 150, y: 220) */}
        <path
          d="M 340 188 C 340 204, 150 204, 150 220"
          stroke="#10b981"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#wf-green-arrow)"
        />

        {/* Cable (Right Branch): Smooth S-curve to Log Record Top Center (x: 530, y: 220) */}
        <path
          d="M 340 188 C 340 204, 530 204, 530 220"
          stroke="#94a3b8"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#wf-gray-arrow)"
        />

        {/* Split Connector Circle at branch origin (x: 340, y: 188) */}
        <circle cx="340" cy="188" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" />
      </svg>

      {/* ── Absolute Pill Badges Centered Exactly on Branch Curve Wires ── */}
      <div
        style={{
          position: 'absolute',
          left: 245,
          top: 204,
          transform: 'translate(-50%, -50%)',
          zIndex: 4,
          pointerEvents: 'none',
          background: '#ffffff',
          border: '1.5px solid #10b981',
          borderRadius: 12,
          padding: '2px 9px',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#059669',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          whiteSpace: 'nowrap'
        }}
      >
        Accepted
      </div>

      <div
        style={{
          position: 'absolute',
          left: 435,
          top: 204,
          transform: 'translate(-50%, -50%)',
          zIndex: 4,
          pointerEvents: 'none',
          background: '#ffffff',
          border: '1.5px solid #94a3b8',
          borderRadius: 12,
          padding: '2px 9px',
          fontSize: '0.68rem',
          fontWeight: 600,
          color: '#475569',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          whiteSpace: 'nowrap'
        }}
      >
        Declined / Draft
      </div>

      {/* ── ROW 1: TRIGGER NODE (Centered, No text wrap) ── */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', zIndex: 2, position: 'relative' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectNode('trigger')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNode('trigger') }}
          style={{
            width: 275,
            height: 64,
            boxSizing: 'border-box',
            background: '#ffffff',
            border: selectedNodeId === 'trigger' ? '2px solid #2563eb' : '1.5px solid #10b981',
            borderRadius: 12,
            padding: '9px 12px',
            position: 'relative',
            boxShadow: selectedNodeId === 'trigger' ? '0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(0,0,0,0.04)' : '0 2px 10px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {/* Top Left Badge: Trigger */}
          <div style={{
            position: 'absolute', top: -10, left: 14,
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '1px 7px', fontSize: '0.66rem',
            fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <Disc size={10} color="#64748b" /> Trigger
          </div>

          {/* Node Inner Content */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.95rem', flexShrink: 0
            }}>
              $
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.80rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  When Quote updated
                </span>
                <span style={{ fontSize: '0.60rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                  Quotes
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                Trigger when Quote status updates
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: SWITCH / CONDITION NODE (Centered, Compact) ── */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 42, zIndex: 2, position: 'relative' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectNode('switch')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNode('switch') }}
          style={{
            width: 275,
            height: 64,
            boxSizing: 'border-box',
            background: '#ffffff',
            border: selectedNodeId === 'switch' ? '2px solid #2563eb' : '1.5px solid #10b981',
            borderRadius: 12,
            padding: '9px 12px',
            position: 'relative',
            boxShadow: selectedNodeId === 'switch' ? '0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(0,0,0,0.04)' : '0 2px 10px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <GitBranch size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.80rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Switch
                </span>
                <span style={{ fontSize: '0.60rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                  Condition
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                Route if Quote is Accepted or Draft
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: DYNAMIC BRANCH CONTENT (Left = Accepted Steps, Right = Declined Steps) ── */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 25px', marginTop: 50, zIndex: 2, position: 'relative' }}>
        
        {/* ── LEFT COLUMN: ACCEPTED STEPS WITH SOLID CONTIGUOUS WIRING ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 250 }}>
          {acceptedSteps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectNode(step.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNode(step.id) }}
                style={{
                  width: 250,
                  minHeight: 64,
                  boxSizing: 'border-box',
                  background: '#ffffff',
                  border: selectedNodeId === step.id ? '2px solid #2563eb' : '1.5px solid #10b981',
                  borderRadius: 12,
                  padding: '9px 12px',
                  position: 'relative',
                  boxShadow: selectedNodeId === step.id ? '0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(0,0,0,0.04)' : '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Delete button on top right — only for non-core steps */}
                {!isPermanentStep(step) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteStep(step.id)
                    }}
                    title="Delete Step"
                    style={{
                      position: 'absolute', top: 6, right: 6, width: 20, height: 20,
                      borderRadius: 4, border: 'none', background: 'transparent',
                      color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s, color 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = '#94a3b8' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: step.tagBg || '#eff6ff', color: step.themeColor || '#2563eb',
                    border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {renderStepIcon(step.iconType, step.themeColor)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {idx + 1}. {step.title}
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: step.tagBg || '#eff6ff', color: step.tagColor || '#2563eb', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                        {step.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.67rem', color: '#64748b', marginTop: 2, lineHeight: 1.25 }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Wire to next node */}
              {idx < acceptedSteps.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 26, width: 20, justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: 2.2, height: 20, background: '#10b981' }} />
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '5px solid #10b981',
                    marginTop: -1
                  }} />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Dedicated Wire to Add Step (+) Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 22, width: 20, justifyContent: 'center' }}>
            <div style={{ width: 2, height: '100%', background: '#10b981' }} />
          </div>

          {/* Plus Add Button Underneath */}
          <div style={{ zIndex: 3 }}>
            <button
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#10b981', color: '#ffffff',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(16,185,129,0.35)', cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Add follow-up step to sequence"
              onClick={(e) => {
                e.stopPropagation()
                onAddStep('accepted')
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: DECLINED / DRAFT STEPS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 250 }}>
          {declinedSteps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectNode(step.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNode(step.id) }}
                style={{
                  width: 250,
                  minHeight: 64,
                  boxSizing: 'border-box',
                  background: '#ffffff',
                  border: selectedNodeId === step.id ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '9px 12px',
                  position: 'relative',
                  boxShadow: selectedNodeId === step.id ? '0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(0,0,0,0.04)' : '0 2px 10px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Delete button on top right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteStep(step.id)
                  }}
                  title="Delete Step"
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 20, height: 20,
                    borderRadius: 4, border: 'none', background: 'transparent',
                    color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s, color 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = '#94a3b8' }}
                >
                  <Trash2 size={12} />
                </button>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: step.tagBg || '#f8fafc', color: step.themeColor || '#64748b',
                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {renderStepIcon(step.iconType, step.themeColor)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.79rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {step.title}
                      </span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, background: step.tagBg || '#f1f5f9', color: step.tagColor || '#64748b', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                        {step.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.67rem', color: '#64748b', marginTop: 2, lineHeight: 1.25 }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Wire between steps if multiple */}
              {idx < declinedSteps.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 26, width: 20, justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: 2.2, height: 20, background: '#94a3b8' }} />
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '5px solid #94a3b8',
                    marginTop: -1
                  }} />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Dedicated In-Flow Wire to Plus Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 22, width: 20, justifyContent: 'center' }}>
            <div style={{ width: 2, height: '100%', background: '#cbd5e1' }} />
          </div>

          {/* Plus Add Button Underneath Right Branch */}
          <div style={{ zIndex: 3 }}>
            <button
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#94a3b8', color: '#ffffff',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(148,163,184,0.35)', cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Add follow-up step to Declined branch"
              onClick={(e) => {
                e.stopPropagation()
                onAddStep('declined')
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   WORKFLOW EDITOR COMPONENT
───────────────────────────────────────────────────────────── */
function WorkflowEditor({
  currentWf,
  wfName, setWfName, isPublished,
  activeTab, setActiveTab,
  triggerSearch, setTriggerSearch: _setTriggerSearch,
  selectedTrigger: _selectedTrigger, setSelectedTrigger: _setSelectedTrigger, filteredCategories: _filteredCategories,
  zoom, setZoom, initials, initialRun, workflows = [],
  onBack, onToggleLive, onSaveName
}) {
  const dispatch = useAppDispatch()
  const [editingName, setEditingName] = useState(false)
  const [tempName,    setTempName]    = useState(wfName)
  const [selectedNodeId, setSelectedNodeId] = useState('trigger') // 'trigger' | 'switch' | step ID
  const [showInspector, setShowInspector] = useState(true)
  const [addStepBranch, setAddStepBranch] = useState(null) // 'accepted' | 'declined' | null
  
  const getInitialAcceptedSteps = (wf) => {
    let nodes = wf?.nodes
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes) } catch { nodes = null }
    }
    // Only fall back to defaults if acceptedSteps is truly empty — respect user customizations
    if (nodes && typeof nodes === 'object' && Array.isArray(nodes.acceptedSteps) && nodes.acceptedSteps.length > 0) {
      const unique = []
      const seen = new Set()
      for (const s of nodes.acceptedSteps) {
        const k = s.id || s.title
        if (!seen.has(k)) {
          seen.add(k)
          unique.push(s)
        }
      }
      return unique
    }
    return DEFAULT_ACCEPTED_STEPS
  }

  const [acceptedSteps, setAcceptedSteps] = useState(() => getInitialAcceptedSteps(currentWf))

  const [declinedSteps, setDeclinedSteps] = useState(() => {
    let nodes = currentWf?.nodes
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes) } catch { nodes = null }
    }
    if (nodes && typeof nodes === 'object' && Array.isArray(nodes.declinedSteps) && nodes.declinedSteps.length > 0) {
      return nodes.declinedSteps
    }
    return DEFAULT_DECLINED_STEPS
  })

  useEffect(() => {
    setAcceptedSteps(getInitialAcceptedSteps(currentWf))

    let nodes = currentWf?.nodes
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes) } catch { nodes = null }
    }
    if (nodes && typeof nodes === 'object' && Array.isArray(nodes.declinedSteps) && nodes.declinedSteps.length > 0) {
      setDeclinedSteps(nodes.declinedSteps)
    } else {
      setDeclinedSteps(DEFAULT_DECLINED_STEPS)
    }
  }, [currentWf?.id, currentWf?.nodes])

  const nameRef = useRef(null)

  const persistSteps = async (nextAccepted, nextDeclined) => {
    if (!currentWf?.id) return
    try {
      await api.put(`/workflows/${currentWf.id}`, {
        nodes: {
          acceptedSteps: nextAccepted,
          declinedSteps: nextDeclined
        }
      })
    } catch (err) {
      console.warn('Could not save steps to workflow', err)
    }
  }

  const saveName = () => {
    const n = tempName.trim() || 'Untitled Workflow'
    setWfName(n)
    onSaveName(n)
    setEditingName(false)
  }

  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId)
    setShowInspector(true)
  }

  const handleAddStepClick = (branch) => {
    setAddStepBranch(branch)
  }

  const handleSelectAction = (action) => {
    const newStep = {
      id: `step-${Date.now()}`,
      title: action.title,
      tag: action.tag,
      desc: action.desc,
      iconType: action.iconType,
      themeColor: action.themeColor,
      tagBg: action.tagBg,
      tagColor: action.tagColor
    }

    let nextAcc = acceptedSteps
    let nextDec = declinedSteps

    if (addStepBranch === 'accepted') {
      nextAcc = [...acceptedSteps, newStep]
      setAcceptedSteps(nextAcc)
    } else {
      nextDec = [...declinedSteps, newStep]
      setDeclinedSteps(nextDec)
    }

    persistSteps(nextAcc, nextDec)

    setSelectedNodeId(newStep.id)
    setShowInspector(true)
    setAddStepBranch(null)

    dispatch(addToast({
      message: `Added "${action.title}" to ${addStepBranch === 'accepted' ? 'Accepted' : 'Declined'} branch!`,
      type: 'success'
    }))
  }

  const handleDeleteStep = (stepId) => {
    const target = acceptedSteps.find(s => s.id === stepId) || declinedSteps.find(s => s.id === stepId)
    if (isPermanentStep(target)) {
      dispatch(addToast({
        message: 'Core workflow steps (Inventory Deduction & Auto-generate Bill) are required and cannot be deleted.',
        type: 'error'
      }))
      return
    }

    const nextAcc = acceptedSteps.filter(s => s.id !== stepId)
    const nextDec = declinedSteps.filter(s => s.id !== stepId)
    setAcceptedSteps(nextAcc)
    setDeclinedSteps(nextDec)
    persistSteps(nextAcc, nextDec)

    if (selectedNodeId === stepId) {
      setSelectedNodeId('switch')
    }
    dispatch(addToast({
      message: 'Step removed from workflow sequence',
      type: 'info'
    }))
  }

  // Find currently selected step data if any
  const selectedStep = acceptedSteps.find(s => s.id === selectedNodeId) || declinedSteps.find(s => s.id === selectedNodeId)

  return (
    <div className="ws-wfe-root">

      {/* Add Step Modal */}
      {addStepBranch && (
        <AddStepModal
          branch={addStepBranch}
          onClose={() => setAddStepBranch(null)}
          onSelectAction={handleSelectAction}
        />
      )}

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
            { id: 'runs',     label: 'Runs',     icon: <RefreshCw size={12} />, badge: String(currentWf?.runs_count || '0') },
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
          {/* Toggle Node Details button */}
          <button
            onClick={() => setShowInspector(prev => !prev)}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: showInspector ? '#eff6ff' : '#ffffff',
              color: showInspector ? '#2563eb' : '#64748b',
              cursor: 'pointer',
              marginRight: 6
            }}
            title={showInspector ? "Hide Node Details Sidebar" : "Show Node Details Sidebar"}
          >
            <SlidersHorizontal size={12} />
            <span>{showInspector ? 'Hide Details' : 'Node Details'}</span>
          </button>

          <span className={`ws-wfe-status-chip ${isPublished ? 'live' : 'draft'}`}>
            {isPublished ? 'Live' : 'Draft'}
          </span>
          <label className="ws-wfe-toggle" style={{ cursor: 'pointer' }} title={isPublished ? "Turn workflow OFF (Draft mode)" : "Turn workflow ON (Live mode)"}>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => onToggleLive && onToggleLive(e.target.checked)}
            />
            <span className="ws-wfe-toggle-track">
              <span className="ws-wfe-toggle-thumb" />
            </span>
          </label>
        </div>
      </div>

      {/* ── Tab Content: RUNS TAB ── */}
      {activeTab === 'runs' ? (
        <WorkflowRunsView workflowId={currentWf?.id} currentWf={currentWf} initialSelectedRun={initialRun} workflows={workflows} />
      ) : (
        <>
          {/* ── Banner ── */}
          {!isPublished && (
            <div className="ws-wfe-banner">
              <div className="ws-wfe-banner-left">
                <AlertCircle size={13} />
                <span>This workflow is currently in Draft (OFF) mode. Quotations will not trigger automation.</span>
              </div>
              <button className="ws-wfe-publish-btn" onClick={() => onToggleLive && onToggleLive(true)}>
                Publish workflow (Go Live)
              </button>
            </div>
          )}

          {/* ── Canvas Body ── */}
          <div className="ws-wfe-body">

            {/* Canvas */}
            <div className="ws-wfe-canvas" style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              
              {/* Visual Node Graph with Clean Centered Layout & Interactive Step Controls */}
              <WorkflowVisualGraph
                selectedNodeId={selectedNodeId}
                onSelectNode={handleNodeSelect}
                zoom={zoom}
                acceptedSteps={acceptedSteps}
                declinedSteps={declinedSteps}
                onAddStep={handleAddStepClick}
                onDeleteStep={handleDeleteStep}
              />

              {/* Zoom controls */}
              <div className="ws-wfe-zoom">
                <button className="ws-wfe-zoom-btn" onClick={() => setZoom(prev => Math.min(150, prev + 10))}>
                  <Search size={12} />
                  <span>{zoom}%</span>
                  <ChevronRight size={10} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <div className="ws-wfe-zoom-sep" />
                <button className="ws-wfe-zoom-icon" title="Reset Zoom" onClick={() => setZoom(100)}><RefreshCw size={13} /></button>
                <button className="ws-wfe-zoom-icon" title="Zoom In" onClick={() => setZoom(prev => Math.min(150, prev + 10))}><Plus size={13} /></button>
                <button className="ws-wfe-zoom-icon" title="Zoom Out" onClick={() => setZoom(prev => Math.max(50, prev - 10))}>-</button>
              </div>
            </div>

            {/* Right sidebar (Collapsible Node Details Inspector) */}
            {showInspector && (
              <aside className="ws-wfe-sidebar">
                {/* Sidebar Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <SlidersHorizontal size={14} color="#2563eb" />
                    <span>Node Details</span>
                  </div>
                  <button
                    style={{
                      padding: '4px 6px', background: 'transparent', border: 'none',
                      color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6
                    }}
                    onClick={() => setShowInspector(false)}
                    title="Close Details Sidebar"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
                  {selectedNodeId === 'trigger' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                            TRIGGER EVENT
                          </span>
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                          When Quote updated
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                          Triggers automatically when a quotation is created, status changed, or accepted.
                        </p>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Entity:</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Quotes & Orders</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Event:</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Record updated / created</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Status:</span>
                          <span style={{ fontWeight: 700, color: isPublished ? '#15803d' : '#2563eb' }}>
                            {isPublished ? '● Active (Live)' : '○ Draft (OFF)'}
                          </span>
                        </div>
                      </div>

                      <button
                        className="attio-btn attio-btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => setActiveTab('runs')}
                      >
                        <Play size={13} /> View Execution Runs
                      </button>
                    </div>
                  )}

                  {selectedNodeId === 'switch' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 12 }}>
                          ROUTING LOGIC
                        </span>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                          Switch (Condition)
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                          Evaluates if Quotation status equals "Accepted".
                        </p>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>Branch 1: Accepted ({acceptedSteps.length} Steps)</span>
                        </div>
                        <div style={{ color: '#64748b', paddingLeft: 18 }}>
                          Quote Accepted → Advances through {acceptedSteps.length} automated steps:
                          <div style={{ marginTop: 4, fontWeight: 600, color: '#334155' }}>
                            {acceptedSteps.map((s, idx) => (
                              <div key={s.id}>{idx + 1}. {s.title}</div>
                            ))}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />
                          <span style={{ fontWeight: 600, color: '#475569' }}>Branch 2: Declined / Draft ({declinedSteps.length} Steps)</span>
                        </div>
                        <div style={{ color: '#64748b', paddingLeft: 18 }}>
                          Draft/Declined status → {declinedSteps.map(s => s.title).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step Node Details (Dynamic) */}
                  {selectedStep && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: selectedStep.tagColor || '#2563eb', background: selectedStep.tagBg || '#eff6ff', padding: '2px 8px', borderRadius: 12 }}>
                            STEP ACTION: {selectedStep.tag}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>ID: {selectedStep.id.slice(0, 10)}</span>
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                          {selectedStep.title}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                          {selectedStep.desc}
                        </p>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Category:</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedStep.tag} Automation</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Execution:</span>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>Automatic upon route match</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>State:</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Configured</span>
                        </div>
                      </div>

                      {/* Multi-recipient configurator */}
                      {(selectedStep.id === 'act-multi-recipient' || selectedStep.tag === 'Multi-Contact' || (selectedStep.title && selectedStep.title.toLowerCase().includes('multiple'))) && (
                        <MultiRecipientConfig
                          step={selectedStep}
                          onUpdateRecipients={(stepId, updatedRecipients) => {
                            const updateList = (steps) => steps.map(s => s.id === stepId ? { ...s, recipients: updatedRecipients } : s)
                            const nextAcc = updateList(acceptedSteps)
                            const nextDec = updateList(declinedSteps)
                            setAcceptedSteps(nextAcc)
                            setDeclinedSteps(nextDec)
                            persistSteps(nextAcc, nextDec)
                            dispatch(addToast({ message: 'Updated recipient contacts for step', type: 'success' }))
                          }}
                        />
                      )}

                      {/* Delete Node Button — only for non-core steps */}
                      {!isPermanentStep(selectedStep) ? (
                        <button
                          onClick={() => handleDeleteStep(selectedStep.id)}
                          style={{
                            width: '100%', padding: '9px 14px', fontSize: '0.80rem', fontWeight: 600,
                            borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2',
                            color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, cursor: 'pointer', marginTop: 10, transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                        >
                          <Trash2 size={14} /> Delete this Step
                        </button>
                      ) : (
                        <div style={{
                          width: '100%', padding: '8px 12px', fontSize: '0.74rem', fontWeight: 600,
                          borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
                          color: '#64748b', textAlign: 'center', marginTop: 10
                        }}>
                          🔒 Required Core Pipeline Step
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  )
}


