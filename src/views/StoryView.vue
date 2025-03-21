<script setup>
import axios from '../api'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// 响应式状态
const storySets = ref([])
const stories = ref([])
const activeSetId = ref(null)
const loading = ref(false)
const error = ref(null)
const showAddSetModal = ref(false)
const showEditSetModal = ref(false)
const newSetName = ref('')
const editingSet = ref(null)
const confirmDeleteModal = ref(false)
const setToDelete = ref(null)

// 计算属性
const isLoggedIn = computed(() => {
  return authStore.isAuthenticated
})

// 获取剧情合集
const fetchStorySets = async () => {
  try {
    loading.value = true
    const response = await axios.get('/story-sets')
    storySets.value = response.data.data
    
    // 如果有合集，默认选择第一个
    if (storySets.value.length > 0) {
      selectStorySet(storySets.value[0].id)
    }
  } catch (err) {
    error.value = '获取剧情合集失败'
    console.error('获取剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 选择剧情合集
const selectStorySet = async (setId) => {
  activeSetId.value = setId
  await fetchStories(setId)
}

// 获取剧情列表
const fetchStories = async (setId) => {
  try {
    loading.value = true
    stories.value = []
    const response = await axios.get(`/story-sets/${setId}`)
    stories.value = response.data.data
  } catch (err) {
    error.value = '获取剧情列表失败'
    console.error('获取剧情列表错误:', err)
  } finally {
    loading.value = false
  }
}

// 获取当前选中合集名称
const getActiveSetName = () => {
  const activeSet = storySets.value.find(set => set.id === activeSetId.value)
  return activeSet ? activeSet.name : ''
}

// 获取当前选中的合集对象
const getActiveSet = () => {
  return storySets.value.find(set => set.id === activeSetId.value) || null
}

// 查看剧情详情
const viewStoryDetail = (storyId) => {
  router.push(`/story/${storyId}`)
}

// 打开添加合集模态框
const openAddSetModal = () => {
  showAddSetModal.value = true
  newSetName.value = ''
}

// 关闭添加合集模态框
const closeAddSetModal = () => {
  showAddSetModal.value = false
}

// 添加剧情合集
const addStorySet = async () => {
  if (!newSetName.value.trim()) {
    error.value = '合集名称不能为空'
    return
  }
  
  try {
    loading.value = true
    const response = await axios.post('/story-sets', {
      name: newSetName.value.trim()
    })
    
    // 添加新合集到列表
    storySets.value.push(response.data)
    closeAddSetModal()
    
    // 如果是第一个合集，自动选中
    if (storySets.value.length === 1) {
      selectStorySet(response.data.id)
    }
  } catch (err) {
    error.value = '添加剧情合集失败'
    console.error('添加剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开编辑合集模态框
const openEditSetModal = (set) => {
  editingSet.value = { ...set }
  showEditSetModal.value = true
}

// 关闭编辑合集模态框
const closeEditSetModal = () => {
  showEditSetModal.value = false
  editingSet.value = null
}

// 更新剧情合集
const updateStorySet = async () => {
  if (!editingSet.value || !editingSet.value.name.trim()) {
    error.value = '合集名称不能为空'
    return
  }
  
  try {
    loading.value = true
    await axios.put(`/story-sets/${editingSet.value.id}`, {
      name: editingSet.value.name.trim()
    })
    
    // 更新本地合集列表
    const index = storySets.value.findIndex(set => set.id === editingSet.value.id)
    if (index !== -1) {
      storySets.value[index].name = editingSet.value.name.trim()
    }
    
    closeEditSetModal()
  } catch (err) {
    error.value = '更新剧情合集失败'
    console.error('更新剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开删除确认模态框
const openDeleteConfirmModal = (set) => {
  setToDelete.value = set
  confirmDeleteModal.value = true
}

// 关闭删除确认模态框
const closeDeleteConfirmModal = () => {
  confirmDeleteModal.value = false
  setToDelete.value = null
}

// 删除剧情合集
const deleteStorySet = async () => {
  if (!setToDelete.value) return
  
  try {
    loading.value = true
    await axios.delete(`/story-sets/${setToDelete.value.id}`)
    
    // 从列表中移除
    storySets.value = storySets.value.filter(set => set.id !== setToDelete.value.id)
    
    // 如果删除的是当前选中的合集
    if (activeSetId.value === setToDelete.value.id) {
      activeSetId.value = null
      stories.value = []
      
      // 如果还有其他合集，选择第一个
      if (storySets.value.length > 0) {
        selectStorySet(storySets.value[0].id)
      }
    }
    
    closeDeleteConfirmModal()
  } catch (err) {
    error.value = '删除剧情合集失败'
    console.error('删除剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 组件挂载时获取数据
onMounted(() => {
  fetchStorySets()
})
</script>

<template>
  <div class="story-view">
    <h1 class="page-title">剧情百科</h1>
    
    <!-- 顶部导航菜单 -->
    <div class="story-sets-header">
      <div class="story-sets-nav">
        <div 
          v-for="set in storySets" 
          :key="set.id" 
          class="story-set-item"
          :class="{ active: activeSetId === set.id }"
          @click="selectStorySet(set.id)"
        >
          {{ set.name }}
        </div>
      </div>
      
      <!-- 管理按钮 (仅登录用户可见) -->
      <div v-if="isLoggedIn" class="story-sets-actions">
        <button class="btn-add" @click="openAddSetModal">
          添加合集
        </button>
      </div>
    </div>
    
    <!-- 剧情列表 -->
    <div class="story-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      
      <div v-else-if="activeSetId && stories.length > 0" class="stories-list">
        <div class="stories-header">
          <h2>{{ getActiveSetName() }}</h2>
          
          <!-- 合集管理按钮 (仅登录用户可见) -->
          <div v-if="isLoggedIn" class="set-actions">
            <button class="btn-edit" @click="openEditSetModal(getActiveSet())">
              编辑合集
            </button>
            <button class="btn-delete" @click="openDeleteConfirmModal(getActiveSet())">
              删除合集
            </button>
          </div>
        </div>
        
        <div class="story-grid">
          <div 
            v-for="story in stories" 
            :key="story.id" 
            class="story-card"
            @click="viewStoryDetail(story.id)"
          >
            <div class="story-card-image" v-if="story.coverImage">
              <img :src="story.coverImage" :alt="story.title">
            </div>
            <div class="story-card-content">
              <h3>{{ story.title }}</h3>
              <p v-if="story.description">{{ story.description }}</p>
              <div class="story-meta" v-if="story.date || story.author">
                <span v-if="story.date">{{ story.date }}</span>
                <span v-if="story.author">作者: {{ story.author }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else-if="activeSetId" class="empty-state">
        <p>该合集暂无剧情内容</p>
        <div v-if="isLoggedIn" class="set-actions empty-set-actions">
          <button class="btn-edit" @click="openEditSetModal(getActiveSet())">
            编辑合集
          </button>
          <button class="btn-delete" @click="openDeleteConfirmModal(getActiveSet())">
            删除合集
          </button>
        </div>
      </div>
      
      <div v-else class="welcome-message">
        <p>请从上方选择一个剧情合集</p>
      </div>
    </div>
    
    <!-- 添加合集模态框 -->
    <div v-if="showAddSetModal" class="modal-overlay">
      <div class="modal-content">
        <h3>添加剧情合集</h3>
        <div class="form-group">
          <label for="setName">合集名称</label>
          <input 
            type="text" 
            id="setName" 
            v-model="newSetName" 
            placeholder="请输入合集名称"
          >
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeAddSetModal">取消</button>
          <button class="btn-confirm" @click="addStorySet">确认添加</button>
        </div>
      </div>
    </div>
    
    <!-- 编辑合集模态框 -->
    <div v-if="showEditSetModal" class="modal-overlay">
      <div class="modal-content">
        <h3>编辑剧情合集</h3>
        <div class="form-group">
          <label for="editSetName">合集名称</label>
          <input 
            type="text" 
            id="editSetName" 
            v-model="editingSet.name" 
            placeholder="请输入合集名称"
          >
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeEditSetModal">取消</button>
          <button class="btn-confirm" @click="updateStorySet">保存修改</button>
        </div>
      </div>
    </div>
    
    <!-- 删除确认模态框 -->
    <div v-if="confirmDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p>您确定要删除合集 "{{ setToDelete?.name }}" 吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeDeleteConfirmModal">取消</button>
          <button class="btn-delete" @click="deleteStorySet">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  text-align: center;
  margin-bottom: 30px;
  font-size: 28px;
  color: #333;
}

/* 导航菜单样式 */
.story-sets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.story-sets-nav {
  display: flex;
  overflow-x: auto;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 10px;
  flex: 1;
}

.story-set-item {
  padding: 10px 20px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.story-set-item:hover {
  background-color: #e0e0e0;
}

.story-set-item.active {
  background-color: #4a90e2;
  color: white;
}

.story-sets-actions {
  margin-left: 15px;
}

/* 按钮样式 */
.btn-add, .btn-edit, .btn-delete, .btn-cancel, .btn-confirm {
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  border: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.3s ease;
}

.btn-add, .btn-confirm {
  background-color: #4a90e2;
  color: white;
}

.btn-add:hover, .btn-confirm:hover {
  background-color: #3a7bc8;
}

.btn-edit {
  background-color: #f0ad4e;
  color: white;
}

.btn-edit:hover {
  background-color: #ec971f;
}

.btn-delete {
  background-color: #d9534f;
  color: white;
}

.btn-delete:hover {
  background-color: #c9302c;
}

.btn-cancel {
  background-color: #f5f5f5;
  color: #333;
}

.btn-cancel:hover {
  background-color: #e0e0e0;
}

/* 合集标题和操作按钮 */
.stories-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.set-actions {
  display: flex;
  gap: 10px;
}

.empty-set-actions {
  justify-content: center;
  margin-top: 20px;
}

/* 加载状态 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #4a90e2;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 剧情列表样式 */
.story-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.story-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
  background-color: white;
}

.story-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
}

.story-card-image {
  height: 160px;
  overflow: hidden;
}

.story-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.story-card-content {
  padding: 15px;
}

.story-card-content h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 18px;
}

.story-card-content p {
  color: #666;
  font-size: 14px;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
}

/* 空状态样式 */
.empty-state, .welcome-message {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  padding: 25px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
