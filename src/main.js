import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vImage, setupGlobalImageErrorHandler } from './utils/image'

const app = createApp(App)
const pinia = createPinia()

app.directive('image', vImage)

// 全局禁用右键菜单
document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    return false
})

// 设置全局图片错误处理
setupGlobalImageErrorHandler()

app.use(pinia)
app.use(router)

app.mount('#app')
