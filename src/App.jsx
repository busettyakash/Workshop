import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Landing     from './pages/Landing/index'
import Login       from './pages/Auth/Login'
import Signup      from './pages/Auth/Signup'
import Dashboard   from './pages/Dashboard/index'
import Products    from './pages/Products/index'
import Billing     from './pages/Billing/index'
import BillForm    from './pages/Billing/BillForm'
import Workflows   from './pages/Workflows/index'
import ReportsPage from './pages/Reports/index'
import ImportStock     from './pages/ImportStock/index'
import ImportStockForm from './pages/ImportStock/ImportStockForm'
import Paid    from './pages/Paid/index'
import Unpaid  from './pages/Unpaid/index'
import People   from './pages/People/index'
import PersonForm from './pages/People/PersonForm'
import Notifications from './pages/Notifications/index'
import Deals    from './pages/Deals/index'
import DealForm from './pages/Deals/DealForm'
import DealReview from './pages/Deals/DealReview'
import DealLogs from './pages/DealLogs/index'
import PlaceholderPage from './pages/Placeholder'

// UI
import ToastContainer from './components/ui/Toast'

// Redux
import { useAppSelector } from './redux/hooks'
import { selectIsAuth } from './redux/slices/authSlice'

/* ── Private Route Guard ── */
function PrivateRoute({ children }) {
  const isAuth = useAppSelector(selectIsAuth)
  const token  = sessionStorage.getItem('ws_token')
  return (isAuth || token) ? children : <Navigate to="/login" replace />
}

/* ── Public Route (redirect if already logged in) ── */
function PublicRoute({ children }) {
  const isAuth = useAppSelector(selectIsAuth)
  const token  = sessionStorage.getItem('ws_token')
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
        <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/products"    element={<PrivateRoute><Products /></PrivateRoute>} />
        <Route path="/billing"     element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/billing/add" element={<PrivateRoute><BillForm /></PrivateRoute>} />
        <Route path="/workflows"   element={<PrivateRoute><Workflows /></PrivateRoute>} />
        <Route path="/reports"     element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/notes"       element={<PrivateRoute><PlaceholderPage title="Notes" /></PrivateRoute>} />
        <Route path="/import-stock"          element={<PrivateRoute><ImportStock /></PrivateRoute>} />
        <Route path="/import-stock/add"      element={<PrivateRoute><ImportStockForm /></PrivateRoute>} />
        <Route path="/import-stock/edit/:id" element={<PrivateRoute><ImportStockForm /></PrivateRoute>} />
        <Route path="/paid"      element={<PrivateRoute><Paid /></PrivateRoute>} />
        <Route path="/unpaid"    element={<PrivateRoute><Unpaid /></PrivateRoute>} />
        <Route path="/people"    element={<PrivateRoute><People /></PrivateRoute>} />
        <Route path="/people/add" element={<PrivateRoute><PersonForm /></PrivateRoute>} />
        <Route path="/people/edit/:id" element={<PrivateRoute><PersonForm /></PrivateRoute>} />
        <Route path="/companies"    element={<Navigate to="/" replace />} />
        <Route path="/companies/add" element={<Navigate to="/" replace />} />
        <Route path="/companies/edit/:id" element={<Navigate to="/" replace />} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/deals"     element={<PrivateRoute><Deals /></PrivateRoute>} />
        <Route path="/deals/add"  element={<PrivateRoute><DealForm /></PrivateRoute>} />
        <Route path="/deals/edit/:id" element={<PrivateRoute><DealForm /></PrivateRoute>} />
        <Route path="/deals/review/:id" element={<PrivateRoute><DealReview /></PrivateRoute>} />
        <Route path="/deal-logs" element={<PrivateRoute><DealLogs /></PrivateRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
