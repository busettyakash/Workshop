import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen:           true,
  sidebarTriggerHovered: false,
  sidebarContentHovered: false,
  chatOpen:              true,
  allChatsPanelOpen:     false,
  activeNav:             'Home',
  toasts:                [],
  configureOpen:         false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
      state.sidebarTriggerHovered = false
      state.sidebarContentHovered = false
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload
      if (!action.payload) {
        state.sidebarTriggerHovered = false
        state.sidebarContentHovered = false
      }
    },
    setSidebarTriggerHovered(state, action) {
      state.sidebarTriggerHovered = action.payload
    },
    setSidebarContentHovered(state, action) {
      state.sidebarContentHovered = action.payload
    },
    clearSidebarHover(state) {
      state.sidebarTriggerHovered = false
      state.sidebarContentHovered = false
    },
    toggleChat(state) {
      state.chatOpen = !state.chatOpen
    },
    setChatOpen(state, action) {
      state.chatOpen = action.payload
    },
    toggleAllChatsPanel(state) {
      state.allChatsPanelOpen = !state.allChatsPanelOpen
    },
    setAllChatsPanelOpen(state, action) {
      state.allChatsPanelOpen = action.payload
    },
    setActiveNav(state, action) {
      state.activeNav = action.payload
    },
    toggleConfigure(state) {
      state.configureOpen = !state.configureOpen
    },
    setConfigureOpen(state, action) {
      state.configureOpen = action.payload
    },
    addToast(state, action) {
      state.toasts.push({
        id:      Date.now(),
        message: action.payload.message,
        type:    action.payload.type || 'info',
      })
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload)
    },
  },
})

export const { toggleSidebar, setSidebarOpen, setSidebarTriggerHovered, setSidebarContentHovered, clearSidebarHover, toggleChat, setChatOpen, toggleAllChatsPanel, setAllChatsPanelOpen, setActiveNav, toggleConfigure, setConfigureOpen, addToast, removeToast } = uiSlice.actions
export default uiSlice.reducer

export const selectSidebarOpen           = (state) => state.ui.sidebarOpen
export const selectSidebarTriggerHovered = (state) => state.ui.sidebarTriggerHovered
export const selectSidebarContentHovered = (state) => state.ui.sidebarContentHovered
export const selectChatOpen              = (state) => state.ui.chatOpen
export const selectAllChatsPanelOpen     = (state) => state.ui.allChatsPanelOpen
export const selectActiveNav             = (state) => state.ui.activeNav
export const selectToasts                = (state) => state.ui.toasts
export const selectConfigureOpen         = (state) => state.ui.configureOpen
