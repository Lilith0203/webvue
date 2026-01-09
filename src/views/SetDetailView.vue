<!-- views/SetDetailView.vue - 合集详情页 -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import axios from '../api'
import WorkList from '../components/WorkList.vue'
import WorkEditor from '../components/WorkEditor.vue'
import WorkSelector from '../components/WorkSelector.vue'
import { confirm } from '../utils/confirm'
import { message } from '../utils/message'
import { getTagColor, getTextColor, initTagColors } from '../utils/tags'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const canEdit = computed(() => authStore.isAuthenticated)

// 合集信息
const setInfo = ref(null)
const loadingSet = ref(false)

// 作品列表
const works = ref([])
const loadingWorks = ref(false)

// 编辑器相关
const showEditor = ref(false)
const editorMode = ref('create')
const currentWork = ref(null)

// 作品选择器
const showWorkSelector = ref(false)

// 获取客户端ID
const getClientId = () => {
  let clientId = localStorage.getItem('clientId')
  if (!clientId) {
    clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
    localStorage.setItem('clientId', clientId)
  }
  return clientId
}

// 获取合集信息
const fetchSetInfo = async () => {
  const setId = parseInt(route.params.id)
  if (!setId) return
  
  loadingSet.value = true
  try {
    const response = await axios.get('/works-set/list')
    if (response.data.success) {
      const set = response.data.data.sets.find(s => s.id === setId)
      if (set) {
        setInfo.value = set
      } else {
        // 合集不存在，跳转回作品列表
        router.push('/works')
      }
    }
  } catch (error) {
    console.error('获取合集信息失败:', error)
    router.push('/works')
  } finally {
    loadingSet.value = false
  }
}

// 获取合集下的作品列表
const fetchWorks = async () => {
  const setId = parseInt(route.params.id)
  if (!setId) return
  
  loadingWorks.value = true
  try {
    const response = await axios.get(`/works-set/${setId}/works`)
    if (response.data.success) {
      const worksData = response.data.data.works
      
      // 获取每个作品的交互数据
      const worksWithInteraction = await Promise.all(
        worksData.map(async (work) => {
          try {
            const interactionResponse = await axios.get(`/interaction/2/${work.id}/${getClientId()}`)
            return {
              ...work,
              likeCount: interactionResponse.data.data.like,
              recommendWeight: interactionResponse.data.data.weight,
              top: interactionResponse.data.data.top || 0,
              hasLiked: interactionResponse.data.data.hasLiked || false,
              hasRecommended: interactionResponse.data.data.hasRecommended || false
            }
          } catch (error) {
            console.error(`获取作品 ${work.id} 的交互数据失败:`, error)
            return {
              ...work,
              likeCount: 0,
              recommendWeight: 0,
              top: 0,
              hasLiked: false,
              hasRecommended: false
            }
          }
        })
      )
      
      works.value = worksWithInteraction
    }
  } catch (error) {
    console.error('获取合集作品列表失败:', error)
  } finally {
    loadingWorks.value = false
  }
}

// 点赞
const toggleLike = async (event, workId) => {
  event.stopPropagation()
  
  try {
    const response = await axios.post('/interaction/like', {
      type: 2,
      itemId: workId,
      clientId: getClientId()
    })
    
    if (response.data.success) {
      const workIndex = works.value.findIndex(w => w.id === workId)
      if (workIndex !== -1) {
        works.value[workIndex].hasLiked = response.data.data.hasLiked
        works.value[workIndex].likeCount = response.data.data.like
      }
    }
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

// 推荐
const toggleRecommend = async (event, workId) => {
  event.stopPropagation()
  
  if (!authStore.isAuthenticated) {
    return
  }
  
  try {
    let work = works.value.find(w => w.id === workId)
    if (!work) return
    
    const newWeight = work.recommendWeight > 0 ? 0 : 10
    
    const response = await axios.post('/interaction/recommend', {
      type: 2,
      itemId: workId,
      weight: newWeight,
      clientId: getClientId()
    })
    
    if (response.data.success) {
      const workIndex = works.value.findIndex(w => w.id === workId)
      if (workIndex !== -1) {
        works.value[workIndex].hasRecommended = response.data.data.hasRecommended
        works.value[workIndex].recommendWeight = response.data.data.weight
      }
    }
  } catch (error) {
    console.error('推荐失败:', error)
  }
}

// 打开编辑编辑器
const openEditEditor = (work) => {
  currentWork.value = work
  editorMode.value = 'edit'
  showEditor.value = true
}

// 关闭编辑器
const closeEditor = () => {
  showEditor.value = false
}

// 处理编辑成功
const handleEditorSuccess = async () => {
  showEditor.value = false
  await fetchWorks()
}

// 删除作品
const deleteWork = async (id) => {
  const confirmed = await confirm('确定要删除这个作品吗？')
  if (!confirmed) {
    return
  }
  
  try {
    await axios.post('/works/delete', { id: id })
    await fetchWorks()
  } catch (error) {
    console.error('删除作品失败:', error)
  }
}

// 打开作品选择器
const openWorkSelector = () => {
  showWorkSelector.value = true
}

// 关闭作品选择器
const closeWorkSelector = () => {
  showWorkSelector.value = false
}

// 添加作品到合集
const addWorksToSet = async (selectedWorks) => {
  const setId = parseInt(route.params.id)
  if (!setId) return
  
  try {
    // 批量添加作品
    const promises = selectedWorks.map(work => 
      axios.post('/works-set/add-work', {
        setId: setId,
        worksId: work.id,
        order: 0
      })
    )
    
    await Promise.all(promises)
    message.success('作品添加成功')
    showWorkSelector.value = false
    await fetchWorks()
  } catch (error) {
    console.error('添加作品失败:', error)
    if (error.response && error.response.data && error.response.data.message) {
      message.error(error.response.data.message)
    } else {
      message.error('添加作品失败')
    }
  }
}

// 从合集移出作品
const removeWorkFromSet = async (workId) => {
  const confirmed = await confirm('确定要从合集中移出这个作品吗？')
  if (!confirmed) {
    return
  }
  
  const setId = parseInt(route.params.id)
  if (!setId) return
  
  try {
    await axios.post('/works-set/remove-work', {
      setId: setId,
      worksId: workId
    })
    message.success('作品移出成功')
    await fetchWorks()
  } catch (error) {
    console.error('移出作品失败:', error)
    message.error('移出作品失败')
  }
}

// 获取已在合集中的作品ID列表
const getExcludeWorkIds = computed(() => {
  return works.value.map(w => w.id)
})

// 标签点击（跳转到作品列表并筛选）
const handleTagClick = (tag) => {
  router.push({
    path: '/works',
    query: { tag }
  })
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

// 处理合集封面图URL（大图，用于详情页）
const getSetCoverUrl = (url) => {
  if (!url) return '';
  // 合集详情页中的封面图较大，使用600px宽度
  return `${url}?x-oss-process=image/resize,w_600`
}

onMounted(async () => {
  await initTagColors()
  await fetchSetInfo()
  await fetchWorks()
})
</script>

<template>
  <div class="set-detail-view">
    <!-- 返回按钮 -->
    <div class="back-header">
      <button class="back-btn" @click="router.push('/works')">
         返回
      </button>
    </div>

    <!-- 合集信息 -->
    <div v-if="setInfo" class="set-info">
      <div class="set-header">
        <div class="set-cover-large">
          <img v-if="setInfo.cover" v-image="getSetCoverUrl(setInfo.cover)" :alt="setInfo.name">
          <div v-else class="no-cover-large">暂无封面</div>
        </div>
        <div class="set-details">
          <h1 class="set-title">{{ setInfo.name }}</h1>
          <p v-if="setInfo.description" class="set-description">{{ setInfo.description }}</p>
          <div v-if="setInfo.tags && setInfo.tags.length > 0" class="set-tags">
            <span 
              v-for="tag in setInfo.tags" 
              :key="tag" 
              class="tag"
              :style="getTagStyle(tag)">
              {{ tag }}
            </span>
          </div>
          <div class="set-meta">
            <span>作品数量: {{ works.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 作品列表 -->
    <div class="works-section">
      <div class="section-header">
        <h2>合集作品</h2>
        <div class="header-actions" v-if="canEdit">
          <button class="add-to-set-btn" @click="openWorkSelector">
             添加
          </button>
        </div>
      </div>

      <div v-if="loadingWorks" class="loading">加载中...</div>
      <div v-else-if="works.length === 0" class="empty-state">
        <p>该合集暂无作品</p>
      </div>
      <WorkList
        v-else
        :works="works"
        :show-edit-actions="false"
        :show-remove-from-set="canEdit"
        :on-edit="openEditEditor"
        :on-delete="deleteWork"
        :on-remove-from-set="removeWorkFromSet"
        :on-like="toggleLike"
        :on-recommend="toggleRecommend"
        :on-tag-click="handleTagClick"
        :from-set="true"
        :set-id="parseInt(route.params.id)"
      />
    </div>

    <!-- 作品编辑器 -->
    <WorkEditor 
      v-if="showEditor"
      :visible="showEditor"
      :mode="editorMode"
      :work="currentWork"
      @success="handleEditorSuccess"
      @cancel="closeEditor"
    />
    
    <!-- 作品选择器 -->
    <WorkSelector
      v-if="showWorkSelector"
      :visible="showWorkSelector"
      :exclude-ids="getExcludeWorkIds"
      @select="addWorksToSet"
      @cancel="closeWorkSelector"
    />
  </div>
</template>

<style scoped>
.set-detail-view {
  max-width: 1200px;
  margin: 10px auto;
}

.back-header {
  margin-bottom: 6px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-green);
  transition: all 0.3s;
}

.set-info {
  margin-bottom: 10px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.set-header {
  display: flex;
  gap: 15px;
}

.set-cover-large {
  flex-shrink: 0;
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
}

.set-cover-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover-large {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

.set-details {
  flex: 1;
}

.set-title {
  font-size: 1.3rem;
  font-weight: bold;
  margin: 0 0 15px 0;
  color: #333;
}

.set-description {
  font-size: 0.9rem;
  color: #666;
  line-height: 1.6;
  margin: 0 0 15px 0;
}

.set-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.set-tags .tag {
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.set-tags .tag:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.set-meta {
  font-size: 0.85rem;
  color: #999;
}

.works-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h2 {
  font-size: 1.1rem;
  font-weight: bold;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.add-to-set-btn,
.add-btn {
  padding: 3px 7px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-to-set-btn:hover,
.add-btn:hover {
  opacity: 0.9;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

</style>

