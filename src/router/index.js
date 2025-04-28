import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ArticleView from '../views/ArticleView.vue'
import ArticleDetailView from '../views/ArticleDetailView.vue'
import WorkView from '../views/WorkView.vue'
import WorkDetailView from '../views/WorkDetailView.vue'
import MaterialView from '../views/MaterialView.vue'
import MaterialType from '../components/MaterialType.vue'
import GridPainter from '../components/GridPainter.vue'
import LoginView from '../views/LoginView.vue'
import AdminView from '../views/Admin.vue'
import ProgramView from '../views/ProgramView.vue'
import ColorManager from '../views/ColorManager.vue'
import Story from '../views/StoryView.vue'
import StoryDetailView from '../components/StoryDetailView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        keepAlive: true
      }
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
      path: '/publish',
      name: 'publish',
      component: () => import('../views/ArticleEditor.vue')
    },
    {
      path: '/article/:id/edit',
      name: 'edit-article',
      component: () => import('../views/ArticleEditor.vue')
    },
    {
      path: '/works',
      name: 'works',
      component: WorkView,
    },
    {
      path: '/works/:id',
      name: 'workDetail',
      component: WorkDetailView
    },
    {
      path: '/painter',
      name: 'painter',
      component: GridPainter,
    },
    {
      path: '/material',
      name: 'material',
      component: MaterialView,
    },
    {
      path: '/material/type',
      name: 'materialType',
      component: MaterialType,
    },
    {
      path: '/color',
      name: 'color',
      component: ColorManager,
    },
    {
      path: '/story',
      name: 'story',
      component: Story,
    },
    {
      path: '/story/:id',
      name: 'storyDetail',
      component: StoryDetailView
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
      path: '/program',
      name: 'program',
      component: ProgramView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView
    }
  ],
})

//添加路由守护
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const privatePages = [
    '/material/type',
    '/publish',
    '/article/:id/edit',
    '/admin'
  ]
  const authRequired = privatePages.includes(to.path)

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
