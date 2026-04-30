import { configureStore } from '@reduxjs/toolkit'
import authReducer      from './slices/authSlice'
import uiReducer        from './slices/uiSlice'
import dashboardReducer from './slices/dashboardSlice'

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    ui:        uiReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
})

export default store
