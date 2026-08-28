import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi } from '../../services/authApi'

// ── Async Thunks ──────────────────────────────────────────
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authApi.login({ email, password })
      const userObj = {
        shopName: data.user.shopName,
        email: data.user.email,
        firstName: data.user.firstName || data.user.first_name || '',
        lastName: data.user.lastName || data.user.last_name || '',
        phone: data.user.phone || '',
        gstin: data.user.gstin || ''
      }
      sessionStorage.setItem('ws_token', data.token)
      sessionStorage.setItem('ws_user', JSON.stringify(userObj))
      sessionStorage.setItem('ws_active_workspace_id', data.activeWorkspaceId || data.user.id)
      sessionStorage.setItem('ws_active_workspace_name', data.activeWorkspaceName || data.user.shopName)
      sessionStorage.setItem('ws_active_role', data.activeRole || 'Owner')
      if (data.activePermissions) {
        sessionStorage.setItem('ws_active_permissions', JSON.stringify(data.activePermissions))
      } else {
        sessionStorage.removeItem('ws_active_permissions')
      }
      return { ...data, successMessage: 'Welcome back! Login successful.' }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Invalid email or password.')
    }
  }
)

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (formData, { rejectWithValue }) => {
    try {
      const data = await authApi.register(formData)
      const userObj = {
        shopName: data.user.shopName,
        email: data.user.email,
        firstName: data.user.firstName || data.user.first_name || '',
        lastName: data.user.lastName || data.user.last_name || '',
        phone: data.user.phone || '',
        gstin: data.user.gstin || ''
      }
      sessionStorage.setItem('ws_token', data.token)
      sessionStorage.setItem('ws_user', JSON.stringify(userObj))

      // If the user was previously invited to a workspace, auto-switch to that workspace
      if (data.defaultWorkspaceId) {
        sessionStorage.setItem('ws_active_workspace_id', data.defaultWorkspaceId)
        sessionStorage.setItem('ws_active_workspace_name', data.defaultWorkspaceName || data.user.shopName)
      } else {
        sessionStorage.setItem('ws_active_workspace_id', data.user.id)
        sessionStorage.setItem('ws_active_workspace_name', data.user.shopName)
      }

      // Set role & permissions so PrivateRoute and Sidebar read correct values immediately
      sessionStorage.setItem('ws_active_role', data.activeRole || 'Owner')
      if (data.activePermissions) {
        sessionStorage.setItem('ws_active_permissions', JSON.stringify(data.activePermissions))
      } else {
        sessionStorage.removeItem('ws_active_permissions')
      }

      return { ...data, successMessage: 'Workspace created successfully! Welcome.' }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed. Please try again.')
    }
  }
)

// ── Initial State ─────────────────────────────────────────
const getStoredUser = () => {
  try { 
    return typeof sessionStorage !== 'undefined' ? JSON.parse(sessionStorage.getItem('ws_user') || 'null') : null 
  } catch { 
    return null 
  }
}

const initialState = {
  user:    getStoredUser(),
  token:   typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('ws_token') || null) : null,
  status:  'idle',   // 'idle' | 'loading' | 'succeeded' | 'failed'
  error:   null,
  emailStep: 'email', // 'email' | 'checking' | 'password'
}

// ── Slice ─────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user      = null
      state.token     = null
      state.status    = 'idle'
      state.error     = null
      state.emailStep = 'email'
      // Clear ALL user-specific keys so switching accounts is fully clean
      sessionStorage.removeItem('ws_token')
      sessionStorage.removeItem('ws_user')
      sessionStorage.removeItem('ws_active_workspace_id')
      sessionStorage.removeItem('ws_active_workspace_name')
      sessionStorage.removeItem('ws_favorites')
    },
    clearError(state) {
      state.error = null
    },
    setEmailStep(state, action) {
      state.emailStep = action.payload
    },
    updateUser(state, action) {
      state.user = { ...state.user, ...action.payload }
      sessionStorage.setItem('ws_user', JSON.stringify(state.user))
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading'
        state.error  = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user   = {
          shopName: action.payload.user.shopName,
          email: action.payload.user.email,
          firstName: action.payload.user.firstName || action.payload.user.first_name || '',
          lastName: action.payload.user.lastName || action.payload.user.last_name || '',
          phone: action.payload.user.phone || '',
          gstin: action.payload.user.gstin || ''
        }
        state.token  = action.payload.token
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error  = action.payload
      })

    // Register
    builder
      .addCase(registerThunk.pending, (state) => {
        state.status = 'loading'
        state.error  = null
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user   = {
          shopName: action.payload.user.shopName,
          email: action.payload.user.email,
          firstName: action.payload.user.firstName || action.payload.user.first_name || '',
          lastName: action.payload.user.lastName || action.payload.user.last_name || '',
          phone: action.payload.user.phone || '',
          gstin: action.payload.user.gstin || ''
        }
        state.token  = action.payload.token
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error  = action.payload
      })
  },
})

export const { logout, clearError, setEmailStep, updateUser } = authSlice.actions
export default authSlice.reducer

// Selectors
export const selectAuth       = (state) => state.auth
export const selectUser       = (state) => state.auth.user
export const selectToken      = (state) => state.auth.token
export const selectIsAuth     = (state) => !!state.auth.token
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError  = (state) => state.auth.error
