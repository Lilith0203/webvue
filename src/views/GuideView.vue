<script setup>
import axios from '../api'
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { confirm } from '../utils/confirm'

const authStore = useAuthStore()

const route = useRoute()
const router = useRouter()
const backendData = ref(null)
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const categories = ref([])
const selectedCategory = ref('')

// 格式化日期为 2025-07-03 15:46:11 格式
const formatDate = (dateString) => {
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

// 获取分类列表
const fetchCategories = async () => {
  try {
    const response = await axios.get('/guide/categories')
    categories.value = response.data.data || []
  } catch (err) {
    console.error('获取分类失败:', err)
  }
}

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const page = route.query.page || 1
    const size = route.query.size || 8
    const category = route.query.category || selectedCategory.value
    const response = await axios.get(`/guide?`, {
      params: {
        page,
        size,
        category,
        search: searchQuery.value
      }
    })
    backendData.value = response.data.data
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

const searchGuides = () => {
  fetchData()
}

// 选择分类
const selectCategory = (category) => {
  selectedCategory.value = category
  router.push({
    path: '/guide',
    query: { 
      ...route.query, 
      category: category || undefined,
      page: 1 
    }
  })
}

// 处理删除
const handleDelete = async (id) => {
  if (await confirm('确定要删除这个攻略吗？')) {
    try {
      await axios.post(`/guide/delete`, {id:id})
      router.push('/guide')
      await fetchData()
    } catch (error) {
      console.error('删除失败:', error)
    }
  }
}

// 清空搜索框
const clearSearch = () => {
  searchQuery.value = ''
  fetchData()
}

onMounted(() => {
  fetchCategories()
  fetchData()
})

// 监听路由变化
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
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <!-- 分类选择 -->
      <div class="categories-wrapper">
        <div class="category-item" 
          :class="{ active: !route.query.category }"
          @click="selectCategory('')">
          全部
        </div>
        <div class="category-item" 
          v-for="category in categories" 
          :key="category"
          :class="{ active: route.query.category === category }"
          @click="selectCategory(category)">
          {{ category }}
        </div>
        <span v-if="authStore.isAuthenticated" class="publish-new">
          <a href="/guide/publish" @click.prevent="router.push('/guide/publish')">发布+</a>
        </span>
      </div>

      <div class="search-wrapper">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索攻略..." 
          class="search-input"
          @keyup.enter="searchGuides" />
        <button @click="clearSearch" class="clear-button">x</button>
        <button @click="searchGuides" class="search-button"><i class="iconfont icon-sousuo"></i></button>
      </div>

      <div class="list-wrapper" v-if="backendData">
        <article class="g-brief" v-for="guide in backendData.guides" :key="guide.id">
          <time :datetime="guide?.createdAt" class="create-time">
            <span class="time-date">{{ formatDate(guide.createdAt) }}</span>
          </time>
          <div class="g-content">
            <div class="operation">
              <div class="g-category">
                <span class="category-label">分类: </span>
                <span class="category-name">{{ guide.category }}</span>
              </div>
              <span v-if="authStore.isAuthenticated" class="edit-delete">
                <a class="edit" 
                  href="#"
                  @click.prevent="router.push(`/guide/${guide.id}/edit`)"><i class="iconfont icon-bianji"></i></a>
                <a class="delete" href="#" @click.prevent="handleDelete(guide.id)"><i class="iconfont icon-shanchu"></i></a>
              </span>
            </div>
            <h1 class="g-title"><a href="#" @click.prevent="router.push(`/guide/${guide.id}`)">{{guide.title}}</a></h1>
            <div class="g-brief-text">
              <p>{{ guide.content ? guide.content.substring(0, 50) + (guide.content.length > 100 ? '...' : '') : '' }}
                <a href="#" @click.prevent="router.push(`/guide/${guide.id}`)" class="read-detail">（阅读全文）</a>
              </p>
            </div>
            <time class="update-time" :datetime="guide?.updatedAt">最后更新时间：<span>{{ formatDate(guide.updatedAt) }}</span></time>
          </div>
        </article>

        <div class="pages">
          <span>当前页：<span class="cur">{{backendData.page_now}}</span>/{{backendData.page_all}}页</span>
          <a v-if="backendData.page_now !== 1"
            @click.prevent="router.push(`/guide?page=${backendData.page_now-1}${route.query.category ? '&category=' + route.query.category : ''}`)"
            href="#" 
            class='able'>上一页</a>
          <a v-if="backendData.page_now !== backendData.page_all" 
            href="#" 
            @click.prevent="router.push(`/guide?page=${backendData.page_now+1}${route.query.category ? '&category=' + route.query.category : ''}`)"
            class='able'>下一页</a>
          <a href="#" 
            @click.prevent="router.push(`/guide?page=${backendData.page_all}${route.query.category ? '&category=' + route.query.category : ''}`)"
            class='able'>尾页</a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.guides-header {
  font-size: 0.9rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
}

.content-wrapper {
  margin: 20px auto 20px;
}

.categories-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
}

.category-item {
  padding: 2px 8px;
  background: white;
  border: 1px solid #e4e4e4;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.category-item:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.category-item.active {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.g-brief {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px dashed #e4e4e4;
  padding-bottom: 0.5rem;
}

.g-title {
  font-size: 18px;
  line-height: 45px;
}

.create-time {
  flex: 0 0 60px;
  height: 86px;
  padding-top: 15px;
  margin-right: 20px;
  background: url(/images/article-time.png) no-repeat;
  color: #d6d6d6;
  text-align: center;
  font-size: 12px;
  line-height: initial;
}

.create-time span {
  font-weight: bold;
}

.time-date {
  font-size: 18px;
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
  font-size: 0.8rem;
  transition: all 0.3s ease;
  padding: 0px 0px 1px 0;
  margin: 0 3px;
  border-bottom: 1px dashed #5e5e5e;
}

.category-name:hover {
  opacity: 0.6;
  transform: translateY(-1px);
}

.g-title a {
  font-size: 18px;
  line-height: 45px;
  color: #5e5e5e;
  font-weight: bold;
}

.g-title a:hover {
  color: var(--color-font)
}

.read-detail {
  color: #499e8d
}

.g-brief-text {
  text-indent: 2em;
}

.update-time {
  display: block;
  margin-top: 0.6rem;
  font-size: 0.8rem;
  color: #9da09e;
}

.update-time span {
  color: #5e5e5e;
}

.pages {
  text-align: center;
  color: #9da09e;
}

.pages span, .pages a {
  padding: 3px;
  margin-right: 8px;
}

.pages .cur {
  font-size: 1.1rem;
  padding: 0;
  margin-right: 2px;
  color: #5e5e5e
}

.current-category {
  color: #fff;
  background-color: rgb(111, 104, 177);
  font-size: 0.8rem;
  padding: 2px 2px 2px 5px;
  border-radius: 4px;
}

.clear-category {
  color: #fff;
  font-weight: bold;
}

.publish-new {
  background-color: #499e8d;
  padding: 0px 4px;
  border-radius: 4px;
  margin-left: auto;
}

.publish-new:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.publish-new a {
  color: #fff;
}

.edit-delete i {
  margin-left: 10px;
  padding: 1px;
  font-size: 1.2rem;
  border-radius: 4px;
}

.edit-delete i:hover {
  border: 1px dashed #9da09e;
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

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #dc3545;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.guide-actions {
  display: flex;
  gap: 10px;
}

.publish-btn {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.publish-btn:hover {
  background-color: #0056b3;
}

.edit-btn {
  padding: 4px 8px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-btn:hover {
  background-color: #218838;
}

@media (min-width: 1024px) {
  .search-wrapper {
    justify-content: left;
  }
}
</style> 