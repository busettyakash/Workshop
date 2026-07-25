import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Landing     from './pages/Landing/index'
import Login       from './pages/Auth/Login'
import Signup      from './pages/Auth/Signup'
import ForgotPassword from './pages/Auth/ForgotPassword'

// Pages
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
import PriceHistory from './pages/PriceHistory/index'
import Quotes from './pages/Quotes/index'
import Notes  from './pages/Notes/index'
import Emails from './pages/Emails/index'
import Settings from './pages/Settings/index'

// UI
import ToastContainer from './components/ui/Toast'

// Redux
import { useAppSelector } from './redux/hooks'
import { selectIsAuth } from './redux/slices/authSlice'

/* ── Private Route Guard ── */
function PrivateRoute({ children }) {
  const isAuth = useAppSelector(selectIsAuth)
  return isAuth ? children : <Navigate to="/login" replace />
}

export default function App() {

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public */}
        <Route path="/"               element={<Landing />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/signup"         element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Private App Routes */}
        <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/products"    element={<PrivateRoute><Products /></PrivateRoute>} />
        <Route path="/price-history" element={<PrivateRoute><PriceHistory /></PrivateRoute>} />
        <Route path="/billing"     element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/billing/new"  element={<PrivateRoute><BillForm /></PrivateRoute>} />
        <Route path="/billing/add"  element={<PrivateRoute><BillForm /></PrivateRoute>} />
        <Route path="/billing/edit/:id" element={<PrivateRoute><BillForm /></PrivateRoute>} />
        <Route path="/quotes"      element={<PrivateRoute><Quotes /></PrivateRoute>} />
        <Route path="/workflows"   element={<PrivateRoute><Workflows /></PrivateRoute>} />
        <Route path="/reports"     element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/notes"       element={<PrivateRoute><Notes /></PrivateRoute>} />
        <Route path="/emails"      element={<PrivateRoute><Emails /></PrivateRoute>} />
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
        <Route path="/deals"     element={<Navigate to="/price-history" replace />} />
        <Route path="/deals/*"   element={<Navigate to="/price-history" replace />} />
        <Route path="/deal-logs" element={<Navigate to="/price-history" replace />} />
        <Route path="/settings"  element={<PrivateRoute><Settings /></PrivateRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
