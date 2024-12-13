import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
})

//请求拦截器
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
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
    error => {
        //token 过期或无效
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api