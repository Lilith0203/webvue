<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth' 
import axios from '../api'

const router = useRouter()
const authStore = useAuthStore() 
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await axios.post('/login', {
      username: username.value,
      password: password.value
    }) // 调试用

    if (!response.data.data.token) {
      throw new Error('No token received')
    }
    // 存储token
    authStore.setAuth(
      {
        username: username.value,
      },
      response.data.data.token
    )

    // 登录成功后跳转
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.message || '登录失败'
    authStore.clearAuth()
  } finally {
    loading.value = false
  }
}
</script>

<template>
    <div class="login-container">
        <div class="login-box">
            <h2>登录</h2>
            <form @submit.prevent="handleLogin">
                <div class="form-group">
                    <label for="username">用户名</label>
                    <input 
                        id="username"
                        v-model="username"
                        type="text"
                        placeholder="请输入用户名"
                        required>
                </div>
                <div class="form-group">
                    <label for="password">密码</label>
                    <input 
                        id="password"
                        v-model="password"
                        type="password"
                        placeholder="请输入密码"
                        required>
                </div>
                <div v-if="error" class="error-message">{{ error }}</div>
                <button type="submit" :disabled="loading">
                    {{ loading ? '登录中...' : '登录' }}
                </button>
            </form>
        </div>
    </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 60px auto;
}

.login-box {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #42b883;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #3aa876;
}

button:disabled {
  background-color: #a8d5c2;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  margin-bottom: 1rem;
  text-align: center;
}
</style>