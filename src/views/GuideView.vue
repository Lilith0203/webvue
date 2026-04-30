<script setup>
import axios from '../api'
import { ref, onMounted, watch, computed } from 'vue'
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
const categories = ref([])
const selectedCategory = ref('')

// 添加缩写映射
const abbreviationMap = {
  '时空中的绘旅人': '绘旅人',
  '世界之外': '世外',
  '光与夜之恋': '光夜',
  '未定事件簿': '未定',
  '恋与深空': '深空'
}

// 获取显示名称（手机端使用略写，桌面端使用全称）
const getDisplayName = (category) => {
  return abbreviationMap[category] || category
}

// 获取全称显示名称（桌面端使用）
const getFullDisplayName = (category) => {
  return category
}

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

// 进入详情时带上当前列表查询参数（用于返回时保持分类/页码等状态）
const goToGuideDetail = (id) => {
  router.push({
    path: `/guide/${id}`,
    query: { ...route.query }
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
      <div v-if="error" class="error">{{ error }}</div>

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
          <span class="category-name-mobile">{{ getDisplayName(category) }}</span>
          <span class="category-name-desktop">{{ getFullDisplayName(category) }}</span>
        </div>
        <span v-if="isAdmin" class="publish-new">
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
          <!-- 桌面端：缩略图在最左侧 -->
          <div v-if="guide.thumbnail" class="g-thumb desktop-thumb" @click.prevent="goToGuideDetail(guide.id)">
            <img :src="guide.thumbnail" :alt="guide.title || '缩略图'" />
          </div>
          <div class="g-content">
            <div class="operation">
              <div class="g-category">
                <span class="category-label">游戏: </span>
                <span
                  class="category-name"
                  @click.stop="selectCategory(guide.category)"
                >
                  {{ getFullDisplayName(guide.category) }}
                </span>
                <span v-if="guide.tags" class="g-tags">
                  <span
                    v-for="tag in guide.tags.split(',').map(t => t.trim()).filter(Boolean)"
                    :key="tag"
                    class="g-tag"
                  >
                    {{ tag }}
                  </span>
                </span>
              </div>
              <span v-if="isAdmin" class="edit-delete">
                <a class="edit" 
                  href="#"
                  @click.prevent="router.push(`/guide/${guide.id}/edit`)"><i class="iconfont icon-edit"></i></a>
                <a class="delete" href="#" @click.prevent="handleDelete(guide.id)"><i class="iconfont icon-ashbin"></i></a>
              </span>
            </div>
            <!-- 手机端：缩略图放在分类标签下面、标题上面 -->
            <div v-if="guide.thumbnail" class="g-thumb mobile-thumb" @click.prevent="goToGuideDetail(guide.id)">
              <img :src="guide.thumbnail" :alt="guide.title || '缩略图'" />
            </div>
            <h1 class="g-title"><a href="#" @click.prevent="goToGuideDetail(guide.id)">{{guide.title}}</a></h1>
            <div class="g-brief-text">
              <p>{{ guide.content ? guide.content.substring(0, 40) + (guide.content.length > 100 ? '...' : '') : '' }}
                <a href="#" @click.prevent="goToGuideDetail(guide.id)" class="read-detail">（阅读全文）</a>
              </p>
            </div>
            <time class="update-time" :datetime="guide?.updatedAt">最后更新时间：<span>{{ formatUpdateTime(guide.updatedAt) }}</span></time>
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
  gap: 8px;
  margin-bottom: 15px;
  align-items: center;
}

.category-item {
  padding: 3px 8px;
  background: #82bd98;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #fff;
  transition: all 0.3s ease;
}

.category-item.active {
  background: #4a90e2;
}

.g-brief {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px dashed #e4e4e4;
  padding-bottom: 0.5rem;
}

.g-thumb {
  width: 120px;
  height: 86px;
  margin: 10px 10px 0 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
  background: #fafafa;
  flex: 0 0 140px;
  cursor: pointer;
}

.g-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 默认：只显示桌面端缩略图位置 */
.mobile-thumb {
  display: none;
}

@media (max-width: 768px) {
  /* 手机端：缩略图放进内容区，列表左侧不留图 */
  .desktop-thumb {
    display: none;
  }

  .mobile-thumb {
    display: block;
    width: 100%;
    max-width: 520px;
    height: 160px;
    margin: 8px 0 6px;
    flex: none;
  }

  .g-brief {
    display: block;
  }
}

.g-content {
  flex: 1;
}

.operation {
  display: flex;
  justify-content: space-between;
}

.g-category {
  font-size: 0.85rem;
  line-height: 2em;
}

.g-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: 12px;
  vertical-align: middle;
}

.g-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eb7785;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.6;
}

.category-label {
  color: #666;
}

.category-name {
  color: var(--color-blue);
  transition: all 0.3s ease;
  padding: 0px 0px 1px 0;
  margin: 0 3px;
  border-bottom: 1px dashed #5e5e5e;
  cursor: pointer;
}

.category-name:hover {
  opacity: 0.6;
  transform: translateY(-1px);
}

.g-title {
  line-height: 2.5;
  /* 消除 h1 默认 margin，并让文字行在自身盒子内垂直居中 */
  margin: 0;
  display: flex;
  align-items: center;
}

.g-title a {
  padding: 0;
  font-size: 1rem;
  color: #5e5e5e;
  font-weight: bold;
  display: flex;
  align-items: center;
}

.g-title a:hover {
  color: var(--color-font)
}

.read-detail {
  color: #499e8d;
  padding: 0;
}

.g-brief-text {
  text-indent: 2em;
  font-size: 0.9rem;
}

.update-time {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #9da09e;
}

.pages {
  text-align: center;
  color: #9da09e;
  font-size: 0.95rem;
}

.pages span, .pages a {
  padding: 3px;
  margin-right: 8px;
}

.pages .cur {
  font-size: 1rem;
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
  font-size: 0.8rem;
  color: #fff;
}

.edit-delete i {
  padding: 2px;
  font-size: 1.1rem;
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
  padding: 5px 6px;
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

.category-name-mobile {
  display: block;
}

.category-name-desktop {
  display: none;
}

@media (min-width: 1024px) {
  .category-name-mobile {
    display: none;
  }
  
  .category-name-desktop {
    display: block;
  }
  
  .search-wrapper {
    justify-content: left;
  }
}
</style> 