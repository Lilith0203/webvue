<script setup>
import { RouterLink, RouterView } from 'vue-router'
import Banner from './components/Banner.vue'
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'
import { ref, onUnmounted } from 'vue'

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
      {label: '格子图工具', path: '/painter'}
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

const activeMenu = ref('')
const menuTimeout = ref(null)

const handleMenuEnter = (key) => {
  if (menuTimeout.value) {
    clearTimeout(menuTimeout.value)
    menuTimeout.value = null
  }
  activeMenu.value = key
}

const handleMenuLeave = () => {
  menuTimeout.value = setTimeout(() => {
    activeMenu.value = ''
  }, 100) // 添加一个小延迟
}

const handleSubmenuEnter = () => {
  if (menuTimeout.value) {
    clearTimeout(menuTimeout.value)
    menuTimeout.value = null
  }
}

const handleSubmenuLeave = () => {
  handleMenuLeave()
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
              :to="menu.path">
            {{ menu.label }}
          </RouterLink>

          <!-- 带子菜单的菜单项 -->
          <div 
            v-else 
            class="submenu-container"
            @mouseenter="handleMenuEnter(menu.key)"
            @mouseleave="handleMenuLeave">
          <RouterLink class="submenu-trigger" :to="menu.path">{{ menu.label }}</RouterLink>
          <!-- 子菜单 -->
          <div 
              class="submenu" 
              :class="{ 'active': activeMenu === menu.key }"
              @mouseenter="handleSubmenuEnter"
              @mouseleave="handleSubmenuLeave">
              <RouterLink 
                v-for="subMenu in menu.children"
                :key="subMenu.path"
                :to="subMenu.path"
                class="submenu-item">
                {{ subMenu.label }}
              </RouterLink>
            </div>
          </div>
        </template>
        <template v-if="authStore.isAuthenticated">
          <a href="#" @click.prevent="handleLogout">退出</a>
        </template>
      </nav>
    </div>
  </header>

  <div class="router-view-container">
    <RouterView />
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
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

.submenu {
  display: none;
}

.submenu-container {
  display: inline-block;
}

@media (min-width: 1024px) {
  header {
    max-width: 360px;
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
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
    flex: 1;
  }

  .submenu-container {
    position: relative;
    display: inline-block;
  }

.submenu-trigger {
  padding: 0 1rem;
  cursor: pointer;
  border-left: 1px solid var(--color-border);
}

.submenu {
  font-size: 14px;
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.5rem 0;
  min-width: 150px;
  display: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  /* 添加一个小间隙，确保鼠标移动时不会失去悬停状态 */
  margin-top: -1px;
}

.submenu.active {
  display: block;
}

/* 添加一个透明的连接区域 */
.submenu::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 10px;
  background: transparent;
}

.submenu-item {
  display: block;
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: var(--color-text);
  white-space: nowrap;
}

.submenu-item:hover {
  background-color: var(--color-background-soft);
}

  .submenu-container {
    display: inline-block;
  }

  .submenu-trigger {
    display: inline-block;
  }

  .submenu {
    margin-top: 0.5rem;
  }
}
</style>
