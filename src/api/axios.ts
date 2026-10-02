import axios, { type AxiosError } from 'axios'
import { useKeycloak } from '@/composables/useKeycloak'
import { env } from '@/env'

const api = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token from Keycloak automatically added to requests
api.interceptors.request.use(
  async (config) => {
    const keycloak = useKeycloak()
    const token = await keycloak.getAccessToken()
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Global error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 401: Not authenticated -> Try to refresh, then redirect to login
    if (error.response?.status === 401) {
      const keycloak = useKeycloak()
      
      // Try to ensure valid token (silent refresh)
      const hasValidToken = await keycloak.ensureValidToken()
      
      if (!hasValidToken) {
        // Clear any stored data
        try {
          localStorage.removeItem('user')
        } catch {
          /* storage blocked in embedded iframe */
        }

        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          const returnUrl = window.location.pathname
          await keycloak.login(returnUrl)
        }
      }
    }
    
    // 403: Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data)
    }
    
    return Promise.reject(error)
  }
)

export default api
