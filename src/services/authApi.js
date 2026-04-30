import apiClient from '../api/client'

export const authApi = {
  login: async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email, password })
    return res.data
  },

  register: async (data) => {
    const res = await apiClient.post('/auth/register', {
      shopName:     data.shopName,
      gstinNumber:  data.gstin,
      mobileNumber: data.mobile,
      email:        data.email,
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
}
