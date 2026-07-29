import axios from 'axios'

export const AUTH_TOKEN_KEY = 'nordepo_auth_token'
export const SUCURSAL_KEY = 'nordepo_sucursal_id'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

const token = localStorage.getItem(AUTH_TOKEN_KEY)
if (token) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
