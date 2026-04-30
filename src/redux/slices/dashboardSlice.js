import { createSlice } from '@reduxjs/toolkit'
import { DEMO_STATS, DEMO_PRODUCTS, DEMO_CUSTOMERS } from '../../constants'

const initialState = {
  stats:     DEMO_STATS,
  products:  DEMO_PRODUCTS,
  customers: DEMO_CUSTOMERS,
  loading:   false,
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setLoading(state, action) {
      state.loading = action.payload
    },
  },
})

export const { setLoading } = dashboardSlice.actions
export default dashboardSlice.reducer

export const selectStats     = (state) => state.dashboard.stats
export const selectProducts  = (state) => state.dashboard.products
export const selectCustomers = (state) => state.dashboard.customers
