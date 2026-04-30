<script setup>
import axios from '../api'
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { confirm } from '../utils/confirm'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAuthenticated && authStore.user?.role === 'admin')

const route = useRoute()
const router = useRouter()

const backendData = ref(null)
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')

// 格式化日期为分层显示格式
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return {
    day: date.getDate().toString().padStart(2, '0'),
    month: date.getMonth() + 1,
    month_en: date.toLocaleString('en', { month: 'short' }),
    year: date.getFullYear()
  }
}

// 格式化最后更新时间
const formatUpdateTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const fetchData = async () => {
  loading.value = true
  error.value = null
  try {
    const page = route.query.page || 1
    const size = route.query.size || 8
    const response = await axios.get(`/menus`, {
      params: {
        page,
        size,
        search: searchQuery.value
      }
    })
    backendData.value = response.data.data
  } catch (err) {
    error.value = '获取数据失败：' + err.message
  } finally {
    loading.value = false
  }
}

const search = () => {
  router.push({
    path: '/kitchen',
    query: { ...route.query, page: 1 }
  })
  fetchData()
}

const clearSearch = () => {
  searchQuery.value = ''
  router.push({ path: '/kitchen', query: { page: 1 } })
  fetchData()
}

const handleDelete = async (id) => {
  if (!isAdmin.value) return
  if (await confirm('确定要删除这个菜单吗？')) {
    try {
      await axios.post(`/menus/delete`, { id })
      await fetchData()
    } catch (e) {
      console.error('删除失败:', e)
    }
  }
}

const goPublish = () => {
  if (!isAdmin.value) return
  router.push({ path: '/menu/new' })
}

onMounted(() => {
  fetchData()
})

watch(
  () => route.query,
  () => {
    fetchData()
  },
  { deep: true }
)
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div class="page-head">
        <h2 class="title">小厨房</h2>
        <span class="sub">适合单人食的菜单</span>
        <span v-if="isAdmin" class="publish-new">
          <a href="/menu/new" @click.prevent="goPublish">发布+</a>
        </span>
      </div>

      <div class="search-wrapper">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索菜单..."
          class="search-input"
          @keyup.enter="search"
        />
        <button @click="clearSearch" class="clear-button" type="button">x</button>
        <button @click="search" class="search-button" type="button">
          <i class="iconfont icon-sousuo"></i>
        </button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <div class="list-wrapper" v-else-if="backendData">
        <article class="g-brief" v-for="m in backendData.menus" :key="m.id">
          <time :datetime="m?.createdAt" class="create-time">
            <span class="time-date">{{ formatDate(m.createdAt).month }}.{{ formatDate(m.createdAt).day }}</span><br />
            <span>{{ formatDate(m.createdAt).month_en }}.</span><br />
            <span>{{ formatDate(m.createdAt).year }}</span>
          </time>
          <div class="g-content">
            <div class="operation">
              <div class="g-category">
                <span class="category-label">主食: </span>
                <span class="category-name">{{ m.staple || '未填写' }}</span>
              </div>
              <span v-if="isAdmin" class="edit-delete">
                <a class="edit" href="#" @click.prevent="router.push(`/menu/${m.id}/edit`)"><i class="iconfont icon-edit"></i></a>
                <a class="delete" href="#" @click.prevent="handleDelete(m.id)"><i class="iconfont icon-ashbin"></i></a>
              </span>
            </div>
            <h1 class="g-title">
              <a href="#" @click.prevent="router.push(`/menu/${m.id}`)">{{ m.name }}</a>
            </h1>
            <div class="g-brief-text">
              <p>
                {{ m.ingredients ? m.ingredients.substring(0, 50) + (m.ingredients.length > 100 ? '...' : '') : '' }}
                <a href="#" @click.prevent="router.push(`/menu/${m.id}`)" class="read-detail">（查看详情）</a>
              </p>
            </div>
            <time class="update-time" :datetime="m?.updatedAt">最后更新时间：<span>{{ formatUpdateTime(m.updatedAt) }}</span></time>
          </div>
        </article>

        <div class="pages" v-if="backendData.page_all">
          <span>当前页：<span class="cur">{{ backendData.page_now }}</span>/{{ backendData.page_all }}页</span>
          <a
            v-if="backendData.page_now !== 1"
            @click.prevent="router.push(`/kitchen?page=${backendData.page_now - 1}`)"
            href="#"
            class="able"
          >上一页</a>
          <a
            v-if="backendData.page_now !== backendData.page_all"
            href="#"
            @click.prevent="router.push(`/kitchen?page=${backendData.page_now + 1}`)"
            class="able"
          >下一页</a>
          <a href="#" @click.prevent="router.push(`/kitchen?page=${backendData.page_all}`)" class="able">尾页</a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.content-wrapper {
  margin: 20px auto 20px;
}

.page-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}

.title {
  font-size: 1.1rem;
  font-weight: bold;
  margin: 0;
}

.sub {
  color: #888;
  font-size: 0.9rem;
}

.publish-new {
  background-color: #499e8d;
  padding: 0px 5px;
  border-radius: 4px;
  margin-left: auto;
}

.publish-new a {
  font-size: 0.8rem;
  color: #fff;
  padding: 0;
}

.search-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.search-input {
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.search-wrapper button {
  background: transparent;
  border: none;
  cursor: pointer;
}

.clear-button {
  color: #9da09e;
  position: relative;
  left: -20px;
}

.search-button {
  position: relative;
  left: -15px;
}

.icon-sousuo {
  font-size: 1.3rem;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #dc3545;
}

.g-brief {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px dashed #e4e4e4;
  padding-bottom: 0.5rem;
}

.create-time {
  flex: 0 0 60px;
  height: 86px;
  padding-top: 15px;
  margin-right: 12px;
  background: url(/images/article-time.png) no-repeat;
  color: #d6d6d6;
  text-align: center;
  font-size: 12px;
  line-height: initial;
}

.time-date {
  font-size: 18px;
  font-weight: bold;
}

.g-content {
  flex: 1;
}

.operation {
  display: flex;
  justify-content: space-between;
}

.g-category {
  font-size: 14px;
  line-height: 1.8em;
}

.category-label {
  color: #666;
  font-size: 12px;
}

.category-name {
  color: #499e8d;
  font-size: 0.8rem;
  transition: all 0.3s ease;
  padding: 0px 0px 1px 0;
  margin: 0 3px;
  border-bottom: 1px dashed #5e5e5e;
}

.g-title {
  line-height: 1.5;
}

.g-title a {
  padding: 0;
  font-size: 1rem;
  color: #5e5e5e;
  font-weight: bold;
}

.g-brief-text {
  text-indent: 2em;
}

.read-detail {
  color: #499e8d;
  padding: 0;
}

.update-time {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #9da09e;
}

.update-time span {
  color: #5e5e5e;
}

.edit-delete i {
  margin-left: 10px;
  padding: 1px;
  font-size: 1.2rem;
  border-radius: 4px;
}

.pages {
  text-align: center;
  color: #9da09e;
}

.pages span,
.pages a {
  padding: 3px;
  margin-right: 8px;
}

.pages .cur {
  font-size: 1.1rem;
  padding: 0;
  margin-right: 2px;
  color: #5e5e5e;
}
</style>

