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
        //可以添加token等认证信息
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
        //统一错误处理
        console.error('API请求错误:', error)
        return Promise.reject(error)
    }
)

export const getData = () => api.get('/data')
export const postData = (data) => api.post('/data', data)
