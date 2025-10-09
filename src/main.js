import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vImage, vVideo, setupGlobalImageErrorHandler } from './utils/image'
import VCalendar from 'v-calendar'
import 'v-calendar/style.css'

const app = createApp(App)
const pinia = createPinia()

app.directive('image', vImage)
app.directive('video', vVideo)

// 全局禁用右键菜单
document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    return false
})

// 设置全局图片错误处理
setupGlobalImageErrorHandler()

app.use(pinia)
app.use(router)
app.use(VCalendar)

app.mount('#app')
