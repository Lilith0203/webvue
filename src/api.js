import axios from 'axios'
import { useAuthStore } from './stores/auth'

const api = axios.create({
    baseURL: '/api',
    timeout: 50000,
    headers: {
        'Content-Type': 'application/json'
    }
})

//请求拦截器
api.interceptors.request.use(
    config => {
        const authStore = useAuthStore()
        if (authStore.token) {
            config.headers.Authorization = `Bearer ${authStore.token}`
        }//可以添加token等认证信息
        return config
    },
    error => {
        return Promise.reject(error)
    }
)

//响应拦截器
api.interceptors.response.use(
    response => response,
    async error => {
        const authStore = useAuthStore()
        
        //token 过期或无效
        if (error.response?.status === 401) {
            authStore.clearAuth()
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api