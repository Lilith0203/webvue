<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import WorkEditor from '../components/WorkEditor.vue'
import { confirm } from '../utils/confirm'
import { getTagColor, getTextColor, initTagColors } from '../utils/tags'
import Announcement from '../components/Announcement.vue'

const authStore = useAuthStore()
//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})

const currentPage = ref(1)
const pageSize = ref(16)
const totalPages = ref(1)
const totalItems = ref(0)
const targetPage = ref('') // 用于页码跳转输入框
const loading = ref(false)
const hasMore = ref(true)
const allTags = ref([])
const selectedTags = ref([])
const router = useRouter()
const route = useRoute()
const works = ref([])
// 拖拽相关状态
const showEditor = ref(false)
const editorMode = ref('create')
const currentWork = ref(null)
const searchKeyword = ref('')
const isSearching = ref(false)

const showRecommended = ref(false)
const recommendedWorks = ref([])
const loadingRecommended = ref(false)
const recommendedPage = ref(1)
const recommendedHasMore = ref(true)

// 切换标签
const toggleTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  // 重置并重新加载
  works.value = []
  currentPage.value = 1
  hasMore.value = true
  fetchWorks()
}

// 打开新建编辑器
const openCreateEditor = () => {
  currentWork.value = null
  editorMode.value = 'create'
  showEditor.value = true
}

// 打开编辑编辑器
const openEditEditor = (work) => {
  currentWork.value = work
  editorMode.value = 'edit'
  showEditor.value = true
}

// 处理编辑成功
const handleEditorSuccess = async () => {
  // 更新列表数据
  showEditor.value = false
  //重置列表状态
  hasMore.value = true
  works.value = []
  currentPage.value = 1
  await fetchWorks()
  await fetchTags()
}

// 关闭编辑器
const closeEditor = () => {
  showEditor.value = false
}

// 生成唯一ID的函数
const generateClientId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 获取或创建客户端ID
const getClientId = () => {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = generateClientId();
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}

// 点赞
const toggleLike = async (event, workId) => {
  event.stopPropagation() // 阻止事件冒泡，避免触发卡片点击
  
  try {
    const response = await axios.post('/interaction/like', {
      type: 2,
      itemId: workId,
      clientId: getClientId()
    })
    
    if (response.data.success) {
      // 更新作品列表中的点赞数据
      updateWorkLikeStatus(workId, response.data.data.hasLiked, response.data.data.like)
    }
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

// 更新作品点赞状态（同时更新普通列表和推荐列表）
const updateWorkLikeStatus = (workId, hasLiked, likeCount) => {
  // 更新普通作品列表
  const workIndex = works.value.findIndex(w => w.id === workId)
  if (workIndex !== -1) {
    works.value[workIndex].hasLiked = hasLiked
    works.value[workIndex].likeCount = likeCount
  }
  
  // 更新推荐作品列表
  const recommendedIndex = recommendedWorks.value.findIndex(w => w.id === workId)
  if (recommendedIndex !== -1) {
    recommendedWorks.value[recommendedIndex].hasLiked = hasLiked
    recommendedWorks.value[recommendedIndex].likeCount = likeCount
  }
}

// 推荐
const toggleRecommend = async (event, workId) => {
  event.stopPropagation() // 阻止事件冒泡
  
  if (!authStore.isAuthenticated) {
    return
  }
  
  try {
    // 查找作品，确定当前推荐状态
    let work = works.value.find(w => w.id === workId)
    if (!work) {
      work = recommendedWorks.value.find(w => w.id === workId)
    }
    
    if (!work) return
    
    // 根据当前推荐状态决定新的权重
    // 如果已推荐(weight > 0)，则取消推荐(weight = 0)
    // 如果未推荐(weight = 0)，则推荐(weight = 10)
    const newWeight = work.recommendWeight > 0 ? 0 : 10
    
    const response = await axios.post('/interaction/recommend', {
      type: 2,
      itemId: workId,
      weight: newWeight,
      clientId: getClientId()
    })
    
    if (response.data.success) {
      // 更新作品推荐状态
      const newRecommendStatus = response.data.data.hasRecommended
      const updatedWeight = response.data.data.weight
      
      // 更新普通作品列表和推荐作品列表
      updateWorkRecommendStatus(workId, newRecommendStatus, updatedWeight)
      
      // 如果取消了推荐，且当前在推荐视图中，则从列表中移除该作品
      if (showRecommended.value && !newRecommendStatus) {
        recommendedWorks.value = recommendedWorks.value.filter(w => w.id !== workId)
      }
      // 如果新增了推荐，且当前在推荐视图中，则需要刷新推荐列表
      else if (showRecommended.value && newRecommendStatus && newWeight > 0) {
        // 重置推荐列表并重新获取
        resetRecommendedWorks()
        fetchRecommendedWorks()
      }
    }
  } catch (error) {
    console.error('推荐失败:', error)
  }
}

// 更新作品推荐状态
const updateWorkRecommendStatus = (workId, hasRecommended, weight) => {
  // 更新普通作品列表
  const workIndex = works.value.findIndex(w => w.id === workId)
  if (workIndex !== -1) {
    works.value[workIndex].hasRecommended = hasRecommended
    works.value[workIndex].recommendWeight = weight
  }
  
  // 更新推荐作品列表
  const recommendedIndex = recommendedWorks.value.findIndex(w => w.id === workId)
  if (recommendedIndex !== -1) {
    recommendedWorks.value[recommendedIndex].hasRecommended = hasRecommended
    recommendedWorks.value[recommendedIndex].recommendWeight = weight
  }
}

// 获取作品列表
const fetchWorks = async () => {
  if (loading.value) return

  loading.value = true
  try {
    const response = await axios.get('/works', {
      params: {
        page: currentPage.value,
        size: pageSize.value,
        tags: selectedTags.value.length > 0 ? selectedTags.value.join(',') : undefined,
        keyword: searchKeyword.value || undefined
      }
    })
    
    // 获取每个作品的交互数据
    const worksWithInteraction = await Promise.all(
      response.data.works.map(async (work) => {
        try {
          const interactionResponse = await axios.get(`/interaction/2/${work.id}/${getClientId()}`)
          return {
            ...work,
            likeCount: interactionResponse.data.data.like,
            recommendWeight: interactionResponse.data.data.weight,
            hasLiked: interactionResponse.data.data.hasLiked || false,
            hasRecommended: interactionResponse.data.data.hasRecommended || false
          }
        } catch (error) {
          console.error(`获取作品 ${work.id} 的交互数据失败:`, error)
          return work
        }
      })
    )
    
    // 直接替换数据，不再累加
    works.value = worksWithInteraction
    // 计算总页数
    totalPages.value = Math.ceil(response.data.count / pageSize.value)
    totalItems.value = response.data.count
  } catch (error) {
    console.error('获取作品列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索作品
const searchWorks = () => {
  works.value = []
  currentPage.value = 1
  hasMore.value = true
  fetchWorks()
}

// 监听搜索关键词变化
watch(searchKeyword, (newVal, oldVal) => {
  if (newVal === '' && oldVal !== '') {
    // 当搜索框被清空时，重置搜索结果
    works.value = []
    currentPage.value = 1
    hasMore.value = true
    fetchWorks()
  }
})

// 切换页码
const changePage = (page) => {
  currentPage.value = page
  fetchWorks()
}

// 处理跳转页码
const goToPage = () => {
  if (!targetPage.value) return
  
  const pageNum = parseInt(targetPage.value)
  if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages.value) {
    return
  }
  
  currentPage.value = pageNum
  fetchWorks()
  targetPage.value = ''
}

// 回到第一页
const goToFirstPage = () => {
  currentPage.value = 1
  fetchWorks()
}

// 删除作品
const deleteWork = async (id) => {
  const confirmed = await confirm('确定要删除这个作品吗？')
  if (!confirmed) {
    return
  }
  
  try {
    await axios.post(`/works/delete`, {id:id})
    await fetchWorks()
    await fetchTags()
  } catch (error) {
    console.error('删除作品失败:', error)
  }
}

// 跳转到详情页
const goToDetail = (id) => {
  // 导航前保存当前状态
  sessionStorage.setItem('workPage', currentPage.value.toString())
  sessionStorage.setItem('workSelectedTags', JSON.stringify(selectedTags.value))
  sessionStorage.setItem('workSearchKeyword', searchKeyword.value || '')
  sessionStorage.setItem('workShowRecommended', showRecommended.value.toString())
  sessionStorage.setItem('workListScrollPosition', window.scrollY.toString())
  
  router.push(`/works/${id}?from=list`)
}

// 格式化日期
const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// 获取所有标签
const fetchTags = async () => {
  try {
    const response = await axios.get('/worktags')
    allTags.value = response.data.data.tags
  } catch (error) {
    console.error('获取标签失败:', error)
  }
}

// 获取标签样式
const getTagStyle = (tag) => {
  const bgColor = getTagColor(tag)
  const textColor = getTextColor(bgColor)
  return {
    backgroundColor: bgColor,
    color: textColor
  }
}

// 切换推荐作品视图
const toggleRecommendedView = async () => {
  showRecommended.value = !showRecommended.value
  
  if (showRecommended.value) {
    // 每次显示推荐视图时，都重新获取推荐作品
    resetRecommendedWorks()
    await fetchRecommendedWorks()
  }
}

// 获取推荐作品
const fetchRecommendedWorks = async () => {
  if (loadingRecommended.value || !recommendedHasMore.value) return
  
  loadingRecommended.value = true
  try {
    const response = await axios.get('/recommended-items', {
      params: {
        type: 2,
        page: recommendedPage.value,
        size: pageSize.value
      }
    })
    
    if (response.data.success) {
      const items = response.data.data.items
      
      // 获取每个作品的交互数据
      const worksWithInteraction = await Promise.all(
        items.map(async (work) => {
          try {
            const interactionResponse = await axios.get(`/interaction/2/${work.id}/${getClientId()}`)
            return {
              ...work,
              likeCount: interactionResponse.data.data.like,
              recommendWeight: interactionResponse.data.data.weight,
              hasLiked: interactionResponse.data.data.hasLiked || false,
              hasRecommended: interactionResponse.data.data.hasRecommended || false
            }
          } catch (error) {
            console.error(`获取作品 ${work.id} 的交互数据失败:`, error)
            return work
          }
        })
      )
      
      if (recommendedPage.value === 1) {
        recommendedWorks.value = worksWithInteraction
      } else {
        recommendedWorks.value = [...recommendedWorks.value, ...worksWithInteraction]
      }
      
      recommendedHasMore.value = items.length === pageSize.value
      recommendedPage.value++
    }
  } catch (error) {
    console.error('获取推荐作品失败:', error)
  } finally {
    loadingRecommended.value = false
  }
}

// 加载更多推荐作品
const loadMoreRecommended = () => {
  fetchRecommendedWorks()
}

// 重置推荐作品列表
const resetRecommendedWorks = () => {
  recommendedWorks.value = []
  recommendedPage.value = 1
  recommendedHasMore.value = true
}

// 修改 getThumbnailUrl 方法
const getThumbUrl = (url, width = 800) => {
  
  if (!url) return '';
  
  // 使用更高的锐化参数
  return `${url}?x-oss-process=image`
    + `/resize,w_${width}` // 限制宽度，保持原始比例
}

onMounted(async () => {
  await initTagColors() // 初始化标签颜色
  
  // 检查是否是从详情页返回
  const isFromDetail = route.query.from === 'detail'
  
  // 首先获取标签数据
  await fetchTags()
  
  if (isFromDetail) {
    // 恢复保存的状态
    const savedPage = sessionStorage.getItem('workPage')
    const savedTags = sessionStorage.getItem('workSelectedTags')
    const savedKeyword = sessionStorage.getItem('workSearchKeyword')
    const savedShowRecommended = sessionStorage.getItem('workShowRecommended')
    
    // 重置列表状态
    works.value = []
    hasMore.value = true
    
    if (savedPage) {
      currentPage.value = parseInt(savedPage)
    }
    if (savedTags) {
      selectedTags.value = JSON.parse(savedTags)
    }
    if (savedKeyword) {
      searchKeyword.value = savedKeyword
    }
    if (savedShowRecommended) {
      showRecommended.value = savedShowRecommended === 'true'
    }
  } else {
    // 如果不是从详情页返回，重置所有状态
    works.value = []
    currentPage.value = 1
    hasMore.value = true
    selectedTags.value = []
    searchKeyword.value = ''
    showRecommended.value = false
  }
  
  // 获取作品数据
  await fetchWorks()
  
  // 恢复滚动位置
  if (isFromDetail) {
    const savedScrollPosition = sessionStorage.getItem('workListScrollPosition')
    if (savedScrollPosition) {
      setTimeout(() => {
        window.scrollTo({
          top: parseInt(savedScrollPosition),
          behavior: 'instant'
        })
      }, 100)
    }
  }
})

onUnmounted(() => {
})
</script>

<template>
  <!-- 在页面顶部添加公告组件 -->
   <div class ="announcement">
    <Announcement 
      title="公告"
      configKey="works" 
      :showTitle="true"
      :compact="true"
    />
  </div>
  
  <WorkEditor 
    v-if="showEditor"
    :visible="showEditor"
    :mode="editorMode"
    :work="currentWork"
    @success="handleEditorSuccess"
    @cancel="closeEditor"/><!-- 编辑弹窗 -->
    <template v-else>
      <div class="header">
        <h2>作品展示</h2>
        <div class="header-actions">
          <!-- 搜索框 -->
          <div class="search-container" :class="{ 'is-searching': isSearching }">
            <input 
              v-model="searchKeyword"
              type="text"
              placeholder="搜索作品..."
              @focus="isSearching = true"
              @blur="isSearching = false"
              @keyup.enter="searchWorks"
            >
            <button class="search-btn" @click="searchWorks">
              <i class="iconfont icon-sousuo"></i>
            </button>
          </div>
          <button v-if="canEdit" class="add-btn" @click="openCreateEditor">新增 +</button>
        </div>
      </div>
      <div class="filter-tags">
        <!-- 推荐标签 -->
        <a href="#" 
          class="tag recommended-tag" 
          :class="{ active: showRecommended }"
          @click.prevent="toggleRecommendedView">
          <i class="iconfont icon-xingxingtuijian1"></i>
          <span v-if="showRecommended" class="remove-icon">×</span>
        </a>
        
        <!-- 其他标签 -->
        <a v-for="tag in allTags" 
          :key="tag"
          href="#"
          :class="['tag', { active: selectedTags.includes(tag) }]"
          :style="!selectedTags.includes(tag) ? getTagStyle(tag) : {}"
          @click.prevent="toggleTag(tag)">
          {{ tag }}
          <span v-if="selectedTags.includes(tag)" class="remove-icon">×</span>
        </a>
      </div>

      <!-- 作品网格展示 -->
      <div class="work-grid">
        <div 
          v-for="work in showRecommended ? recommendedWorks : works" 
          :key="work.id" 
          class="work-card">
          <!-- 封面图 -->
          <div class="work-cover" @click="goToDetail(work.id)">
            <img
              v-if="work.pictures && work.pictures.length > 0" 
              v-image="getThumbUrl(work.pictures[0])" alt="封面">
            <div v-else class="no-image">
              暂无图片
            </div>
            
            <!-- 在售标记 (仅图标) -->
            <div v-if="work.price && work.price > 0" class="for-sale-badge">
              <i class="iconfont icon-zaishou"></i>
            </div>
            
            <!-- 交互按钮 -->
            <div class="interaction-overlay">
              <div class="interaction-btn" @click="toggleLike($event, work.id)">
                <i :class="['iconfont', work.hasLiked ? 'icon-dianzan' : 'icon-dianzan-0']"></i>
                <span>{{ work.likeCount || 0 }}</span>
              </div>
              
              <div v-if="canEdit" class="interaction-btn" @click="toggleRecommend($event, work.id)">
                <i :class="['iconfont', work.recommendWeight > 0 ? 'icon-xingxingtuijian1' : 'icon--xingxingtuijian']"></i>
              </div>
            </div>
          </div>
          
          <!-- 作品信息 -->
          <div class="work-info">
            <div class="work-header">
              <h3 @click="goToDetail(work.id)">{{ work.name }}</h3>
              <!-- 操作按钮 -->
              <div class="actions" v-if="canEdit">
                <button @click="openEditEditor(work)"><i class="iconfont icon-bianji"></i></button>
                <button @click="deleteWork(work.id)"><i class="iconfont icon-shanchu"></i></button>
              </div>
            </div>
            <!--<p class="description">{{ work.description }}</p>-->
            <div class="tags">
              <span 
                v-for="tag in work.tags" 
                :key="tag" 
                class="tag"
                @click.prevent="toggleTag(tag)">
                {{ tag }}
              </span>
            </div>
            <div class="update-time">
              更新时间: {{ formatDate(work.updatedAt) }}
            </div>
          </div>
        </div>
      </div>
      <!-- 替换原来的加载更多按钮 -->
      <div class="pagination" v-if="totalPages > 1">
        <button 
          class="pagination-btn" 
          :disabled="currentPage === 1"
          @click="changePage(currentPage - 1)"
        >
          上一页
        </button>
        
        <div class="pagination-info">
          <span class="cur">{{ currentPage }}</span> / {{ totalPages }} 页
        </div>
        
        <button 
          class="pagination-btn" 
          :disabled="currentPage === totalPages"
          @click="changePage(currentPage + 1)"
        >
          下一页
        </button>
        
        <div class="page-jump">
          <input 
            type="number" 
            v-model="targetPage" 
            min="1" 
            :max="totalPages"
            class="page-input"
            placeholder="页码"
            @keyup.enter="goToPage"
          />
          <button 
            class="jump-btn"
            @click="goToPage"
          >
            跳转
          </button>
        </div>
      </div>
      
      <!-- 无推荐作品提示 -->
      <div v-if="showRecommended && recommendedWorks.length === 0 && !loadingRecommended" class="no-recommended">
        <i class="iconfont icon-xingxingtuijian1"></i>
        <p>暂无推荐作品</p>
      </div>
    </template>
</template>

<style scoped>
.announcement {
  border-radius: 15px;
  padding: 0 15px 10px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 15px;
}

.work-view {
  padding: 20px 0;
  max-width: 1200px;
  margin: 30px auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  margin-top: 10px;
}

.header h2 {
  font-size: 1rem;
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-btn {
  padding: 4px 6px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.work-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s;
}

.work-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.work-cover {
  aspect-ratio: 4/3;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.work-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-info {
  padding: 10px 15px;
  font-size: 1rem;
}

.work-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.work-info h3 {
  font-size: 1rem;
  cursor: pointer;
}

.description {
  color: #666;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

.tag {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #f0f0f0;
  display: inline-flex;
  align-items: center;
  height: 20px;
}

.tag:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.tag a {
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tag a:hover {
  opacity: 0.8;
}

.tags .tag {
  font-size: 0.7rem;
  color: #499e8d;
}

/* 添加新样式 */
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 14px;
}

.filter-tags .tag {
  text-decoration: none;
  position: relative;
  padding-right: 8px;
  display: flex;
  align-items: center;
}

.filter-tags .tag.active {
  background: #666 !important;
  color: white !important;
  padding-right: 18px; /* 为删除图标留出空间 */
}

.remove-icon {
  color: #fff;
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

.load-more {
  text-align: center;
  margin: 20px 0;
}

.load-more a {
  display: inline-block;
  padding: 8px 24px;
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.load-more a:hover {
  color: #666;
}

.load-more a.loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.update-time {
  font-size: 12px;
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button {
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.actions button:hover {
  border: 1px dashed #ddd;
}

.drag-handle {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: move;
  user-select: none;
}

.no-image {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 180px;
  transition: width 0.3s ease;
}

.search-container.is-searching {
  width: 220px;
}

.search-container input {
  width: 100%;
  padding: 4px 30px 4px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.3s ease;
}

.search-container input:focus {
  border-color: var(--color-blue);
  box-shadow: 0 0 0 2px rgba(73, 158, 141, 0.2);
  outline: none;
}

.search-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #999;
  padding: 0;
  font-size: 14px;
}

.search-btn:hover {
  color: var(--color-blue);
}

.interaction-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
}

.interaction-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: white;
  padding: 5px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.interaction-btn i {
  font-size: 1.2rem;
}

.interaction-btn i.icon-dianzan {
  color: #e53935;
}

.interaction-btn i.icon-xingxingtuijian1 {
  color: #ffc107;
}

.recommended-tag {
  background-color: #ffffff !important;
  color: #333 !important;
  display: flex;
  align-items: center;
  gap: 5px;
}

.recommended-tag i {
  font-size: 14px;
}

.recommended-tag.active {
  background-color: var(--color-blue) !important;
  color: white !important;
}

.recommended-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 193, 7, 0.9);
  color: #333;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recommended-badge i {
  font-size: 16px;
}

.no-recommended {
  text-align: center;
  padding: 40px 0;
  color: #999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.no-recommended i {
  font-size: 48px;
  color: #ddd;
}

/* 在售标记样式 */
.for-sale-badge {
  position: absolute;
  top: -10px;
  left: 7px;
  display: flex;
  align-items: center;
  z-index: 2;
}

.for-sale-badge i {
  margin-right: 2px;
  font-size: 50px;
}

@media (max-width: 768px) {
  .work-view {
    margin-top: 0;
  }

  .work-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }

  .preview-item {
    touch-action: none; /* 防止触摸设备的默认行为 */
  }
  
  .drag-handle {
    opacity: 1; /* 在移动端始终显示拖动手柄 */
    padding: 4px 8px; /* 更大的点击区域 */
  }
  
  .search-container {
    width: 140px;
  }
  
  .search-container.is-searching {
    width: 180px;
  }
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  gap: 8px;
}

.pagination-btn, .jump-btn {
  padding: 2px 3px;
  background-color: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.3s;
  color: #9da09e;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #3E3E3E;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 14px;
  color: #9da09e;
}

.pagination-info .cur {
  font-size: 16px;
  color: #5e5e5e;
}

.page-jump {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.page-input {
  width: 45px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.jump-btn {
  margin-left: 5px;
}
</style>