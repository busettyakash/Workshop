import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen:   true,
  chatOpen:      true,
  activeNav:     'Home',
  notifications: [],
  toasts:        [],
  configureOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload
    },
    toggleChat(state) {
      state.chatOpen = !state.chatOpen
    },
    setChatOpen(state, action) {
      state.chatOpen = action.payload
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

export const { toggleSidebar, setSidebarOpen, toggleChat, setChatOpen, setActiveNav, toggleConfigure, setConfigureOpen, addToast, removeToast } = uiSlice.actions
export default uiSlice.reducer

export const selectSidebarOpen = (state) => state.ui.sidebarOpen
export const selectChatOpen    = (state) => state.ui.chatOpen
export const selectActiveNav   = (state) => state.ui.activeNav
export const selectToasts      = (state) => state.ui.toasts
export const selectConfigureOpen = (state) => state.ui.configureOpen
