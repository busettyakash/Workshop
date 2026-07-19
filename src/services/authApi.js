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
      email:        normalizeEmail(data.email),
      password:     data.password,
      shopName:     data.shopName || data.companyName,
      phone:        data.phone || data.mobileNumber,
      mobileNumber: data.phone || data.mobileNumber,
      gstin:        data.gstin,
      workspaceHandle: data.workspaceHandle,
      billingCountry: data.billingCountry,
      referralSource: data.referralSource,
      usageType:    data.usageType,
      inviteEmail:  data.inviteEmail,
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

  invite: async ({ email, role }) => {
    const res = await apiClient.post('/auth/invite', { email, role })
    return res.data
  },

  getWorkspaces: async () => {
    const res = await apiClient.get('/auth/workspaces')
    return res.data
  },

  getMembers: async () => {
    const res = await apiClient.get('/auth/members')
    return res.data
  },
}

