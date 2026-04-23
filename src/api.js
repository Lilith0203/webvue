import axios from 'axios'
import { useAuthStore } from './stores/auth'

const api = axios.create({
    baseURL: '/api',
    timeout: 300000, // 5分钟超时，适合大文件上传
    headers: {
        'Content-Type': 'application/json'
    }
})

//请求拦截器
api.interceptors.request.use(
    config => {
        const authStore = useAuthStore()

        // 检查 token 是否过期
        if (authStore.token) {
            const isValid = authStore.checkAuth();

            if (!isValid) {
                authStore.clearAuth();
            }
        }
        
        // 如果有 token，添加到请求头
        if (authStore.token) {
            config.headers.Authorization = `Bearer ${authStore.token}`;
        }
        
        return config;
    },
    error => {
        console.error("Request interceptor error:", error);
        return Promise.reject(error);
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
            // 不强制跳转到登录页：保持在当前页面，由页面自行提示/弹窗登录
        }
        return Promise.reject(error)
    }
)

export default api