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
      email:           normalizeEmail(data.email),
      password:        data.password,
      firstName:       data.firstName || data.first_name,
      lastName:        data.lastName || data.last_name,
      first_name:      data.firstName || data.first_name,
      last_name:       data.lastName || data.last_name,
      shopName:        data.shopName || data.companyName,
      companyName:     data.shopName || data.companyName,
      phone:           data.phone || data.mobileNumber,
      mobileNumber:    data.phone || data.mobileNumber,
      gstin:           data.gstin,
      workspaceHandle: data.workspaceHandle,
      billingCountry:  data.billingCountry,
      referralSource:  data.referralSource,
      usageType:       data.usageType,
      inviteEmail:     data.inviteEmail,
      isInvite:        data.isInvite,
      inviteFrom:      data.inviteFrom,
      workspace:       data.workspace,
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


  // For FORGOT PASSWORD: checks if email is registered first, then sends OTP
  sendResetOtp: async (email) => {
    const res = await apiClient.post('/auth/send-reset-otp', { email: normalizeEmail(email) })
    return res.data
  },

  resetPassword: async ({ email, otp, newPassword }) => {
    const res = await apiClient.post('/auth/reset-password', {
      email: normalizeEmail(email),
      otp: normalizeOtp(otp),
      newPassword
    })
    return res.data
  },

  verifyOtp: async (email, otp) => {
    const res = await apiClient.post('/auth/verify-otp', { email: normalizeEmail(email), otp: normalizeOtp(otp) })
    return res.data
  },

  invite: async ({ email, role, permissions }) => {
    const res = await apiClient.post('/auth/invite', { email, role, permissions })
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

  updateMemberPermissions: async (memberId, { role, permissions }) => {
    const res = await apiClient.put(`/auth/members/${memberId}/permissions`, { role, permissions })
    return res.data
  },

  deleteMember: async (memberId) => {
    const res = await apiClient.delete(`/auth/members/${memberId}`)
    return res.data
  },
}

