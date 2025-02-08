import { defineStore } from 'pinia'
import axios from '../api'

export const useAuthStore = defineStore('auth', {
    state: () => {
      const savedUser = localStorage.getItem('user')
      const savedToken = localStorage.getItem('token')
      
      return {
        user: savedUser ? JSON.parse(savedUser) : null,
        token: savedToken || null,
        isAuthenticated: !!savedToken 
      }
    },
    
    actions: {
        setAuth(user, token) {
          this.user = user
          this.token = token
          this.isAuthenticated = true 
          localStorage.setItem('user', JSON.stringify(user))
          localStorage.setItem('token', token)
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          // 设置一个定时器来在令牌过期后清除认证信息
          const tokenExpirationTime = 24 * 3600 * 1000; // 假设令牌有效期为24小时
          setTimeout(() => {
            this.clearAuth(); // 令牌过期后清除认证
          }, tokenExpirationTime);
        },
    
        clearAuth() {
          this.user = null
          this.token = null
          this.isAuthenticated = false
          localStorage.removeItem('user')
          localStorage.removeItem('token')
          delete axios.defaults.headers.common['Authorization']
        }
    },

    getters: {
        username: (state) => state.user?.username || ''
    }
})