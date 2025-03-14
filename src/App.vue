<script setup>
import { RouterLink, RouterView } from 'vue-router'
import Banner from './components/Banner.vue'
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'
import { ref, onMounted, onUnmounted, computed, watch} from 'vue'
import { imageRefreshService } from './services/imageRefresh'

const authStore = useAuthStore()
const router = useRouter()
const activeMenu = ref('')
const submenuHeight = ref(0)
const menuTimeout = ref(null)
// 当前显示的二维码索引
const activeQR = ref(null)
const isMobile = ref(false)

const menuConfig = [
  {
    label: 'Home',
    key: 'home',
    path: '/',
  },
  {
    label: '手工',
    key: 'work',
    children: [
      {label: '杂货铺', path: '/works'},
      {label: '材料整理', path: '/material'},
      {label: '格子图工具', path: '/painter'},
    ]
  },
  {
    label: '文章',
    key: 'article',
    path: '/article',
  },
  {
    label: '小工具',
    key: 'program',
    children: [
      {label: '颜色管理', path: '/color'},
      {label: '小游戏', path: '/program'},
    ]
  }
]

// 社交媒体配置
const socialLinks = [
  {
    name: 'B站',
    icon: 'iconfont icon-bzhan',
    qrCode: '/images/bilibili.jpg'
  },
  {
    name: '小红书',
    icon: 'iconfont icon-xiaohongshu',
    qrCode: '/images/xiaohongshu.png'
  }
]

// 切换子菜单
const toggleSubmenu = (key) => {
  if (activeMenu.value === key) {
    activeMenu.value = ''
    submenuHeight.value = 0
  } else {
    activeMenu.value = key
    // 计算子菜单高度
    submenuHeight.value = 48 // 基础高度
  }
}

// 关闭子菜单
const closeSubmenu = () => {
  activeMenu.value = ''
  submenuHeight.value = 0
}

// 显示二维码
const showQRCode = (index) => {
  if (!isMobile.value) {  // 仅在非移动设备上响应hover
    activeQR.value = index
  }
}

// 隐藏二维码
const hideQRCode = () => {
  if (!isMobile.value) {  // 仅在非移动设备上响应hover
    activeQR.value = null
  }
}

// 切换二维码显示（用于移动端点击）
const toggleQRCode = (index) => {
  if (isMobile.value) {
    activeQR.value = activeQR.value === index ? null : index
  }
}

const handleLogout = async () => {
  authStore.clearAuth()
  await router.push('/')
}

const handleAdmin = async () => {
  await router.push('/admin')
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (menuTimeout.value) {
    clearTimeout(menuTimeout.value)
  }
  // 停止自动刷新服务
  imageRefreshService.stopAutoRefresh()
})

onMounted(() => {
  isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  // 启动自动刷新服务
  imageRefreshService.startAutoRefresh()
})

// 路由变化时关闭子菜单
watch(() => router.path, (newPath) => {
  closeSubmenu()
})

</script>

<template>
  <footer class="top-fixed">
    <h3 class="links">
      常用链接：
      <a href="https://github.com/Lilith0203/" target="_blank" rel="noopener">Git</a>,
      <a href="https://www.iconfont.cn/" target="_blank" rel="noopener">iconfont</a> 
    </h3>
    <div v-if="authStore.isAuthenticated" class="logout">
      <button type="button" @click.prevent="handleLogout">退出</button>
      <button type="button" @click.prevent="handleAdmin" class="admin-button">管理</button>
    </div>
  </footer>
  <div id="container">
  <header>
    <div class="wrapper">
      <Banner msg="&nbsp;" />

      <nav>
        <!-- 遍历生成菜单 -->
        <template v-for="menu in menuConfig" :key="menu.key || menu.path">
          <!-- 一级菜单（无子菜单） -->
          <RouterLink 
            v-if="!menu.children" 
            :to="menu.path"
            class="nav-link">
            <div class="nav-link-text">
              <i class="iconfont icon-huawen"></i>
              {{ menu.label }}
              <i v-if="menu.key===`program`" class="iconfont icon-huawen"></i>
            </div>
          </RouterLink>

          <!-- 带子菜单的菜单项 -->
          <div 
            v-else 
            class="submenu-container">

            <div 
              class="submenu-trigger green"
              @click="toggleSubmenu(menu.key)">
              <i class="iconfont icon-huawen"></i>
              {{ menu.label }}
            </div>
          
            <!-- 子菜单 -->
            <Transition name="submenu">
              <div 
                v-show="activeMenu === menu.key"
                class="submenu">
                <RouterLink 
                  v-for="subMenu in menu.children"
                  :key="subMenu.path"
                  :to="subMenu.path"
                  class="submenu-item"
                  @click="closeSubmenu">
                  {{ subMenu.label }}
                </RouterLink>
              </div>
            </Transition>
          </div>
        </template>
      </nav>

      <div class="social-links" >
        <span>欢迎关注：</span>
        <div class="social-item" 
          v-for="(item, index) in socialLinks" 
          :key="index"
          @mouseenter="showQRCode(index)"
          @mouseleave="hideQRCode"
          @click="toggleQRCode(index)">
          <div class="social-icon">
            <i :class="item.icon"></i>
          </div>
      
          <!-- 二维码弹出层 -->
          <div class="qr-popup" v-show="activeQR === index">
            <img :src="item.qrCode" :alt="item.name">
          </div>
        </div>
      </div>
        
    </div>
  </header>

  <div class="router-view-container">
    <RouterView />
  </div>
</div>
<footer class="bottom-fixed">
    <p>Copyright © 2024-2025 沪ICP备2024106280号
      <span class="about-link"><a href="#" @click.prevent="router.push('/about')">关于我</a></span>
    </p>
</footer>
</template>

<style scoped>
#container {
  max-width: 1280px;
  margin: 0 auto;
}

.top-fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 30px;
  background-color: #3E3E3E;
  z-index: 1000;
  margin-bottom: 10px;
  line-height: 30px;
}

.logout {
  position: absolute;
  top: 4px;
  right: 2rem;
}

.logout button {
  float: right;
  font-size: 12px;
  background-color: var(--color-red);
  color: white;
  padding: 3px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.logout button:hover {
  background-color: var(--color-red-hover);
}

.bottom-fixed {
  width: 100%;
  background-color: #3E3E3E;
  height: 32px;
  line-height: 32px;
  text-align: center;
  margin-top: 30px;
  color: #fff;
  font-size: 0.8rem;
}

.links {
  color: #fff;
  font-size: 0.75rem;
  margin-left: 2rem;
}

.links a:hover {
  color: #fff;
}

header {
  line-height: 1.3;
  max-height: 100vh;
  padding: 3.5rem 2rem 0.5rem 2rem;
  border-bottom: 1px dashed var(--color-border);
}

.router-view-container {
  padding: 0 1.5rem 0.5rem;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  text-align: center;
  margin: 0.5rem 0 0 0;
  display: flex;  /* 添加 flex 布局 */
  align-items: center;  /* 垂直居中 */
  justify-content: center;
}

nav a {
  display: block;
}

.nav-link-text,
.submenu-trigger {
  padding: 0px 0px;
  text-decoration: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.submenu-trigger:hover,
.nav-link-text:hover {
  color: var(--color-text);
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

.submenu {
  font-size: 14px;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 110px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.submenu a {
  color: #FA7C9B;
}

.submenu-item {
  display: block;
  padding: 12px 16px;
  color: var(--color-text);
  text-decoration: none;
  transition: background-color 0.2s;
  border-bottom: 1px dashed var(--color-border);
}

.submenu-container {
  display: inline-block;
  position: relative;
}

.social-links {
  display: flex;
  justify-content: center;
  line-height: 32px;
  width: 100%;
  font-size: 14px;
}

.social-item {
  position: relative;
  cursor: pointer;
  text-align: center;
}

.social-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.social-icon i {
  font-size: 26px;
  transition: color 0.3s;
}

/* 二维码弹出层样式 */
.qr-popup {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 10px;
  
  /* 添加动画 */
  animation: fadeIn 0.3s ease;
}

.qr-popup::after {
  content: '';
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-bottom-color: white;
}

.qr-popup img {
  width: 240px;
  height: 240px;
  display: block;
}

.icon-huawen {
  font-size: 28px;
}

.logout .admin-button{
  margin-right: 10px;
  background-color: var(--color-blue);
}
.logout .admin-button:hover {
  background-color: var(--color-blue);
}

.about-link {
  margin-left: 10px;
}

.about-link a{
  padding: 0;
  color: #fff;
  text-decoration: underline;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (min-width: 1024px) {
  #container {
    display: flex;
    flex-wrap: wrap;
    grid-template-columns: 1fr 1fr;
  }

  header {
    width: 350px;
    display: flex;
    place-items: center;
    padding-right: 0;
    border-right: 1px dashed var(--color-border);
    border-bottom: none;
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;
    justify-content: left;
    padding: 1rem 0;
    margin-top: 1rem;
  }

  .router-view-container {
    transition: margin-top 0.3s ease;
    flex: 1;
    max-width: 960px;
    margin-top: 30px;
  }

  .qr-popup img {
    width: 280px;
    height: 280px;
  }

  .social-links {
    justify-content: left;
    font-size: 15px;
  }
}
</style>
