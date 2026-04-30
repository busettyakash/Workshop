import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi } from '../../services/authApi'

// ── Async Thunks ──────────────────────────────────────────
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authApi.login({ email, password })
      localStorage.setItem('ws_token', data.token)
      localStorage.setItem('ws_user', JSON.stringify({ shopName: data.shopName, email: data.email }))
      return data
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
      localStorage.setItem('ws_token', data.token)
      localStorage.setItem('ws_user', JSON.stringify({ shopName: data.shopName, email: data.email }))
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed. Please try again.')
    }
  }
)

// ── Initial State ─────────────────────────────────────────
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('ws_user') || 'null') } catch { return null }
}

const initialState = {
  user:    getStoredUser(),
  token:   localStorage.getItem('ws_token') || null,
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
      state.user  = null
      state.token = null
      state.status = 'idle'
      state.error  = null
      localStorage.removeItem('ws_token')
      localStorage.removeItem('ws_user')
    },
    clearError(state) {
      state.error = null
    },
    setEmailStep(state, action) {
      state.emailStep = action.payload
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
        state.user   = { shopName: action.payload.shopName, email: action.payload.email }
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
        state.user   = { shopName: action.payload.shopName, email: action.payload.email }
        state.token  = action.payload.token
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error  = action.payload
      })
  },
})

export const { logout, clearError, setEmailStep } = authSlice.actions
export default authSlice.reducer

// Selectors
export const selectAuth       = (state) => state.auth
export const selectUser       = (state) => state.auth.user
export const selectToken      = (state) => state.auth.token
export const selectIsAuth     = (state) => !!state.auth.token
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError  = (state) => state.auth.error
