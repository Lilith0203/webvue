import { defineStore } from 'pinia'
import axios from '../api'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore('auth', {
    state: () => {
      const savedUser = localStorage.getItem('user')
      const savedToken = localStorage.getItem('token')
      
      // 检查 token 是否存在
      const hasToken = !!savedToken
      
      return {
        user: hasToken && savedUser ? JSON.parse(savedUser) : null,
        token: hasToken ? savedToken : null,
        isAuthenticated: hasToken  // 只要有 token 就认为已认证
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
        },
    
        clearAuth() {
          this.user = null
          this.token = null
          this.isAuthenticated = false
          localStorage.removeItem('user')
          localStorage.removeItem('token')
          delete axios.defaults.headers.common['Authorization']
        },
        
        // 检查 token 是否过期
        checkAuth() {
          if (!this.token) {
            return false;
          }
          
          try {
            const decodedToken = jwtDecode(this.token);
            
            // 确保 decodedToken.exp 存在
            if (!decodedToken.exp) {
              return true;  // 如果没有过期时间，假设 token 有效
            }
            
            const expTime = new Date(decodedToken.exp * 1000);
            const now = new Date();
            
            const isValid = expTime > now;
            
            if (!isValid) {
              this.clearAuth();
            }
            
            return isValid;
          } catch (error) {
            console.error("Error decoding token:", error);
            console.error("Token that caused error:", this.token);
            this.clearAuth();
            return false;
          }
        }
    },

    getters: {
        username: (state) => state.user?.username || ''
    }
})