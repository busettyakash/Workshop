import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Landing    from './pages/Landing/index'
import Login      from './pages/Auth/Login'
import Signup     from './pages/Auth/Signup'
import Dashboard  from './pages/Dashboard/index'
import Products   from './pages/Products/index'
import Billing    from './pages/Billing/index'
import Customers  from './pages/Customers/index'

// UI
import ToastContainer from './components/ui/Toast'

// Redux
import { useAppSelector } from './redux/hooks'
import { selectIsAuth }   from './redux/slices/authSlice'

// Placeholder inner page (for routes not yet built)
import PlaceholderPage from './pages/Placeholder'

/* ── Private Route Guard ── */
function PrivateRoute({ children }) {
  const isAuth = useAppSelector(selectIsAuth)
  // Also check localStorage token as fallback during page refresh
  const token  = localStorage.getItem('ws_token')
  return (isAuth || token) ? children : <Navigate to="/login" replace />
}

/* ── Public Route (redirect if already logged in) ── */
function PublicRoute({ children }) {
  const isAuth = useAppSelector(selectIsAuth)
  const token  = localStorage.getItem('ws_token')
  return (isAuth || token) ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public */}
        <Route path="/"       element={<Landing />} />
        <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

        {/* Protected */}
        <Route path="/dashboard"    element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/products"     element={<PrivateRoute><Products /></PrivateRoute>} />
        <Route path="/billing"      element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/customers"    element={<PrivateRoute><Customers /></PrivateRoute>} />
        <Route path="/categories"   element={<PrivateRoute><PlaceholderPage title="Categories" /></PrivateRoute>} />
        <Route path="/history"      element={<PrivateRoute><PlaceholderPage title="Bill History" /></PrivateRoute>} />
        <Route path="/reports"      element={<PrivateRoute><PlaceholderPage title="Reports" /></PrivateRoute>} />
        <Route path="/notifications"element={<PrivateRoute><PlaceholderPage title="Notifications" /></PrivateRoute>} />
        <Route path="/settings"     element={<PrivateRoute><PlaceholderPage title="Settings" /></PrivateRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
