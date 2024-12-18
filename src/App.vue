<script setup>
import { RouterLink, RouterView } from 'vue-router'
import Banner from './components/Banner.vue'
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'
import { ref, onUnmounted, computed, watch} from 'vue'

const authStore = useAuthStore()
const router = useRouter()

const menuConfig = [
  {
    label: 'Home',
    path: '/',
  },
  {
    label: '手工',
    key: 'work',
    path: '/work',
    children: [
      {label: '材料整理', path: '/material'},
      {label: '格子图工具', path: '/painter'},
    ]
  },
  {
    label: '文章',
    path: '/article',
  },
  {
    label: 'About',
    path: '/about',
  }
]

// 社交媒体配置
const socialLinks = [
  {
    name: 'B站',
    icon: 'iconfont icon-bzhan',
    qrCode: 'https://lilithu.oss-cn-shanghai.aliyuncs.com/images/default.jpg'
  },
]

const activeMenu = ref('')
const submenuHeight = ref(0)
const menuTimeout = ref(null)
// 当前显示的二维码索引
const activeQR = ref(null)

// 计算内容区域的偏移量
const submenuOffset = computed(() => {
  return activeMenu.value ? submenuHeight.value : 0
})

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

// 路由变化时关闭子菜单
watch(() => router.path, (newPath) => {
  closeSubmenu()
})

// 显示二维码
const showQRCode = (index) => {
  activeQR.value = index
}

// 隐藏二维码
const hideQRCode = () => {
  activeQR.value = null
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (menuTimeout.value) {
    clearTimeout(menuTimeout.value)
  }
})

const handleLogout = async () => {
  authStore.clearAuth()
  await router.push('/login')
}

</script>

<template>
  <header>
    <div class="wrapper">
      <Banner msg="Lilith" />

      <nav>
        <!-- 遍历生成菜单 -->
        <template v-for="menu in menuConfig" :key="menu.key || menu.path">
          <!-- 一级菜单（无子菜单） -->
          <RouterLink 
              v-if="!menu.children" 
              :to="menu.path"
              class="nav-link">
            {{ menu.label }}
          </RouterLink>

          <!-- 带子菜单的菜单项 -->
          <div 
            v-else 
            class="submenu-container">

            <div 
              class="submenu-trigger"
              @click="toggleSubmenu(menu.key)"
            >
            {{ menu.label }}
          </div>
          
          <!-- 子菜单 -->
          <Transition name="submenu">
              <div 
                v-show="activeMenu === menu.key"
                class="submenu"
              >
                <RouterLink 
                  v-for="subMenu in menu.children"
                  :key="subMenu.path"
                  :to="subMenu.path"
                  class="submenu-item"
                  @click="closeSubmenu"
                >
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
              @mouseleave="hideQRCode">
            <div class="social-icon">
              <i :class="item.icon"></i>
            </div>
      
            <!-- 二维码弹出层 -->
            <div class="qr-popup" v-show="activeQR === index">
              <img :src="item.qrCode" :alt="item.name">
            </div>
          </div>
        </div>
          
        <div v-if="authStore.isAuthenticated" class="logout">
          <a href="#" @click.prevent="handleLogout">退出登录</a></div>
    </div>
  </header>

  <div class="router-view-container">
    <RouterView />
  </div>
</template>

<style scoped>
header {
  line-height: 1.3;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 14px;
  text-align: center;
  margin-top: 1rem;
  position: relative;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

.nav-link,
.submenu-trigger {
  display: inline-block;
  padding: 12px 16px;
  text-decoration: none;
  cursor: pointer;
  color: hsla(160, 100%, 37%, 1);
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

.submenu-item {
  display: block;
  padding: 12px 16px;
  color: var(--color-text);
  text-decoration: none;
  transition: background-color 0.2s;
}

/* 子菜单动画 */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.3s ease;
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.submenu-container {
  display: inline-block;
  position: relative;
  border-left: 1px solid var(--color-border);
}

.submenu-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 箭头图标 */
.arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid currentColor;
  transition: transform 0.3s ease;
}

.arrow-down {
  transform: rotate(180deg);
}

.logout {
  position: absolute;
  top: 10px;
  right: 30px;
}

.social-links {
  display: flex;
  gap: 20px;
  padding: 20px 10px 0 0;
  line-height: 32px;
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
  font-size: 32px;
  transition: color 0.3s;
}

/* 二维码弹出层样式 */
.qr-popup {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-bottom: 10px;
  
  /* 添加动画 */
  animation: fadeIn 0.3s ease;
}

.qr-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-top-color: white;
}

.qr-popup img {
  width: 120px;
  height: 120px;
  display: block;
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
  header {
    width: 400px;
    min-width: 390px;
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logout {
    margin-top: 60px;
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

    padding: 1rem 0;
    margin-top: 1rem;
  }

  .router-view-container {
    transition: margin-top 0.3s ease;
    min-width: 800px;
  }

  .qr-popup img {
    width: 240px;
    height: 240px;
  }
}
</style>
