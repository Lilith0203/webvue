<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth' 
import axios from '../api'
import QRCode from 'qrcode'

const router = useRouter()
const authStore = useAuthStore() 
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// 小程序扫码登录（网页端）
const scanMode = ref(false)
const scanLoading = ref(false)
const scanError = ref('')
const scanLoginId = ref('')
const scanQrUrl = ref('')
let scanTimer = null

const props = defineProps({
  // 作为弹窗使用时，不自动跳转
  redirect: { type: Boolean, default: true },
  redirectTo: { type: String, default: '/' }
})

const emit = defineEmits(['success', 'cancel'])

const stopScanPolling = () => {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

const startScanLogin = async () => {
  scanError.value = ''
  scanLoading.value = true
  stopScanPolling()

  try {
    const redirect = props.redirectTo || '/'
    const res = await axios.post('/auth/weapp-web/create', { redirect })
    if (!res.data?.success) throw new Error(res.data?.message || '创建二维码失败')
    const { loginId, qrText } = res.data.data
    scanLoginId.value = loginId
    scanQrUrl.value = await QRCode.toDataURL(qrText, { margin: 1, width: 240 })

    scanTimer = setInterval(async () => {
      try {
        const st = await axios.get('/auth/weapp-web/status', { params: { loginId } })
        const status = st.data?.data?.status
        if (status === 'confirmed') {
          const token = st.data?.data?.token
          const user = st.data?.data?.user
          const role = st.data?.data?.role
          const redirectPath = st.data?.data?.redirect || redirect
          stopScanPolling()
          if (token) {
            authStore.setAuth({ username: user || 'weapp', role: role || 'user' }, token)
            emit('success')
            if (props.redirect) router.push(redirectPath)
          } else {
            scanError.value = '扫码成功但未拿到 token'
          }
        } else if (status === 'expired') {
          stopScanPolling()
          scanError.value = '二维码已过期，请刷新二维码'
        }
      } catch {
        // 轮询失败不打断
      }
    }, 1000)
  } catch (e) {
    scanError.value = e?.response?.data?.message || e?.message || '创建二维码失败'
  } finally {
    scanLoading.value = false
  }
}

onMounted(() => {
  // 默认不自动启动，用户手动切换
})

onBeforeUnmount(() => {
  stopScanPolling()
})

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

    const serverUser = response.data?.data?.user
    const serverRole = response.data?.data?.role
    // 存储token
    authStore.setAuth(
      {
        // 用服务端返回的真实用户名（保持大小写一致）
        username: serverUser || username.value,
        role: serverRole || 'user'
      },
      response.data.data.token
    )

    // 登录成功后跳转
    emit('success')
    if (props.redirect) {
      router.push(props.redirectTo || '/')
    }
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
      <div class="login-tabs">
        <button type="button" class="tab" :class="{ active: !scanMode }" @click="scanMode=false; stopScanPolling()">密码登录</button>
        <button type="button" class="tab" :class="{ active: scanMode }" @click="scanMode=true; startScanLogin()">小程序扫码</button>
      </div>

      <form v-if="!scanMode" @submit.prevent="handleLogin">
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

      <div v-else class="scan-area">
        <div v-if="scanError" class="error-message">{{ scanError }}</div>
        <div v-if="scanLoading" class="scan-loading">二维码生成中...</div>
        <div v-else class="scan-box">
          <img v-if="scanQrUrl" :src="scanQrUrl" alt="扫码登录二维码" class="qr-img" />
          <div class="scan-hint">
            用微信小程序扫一扫，确认后网页将自动登录
          </div>
          <button type="button" class="refresh-btn" @click="startScanLogin">刷新二维码</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0px auto;
}

.login-box {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.tab {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e5e5e5;
  background: #fafafa;
  border-radius: 6px;
  cursor: pointer;
  color: #555;
  font-size: 0.9rem;
}
.tab.active {
  border-color: #42b883;
  background: #e9f7f1;
  color: #2f8a63;
  font-weight: 600;
}

.scan-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scan-loading {
  color: #666;
  margin-top: 10px;
}
.scan-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.qr-img {
  width: 240px;
  height: 240px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
}
.scan-hint {
  color: #666;
  font-size: 13px;
  text-align: center;
}
.refresh-btn {
  width: auto;
  padding: 6px 12px;
  background: var(--color-green);
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.refresh-btn:hover {
  border-color: #42b883;
}

h2 {
  text-align: center;
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.1rem;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
}

input:focus {
  outline: none;
  border-color: #42b883;
}

button {
  width: 100%;
  padding: 0.5rem;
  background-color: var(--color-green);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #3aa876;
  color: #fff;
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