import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ArticleView from '../views/ArticleView.vue'
import ArticleDetailView from '../views/ArticleDetailView.vue'
import WorkerView from '../views/WorkerView.vue'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/article/:id',
      name: 'articleDetail',
      component: ArticleDetailView,
    },
    {
      path: '/article',
      name: 'article',
      component: ArticleView,
    },
    {
      path: '/work',
      name: 'work',
      component: WorkerView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    }
  ],
})

//添加路由守护
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const publicPages = ['/login','/article','/','/about','/work']
  const authRequired = !publicPages.includes(to.path)

  if (authRequired && !authStore.isAuthenticated) {
    return next({
      path: '/login',
      query: {redirect: to.fullPath}
    })
  }
  // 如果已登录且访问登录页，重定向到首页
  if (to.path === '/login' && authStore.isAuthenticated) {
    return next('/')
  }
  next()
})

export default router
