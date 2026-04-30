import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen:   true,
  activeNav:     'Home',
  notifications: [],
  toasts:        [],
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
    setActiveNav(state, action) {
      state.activeNav = action.payload
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

export const { toggleSidebar, setSidebarOpen, setActiveNav, addToast, removeToast } = uiSlice.actions
export default uiSlice.reducer

export const selectSidebarOpen = (state) => state.ui.sidebarOpen
export const selectActiveNav   = (state) => state.ui.activeNav
export const selectToasts      = (state) => state.ui.toasts
