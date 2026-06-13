import apiClient from '../api/client'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeOtp = (otp) => String(otp || '').replace(/\D/g, '').slice(0, 6)

export const authApi = {
  login: async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email: normalizeEmail(email), password })
    return res.data
  },

  register: async (data) => {
    const res = await apiClient.post('/auth/register', {
      shopName:     data.shopName,
      gstinNumber:  data.gstin,
      mobileNumber: data.mobile,
      email:        normalizeEmail(data.email),
      password:     data.password,
    })
    return res.data
  },

  me: async () => {
    const res = await apiClient.get('/auth/me')
    return res.data
  },

  logout: async () => {
    try { await apiClient.post('/auth/logout') } catch (_) {}
  },

  sendOtp: async (email) => {
    const res = await apiClient.post('/auth/send-otp', { email: normalizeEmail(email) })
    return res.data
  },

  // For LOGIN: checks if email is registered first, then sends OTP
  sendLoginOtp: async (email) => {
    const res = await apiClient.post('/auth/send-login-otp', { email: normalizeEmail(email) })
    return res.data
  },

  verifyOtp: async (email, otp) => {
    const res = await apiClient.post('/auth/verify-otp', { email: normalizeEmail(email), otp: normalizeOtp(otp) })
    return res.data
  },
}
